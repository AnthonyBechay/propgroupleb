'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, MessageCircle, Instagram, Send, ArrowLeft, UserPlus, User,
  Bot, Megaphone, Inbox, Smartphone, Link2, X, Building2, Search, Archive, ArchiveRestore, Trash2, MoreVertical, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'
import { AssistantControl, type AssistantMode } from './AssistantControl'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { useAuth } from '@/contexts/AuthContext'
import { canDeleteConversations } from '@/lib/permissions'
import { ChatSuggestion, type Suggestion } from './ChatSuggestion'
import { ListingPicker } from './ListingPicker'

/**
 * WhatsApp and Instagram threads, mirrored from the phone.
 *
 * A thread is not a client. A work number also hears from suppliers and wrong
 * numbers, so a sender only enters the pipeline when they came from an ad, were
 * already known, or somebody presses "Add as client" here.
 */

interface ThreadLead {
  id: string
  name: string
}

interface Thread {
  id: string
  channel: 'WHATSAPP' | 'INSTAGRAM'
  externalId: string
  displayName: string | null
  lastMessageAt: string
  createdAt: string
  /** Somebody on our side has replied at least once. */
  answered?: boolean
  lastPreview: string | null
  unreadCount: number
  aiPaused: boolean
  /** Why it is paused: "Paused by the team" means switched off by a person. */
  aiPausedReason?: string | null
  /** The assistant answers this thread whatever happens. */
  aiAlways?: boolean
  adLabel: string | null
  adId: string | null
  lead: ThreadLead | null
}

interface ChatMessage {
  id: string
  direction: 'IN' | 'OUT'
  type: string
  body: string
  mediaUrl: string | null
  /** What a voice note says, written out by the chat assistant. */
  transcript: string | null
  origin: string | null
  status: string | null
  sentAt: string
}

interface ThreadDetail extends Thread {
  messages: ChatMessage[]
  canReply: boolean
  /** Would the assistant answer this thread's next message — and if not, why. */
  autoReply: { sent: boolean; reason: string; canResume?: boolean }
  /** What the chat assistant understood they want, waiting for a decision. */
  suggestion: Suggestion | null
  /** The thread has older messages than the ones loaded. */
  hasEarlier: boolean
  sendingConfigured: boolean
  autoReplyOn: boolean
  /** The paid template that restarts a conversation after 24 hours. */
  followUp?: { available: boolean; preview: string; lastSentAt: string | null }
}

/** How often an open inbox asks for new messages. */
const POLL_MS = 6_000

const threadName = (t: Thread) =>
  t.lead?.name || t.displayName || (t.channel === 'WHATSAPP' ? `+${t.externalId}` : 'Instagram user')

const timeLabel = (iso: string) => {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()

const clockLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** "Today", "Yesterday", or the date — the divider between two days of a thread. */
const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined })
}

const STATUS_LABEL: Record<string, string> = { delivered: 'Delivered', read: 'Read', failed: 'Not delivered' }

type Filter = 'all' | 'unread' | 'WHATSAPP' | 'INSTAGRAM' | 'archived'
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'INSTAGRAM', label: 'Instagram' },
  { key: 'archived', label: 'Archived' },
]

const ORIGIN_LABEL: Record<string, string> = { PHONE: 'Phone', CRM: 'CRM', AI: 'Auto-reply' }

function ChannelIcon({ channel, className }: { channel: Thread['channel']; className?: string }) {
  return channel === 'WHATSAPP'
    ? <MessageCircle className={`text-emerald-600 ${className ?? ''}`} />
    : <Instagram className={`text-pink-600 ${className ?? ''}`} />
}

/** The attachment itself, where we hold a copy; otherwise the body's "[image]" stands in. */
function Attachment({ message }: { message: ChatMessage }) {
  if (!message.mediaUrl) return null
  const url = normalizeFileUrl(message.mediaUrl)
  if (message.type === 'image' || message.type === 'sticker') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Attachment" className="rounded-lg max-h-64 mb-1" />
      </a>
    )
  }
  if (message.type === 'audio') return <audio controls src={url} className="max-w-full mb-1" />
  if (message.type === 'video') return <video controls src={url} className="rounded-lg max-h-64 mb-1" />
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline block mb-1">
      Open attachment
    </a>
  )
}

function MenuItem({
  icon: Icon, onClick, children, danger = false, className = '',
}: {
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-11 px-3 rounded-lg text-left text-sm inline-flex items-center gap-2.5 ${danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-800 hover:bg-slate-50'} ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" /> {children}
    </button>
  )
}

export function InboxView({
  onOpenLead,
  onChanged,
  focusLeadId,
  fill = false,
}: {
  /** Take the full height of the screen, as the page of its own does. */
  fill?: boolean
  /** Open this client's conversation, when the page was sent here from their drawer. */
  focusLeadId?: string | null
  onOpenLead: (id: string) => void
  /** A client was created or linked — the page should reload its client list. */
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // An open conversation is a step in the browser's history (?c=<id>), so the
  // phone's Back — the swipe, Android's button, the browser arrow — closes the
  // chat instead of leaving the inbox, and a reload stays on the same chat.
  const openThread = useCallback((id: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('c', id)
    const state = { inboxThread: id }
    // Switching chats side by side on a desktop replaces; opening one pushes.
    if (window.history.state?.inboxThread) window.history.replaceState(state, '', url)
    else window.history.pushState(state, '', url)
    setOpenId(id)
  }, [])
  const closeThread = useCallback(() => {
    if (window.history.state?.inboxThread) {
      window.history.back() // popstate below clears it
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('c')
    window.history.replaceState(null, '', url)
    setOpenId(null)
  }, [])
  useEffect(() => {
    const fromUrl = () => setOpenId(new URL(window.location.href).searchParams.get('c'))
    fromUrl()
    window.addEventListener('popstate', fromUrl)
    return () => window.removeEventListener('popstate', fromUrl)
  }, [])
  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // Searched on the server, so it reaches every thread, not just the newest 100.
  const [search, setSearch] = useState('')
  const { user } = useAuth()
  const canDelete = canDeleteConversations(user?.role)
  // How many of the thread's latest messages are loaded.
  const [take, setTake] = useState(100)
  // Loading earlier messages grows the thread upwards; that must not snap the
  // reader back down to the newest message.
  const keepPosition = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Attaching a thread to somebody already in the CRM, when the number alone
  // did not match them (a second phone, an Instagram account).
  const [linking, setLinking] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkResults, setLinkResults] = useState<ThreadLead[]>([])
  const [showListings, setShowListings] = useState(false)
  // The ⋯ menu in the chat header.
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const call = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${apiUrl}/api/crm/inbox${path}`, {
        credentials: 'include',
        cache: 'no-store',
        ...init,
        headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      }),
    [apiUrl]
  )

  // The server searches every thread; the list itself only holds the newest 100.
  const needle = search.trim()
  const loadThreads = useCallback(async () => {
    const p = new URLSearchParams({ limit: '100' })
    if (needle) p.set('search', needle)
    if (filter === 'unread') p.set('unread', 'true')
    else if (filter === 'archived') p.set('archived', 'true')
    else if (filter !== 'all') p.set('channel', filter)
    const res = await call(`?${p}`)
    if (res.ok) setThreads((await res.json()).data ?? [])
    else setThreads((t) => t ?? [])
  }, [call, needle, filter])

  const loadDetail = useCallback(async (id: string) => {
    const res = await call(`/${id}?take=${take}`)
    if (!res.ok) return
    const data: ThreadDetail | null = (await res.json()).data ?? null
    setDetail(data)
    // A message that arrives while the thread is on screen has been read.
    if (data && data.unreadCount > 0) call(`/${id}/read`, { method: 'POST' })
  }, [call, take])

  useEffect(() => {
    loadThreads()
    const timer = setInterval(loadThreads, POLL_MS)
    return () => clearInterval(timer)
  }, [loadThreads])

  // A phone suspends the page's timers while it is in the background — and the
  // home-screen app is in the background most of the day. Catch up the moment
  // it is opened again, rather than up to a poll later.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      loadThreads()
      if (openId) loadDetail(openId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadThreads, loadDetail, openId])

  // On a phone an open conversation is the whole screen, like WhatsApp: sized
  // to what the keyboard leaves visible (iOS does not shrink 100dvh for it),
  // and the page behind it held still.
  const [phoneHeight, setPhoneHeight] = useState<number | null>(null)
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 1023px)')
    if (!openId || !phone.matches) { setPhoneHeight(null); return }
    const vv = window.visualViewport
    const fit = () => {
      setPhoneHeight(vv ? vv.height : window.innerHeight)
      // iOS scrolls the page to show a focused field; the chat is already in view.
      window.scrollTo(0, 0)
    }
    fit()
    vv?.addEventListener('resize', fit)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      vv?.removeEventListener('resize', fit)
      document.body.style.overflow = previous
    }
  }, [openId])

  useEffect(() => {
    setDetail(null)
    setDraft('')
    setError(null)
    setLinking(false)
    setLinkQuery('')
    setShowListings(false)
    setMenuOpen(false)
    setTake(100)
  }, [openId])

  useEffect(() => {
    if (!openId) return
    loadDetail(openId)
    const timer = setInterval(() => loadDetail(openId), POLL_MS)
    return () => clearInterval(timer)
    // Not keyed on the thread list: typing in the search box reloads that
    // list, and must not wipe the open thread or a half-written reply.
  }, [openId, loadDetail])

  // Keep the newest message in view by scrolling the thread itself — never
  // the page, which would yank the whole CRM down on every incoming message.
  const messageCount = detail?.messages.length ?? 0
  useEffect(() => {
    if (keepPosition.current) { keepPosition.current = false; return }
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messageCount, openId])

  const send = async () => {
    if (!openId || !draft.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await call(`/${openId}/reply`, { method: 'POST', body: JSON.stringify({ text: draft }) })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.message || body?.error || 'The message was not sent.')
        return
      }
      setDraft('')
      await Promise.all([loadDetail(openId), loadThreads()])
    } finally { setSending(false) }
  }

  // The approved template — the one message WhatsApp takes after 24 hours. Paid, so asked first.
  const sendFollowUp = async () => {
    if (!openId || !detail?.followUp || sending) return
    const sure = window.confirm(
      `Send the follow-up template to ${threadName(detail)}?\n\n"${detail.followUp.preview}"\n\nWhatsApp charges for each template message.`
    )
    if (!sure) return
    setSending(true)
    setError(null)
    try {
      const res = await call(`/${openId}/follow-up`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.message || body?.error || 'The follow-up was not sent.')
        return
      }
      await Promise.all([loadDetail(openId), loadThreads()])
    } finally { setSending(false) }
  }

  const addAsClient = async (leadId?: string) => {
    if (!openId) return
    const res = await call(`/${openId}/lead`, { method: 'POST', body: JSON.stringify(leadId ? { leadId } : {}) })
    if (res.ok) {
      setLinking(false)
      setLinkQuery('')
      await Promise.all([loadDetail(openId), loadThreads()])
      onChanged()
    }
  }

  useEffect(() => {
    const q = linkQuery.trim()
    if (!linking || q.length < 2) { setLinkResults([]); return }
    const timer = setTimeout(async () => {
      const p = new URLSearchParams({ search: q, limit: '8' })
      const res = await fetch(`${apiUrl}/api/crm?${p}`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) setLinkResults((await res.json()).data ?? [])
    }, 250)
    return () => clearTimeout(timer)
  }, [linking, linkQuery, apiUrl])

  const archive = async (archived: boolean) => {
    if (!detail) return
    const res = await call(`/${detail.id}/archive`, { method: 'POST', body: JSON.stringify({ archived }) })
    if (res.ok) {
      closeThread()
      loadThreads()
    }
  }

  const remove = async () => {
    if (!detail) return
    const sure = window.confirm(
      `Delete this conversation with ${threadName(detail)} from the CRM?\n\nIts messages, transcripts, photos and voice notes are removed for good. The client record and the chat on your phone stay.`
    )
    if (!sure) return
    const res = await call(`/${detail.id}`, { method: 'DELETE' })
    if (res.ok) {
      closeThread()
      loadThreads()
    }
  }

  const replyNow = async (): Promise<string> => {
    if (!detail) return ''
    const res = await call(`/${detail.id}/ai-reply`, { method: 'POST' })
    const outcome = res.ok ? (await res.json()).data : null
    await Promise.all([loadDetail(detail.id), loadThreads()])
    return outcome ? outcome.reason : 'The assistant could not be reached.'
  }

  const setAssistantMode = async (mode: AssistantMode) => {
    if (!detail) return
    const res = await call(`/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ mode }) })
    if (res.ok) await loadDetail(detail.id)
  }

  // Arriving from a client's drawer: go straight to their thread.
  useEffect(() => {
    if (!focusLeadId || !threads) return
    const theirs = threads.find((t) => t.lead?.id === focusLeadId)
    if (theirs) openThread(theirs.id)
  }, [focusLeadId, threads === null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (threads === null) {
    return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  if (threads.length === 0 && !needle && filter === 'all') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-3" />
        <p className="font-semibold text-slate-800">No conversations yet.</p>
        <p className="text-sm text-slate-500 mt-1">
          WhatsApp and Instagram messages appear here once the accounts are connected.
        </p>
      </div>
    )
  }

  const visible = threads

  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden lg:grid lg:grid-cols-[360px_minmax(0,1fr)] ${fill ? 'lg:h-[calc(100dvh-9rem)]' : 'lg:h-[70vh]'}`}>
      {/* Threads — below lg, one pane at a time */}
      <div className={`lg:border-r lg:border-slate-200 lg:flex lg:flex-col lg:min-h-0 ${openId ? 'hidden lg:flex' : ''}`}>
      <div className="p-2 pb-1.5 border-b border-slate-200 space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, number or message"
          className="w-full min-h-10 pl-8 pr-8 rounded-lg bg-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-9 min-w-9 inline-flex items-center justify-center text-slate-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-8 px-2.5 rounded-full text-xs font-medium whitespace-nowrap ${filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      </div>
      <ul className="divide-y divide-slate-100 overflow-y-auto lg:flex-1">
        {visible.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => openThread(t.id)}
              className={`w-full min-h-11 text-left px-3 py-2 flex gap-2.5 hover:bg-slate-50 ${openId === t.id ? 'bg-slate-100' : t.unreadCount > 0 ? 'bg-emerald-50/60' : ''}`}
            >
              <ChannelIcon channel={t.channel} className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${t.unreadCount > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                    {threadName(t)}
                  </span>
                  <span className={`text-xs shrink-0 ${t.unreadCount > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>{timeLabel(t.lastMessageAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2 mt-0.5">
                  <span className={`truncate text-sm ${t.unreadCount > 0 ? 'text-slate-800' : 'text-slate-600'}`}>{t.lastPreview}</span>
                  {t.unreadCount > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold inline-flex items-center justify-center">
                      {t.unreadCount}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 mt-0.5 empty:hidden">
                  {/* A first contact nobody has answered yet. Goes once we reply,
                      or after a day either way. */}
                  {!t.answered && Date.now() - new Date(t.createdAt).getTime() < 86_400_000 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">New</span>
                  )}
                  {t.lead && (
                    <span className="text-xs text-slate-600 inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> Client
                    </span>
                  )}
                  {t.adId && (
                    <span className="text-xs text-slate-600 inline-flex items-center gap-1">
                      <Megaphone className="h-3 w-3" /> Ad
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">No conversation matches.</li>}
      </ul>
      </div>

      {/* Open thread */}
      <div
        className={`flex-col min-w-0 lg:min-h-0 ${openId ? 'flex fixed inset-x-0 top-0 z-40 h-[100dvh] bg-white pt-[env(safe-area-inset-top)] lg:static lg:z-auto lg:h-auto lg:pt-0' : 'hidden lg:flex'}`}
        style={phoneHeight ? { height: phoneHeight } : undefined}
      >
        {!openId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Select a conversation</div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            {/* One row on every screen: back, who, the assistant, and the rest
                in a menu. The ad's text truncates instead of pushing the
                buttons off the edge, as a long one used to. */}
            <div className="px-2 sm:px-4 py-2 border-b border-slate-200 flex items-center gap-1.5 sm:gap-2">
              <button onClick={closeThread} aria-label="Back to conversations" className="lg:hidden shrink-0 min-h-11 min-w-11 -ml-1 inline-flex items-center justify-center text-slate-600">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <ChannelIcon channel={detail.channel} className="h-5 w-5 shrink-0 hidden sm:block" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{threadName(detail)}</p>
                {detail.channel === 'WHATSAPP' && threadName(detail) !== `+${detail.externalId}` && (
                  <p className="text-xs text-slate-500 truncate">+{detail.externalId}</p>
                )}
                {detail.adId && (
                  <p className="text-xs text-slate-500 truncate" title={detail.adLabel ?? undefined}>
                    <Megaphone className="h-3 w-3 inline -mt-0.5 mr-1" />From an ad{detail.adLabel ? `: ${detail.adLabel}` : ''}
                  </p>
                )}
              </div>

              {detail.autoReplyOn && (
                <AssistantControl
                  thread={detail}
                  status={detail.autoReply}
                  canReply={detail.canReply}
                  onMode={setAssistantMode}
                  onReplyNow={replyNow}
                />
              )}

              {/* The everyday actions stay visible from sm up. */}
              <button
                onClick={() => setShowListings((v) => !v)}
                aria-label="Properties"
                className={`hidden sm:inline-flex shrink-0 min-h-11 px-3 rounded-lg text-sm font-medium items-center gap-1.5 border ${showListings ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <Building2 className="h-4 w-4" /> <span className="hidden xl:inline">Properties</span>
              </button>
              {detail.lead && (
                // Straight to their card on the board — where they stand, not just who they are.
                <Link href={`/admin/crm?focus=${detail.lead.id}`} aria-label="Show in pipeline" title="Show this client on the pipeline board"
                  className="hidden sm:inline-flex shrink-0 min-h-11 px-3 rounded-lg text-sm font-medium items-center gap-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50">
                  <LayoutGrid className="h-4 w-4" /> <span className="hidden xl:inline">Pipeline</span>
                </Link>
              )}
              {detail.lead && (
                <button onClick={() => onOpenLead(detail.lead!.id)} aria-label="Open client" className="hidden sm:inline-flex shrink-0 min-h-11 px-3 rounded-lg text-sm font-medium items-center gap-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50">
                  <User className="h-4 w-4" /> <span className="hidden xl:inline">Open client</span>
                </button>
              )}

              <div ref={menuRef} className="relative shrink-0">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="More actions"
                  aria-expanded={menuOpen}
                  className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-[60] w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" onClick={() => setMenuOpen(false)}>
                    <MenuItem className="sm:hidden" icon={Building2} onClick={() => setShowListings((v) => !v)}>
                      {showListings ? 'Hide properties' : 'Properties'}
                    </MenuItem>
                    {detail.lead ? (
                      <>
                        <MenuItem className="sm:hidden" icon={User} onClick={() => onOpenLead(detail.lead!.id)}>Open client</MenuItem>
                        <MenuItem className="sm:hidden" icon={LayoutGrid} onClick={() => { window.location.href = `/admin/crm?focus=${detail.lead!.id}` }}>Show in pipeline</MenuItem>
                      </>
                    ) : (
                      <>
                        <MenuItem icon={UserPlus} onClick={() => addAsClient()}>Add as client</MenuItem>
                        <MenuItem icon={Link2} onClick={() => setLinking(true)}>Link to a client</MenuItem>
                      </>
                    )}
                    <MenuItem icon={filter === 'archived' ? ArchiveRestore : Archive} onClick={() => archive(filter !== 'archived')}>
                      {filter === 'archived' ? 'Back to the inbox' : 'Archive'}
                    </MenuItem>
                    {canDelete && (
                      <MenuItem icon={Trash2} danger onClick={remove}>Delete conversation</MenuItem>
                    )}
                  </div>
                )}
              </div>
            </div>

            {linking && !detail.lead && (
              <div className="px-3 sm:px-4 py-3 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={linkQuery}
                    onChange={(e) => setLinkQuery(e.target.value)}
                    placeholder="Search existing clients by name or phone"
                    className="flex-1 min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button onClick={() => setLinking(false)} aria-label="Cancel" className="min-h-11 min-w-11 inline-flex items-center justify-center text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {linkResults.length > 0 && (
                  <ul className="mt-2 divide-y divide-slate-200 bg-white border border-slate-200 rounded-lg">
                    {linkResults.map((r) => (
                      <li key={r.id}>
                        <button onClick={() => addAsClient(r.id)} className="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-slate-50">
                          {r.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {linkQuery.trim().length >= 2 && linkResults.length === 0 && (
                  <p className="text-sm text-slate-500 mt-2">No client matches.</p>
                )}
              </div>
            )}

            {detail.suggestion && (
              <div className="px-3 sm:px-4 py-3 border-b border-slate-200">
                <ChatSuggestion
                  suggestion={detail.suggestion}
                  hasClient={Boolean(detail.lead)}
                  onResolved={(accepted) => {
                    loadDetail(detail.id)
                    loadThreads()
                    if (accepted) onChanged()
                  }}
                />
              </div>
            )}

            {/* The conversation, with matching properties beside it on a wide
                screen and in a short strip above it on a narrow one — never
                in place of it. */}
            <div className="flex-1 min-h-0 min-w-0 flex flex-col xl:flex-row-reverse">
            {showListings && (
              <ListingPicker
                // Re-fetch when what they want changes.
                key={`${detail.id}:${detail.suggestion?.id ?? ''}:${JSON.stringify(detail.suggestion?.patch ?? {})}`}
                conversationId={detail.id}
                canSend={detail.canReply}
                onSent={() => { loadDetail(detail.id); loadThreads() }}
                onClose={() => setShowListings(false)}
              />
            )}

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-4 space-y-2 bg-slate-100">
              {detail.hasEarlier && (
                <p className="text-center">
                  <button
                    onClick={() => { keepPosition.current = true; setTake((n) => n + 200) }}
                    className="min-h-9 px-3 rounded-full text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
                  >
                    Load earlier messages
                  </button>
                </p>
              )}
              {detail.messages.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-10">No messages in this conversation yet.</p>
              )}
              {detail.messages.map((m, i) => (
                <div key={m.id}>
                {(i === 0 || !sameDay(detail.messages[i - 1].sentAt, m.sentAt)) && (
                  <p className="text-center text-xs text-slate-500 my-3">
                    <span className="bg-white text-slate-700 rounded-full px-3 py-1 shadow-sm">{dayLabel(m.sentAt)}</span>
                  </p>
                )}
                <div className={`flex ${m.direction === 'OUT' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.direction === 'OUT' ? 'bg-emerald-100 text-slate-900' : 'bg-white text-slate-900 shadow-sm'}`}>
                    <Attachment message={m} />
                    {/* "[image]" is only a stand-in for an attachment we could not keep. */}
                    {!(m.mediaUrl && /^\[\w+\]$/.test(m.body)) && m.body}
                    {m.transcript && (
                      <span className="block text-sm italic mt-1 text-slate-700">
                        &ldquo;{m.transcript}&rdquo;
                      </span>
                    )}
                    <span className="flex items-center justify-end gap-1 text-[11px] mt-1 text-slate-600">
                      {m.direction === 'OUT' && m.origin && (
                        <>
                          {m.origin === 'AI' ? <Bot className="h-3 w-3" /> : m.origin === 'PHONE' ? <Smartphone className="h-3 w-3" /> : null}
                          {m.type === 'template' ? 'Follow-up' : ORIGIN_LABEL[m.origin] ?? m.origin} ·
                        </>
                      )}
                      {clockLabel(m.sentAt)}
                      {m.direction === 'OUT' && m.status && STATUS_LABEL[m.status] && (
                        <span className={m.status === 'failed' ? 'text-red-700 font-semibold' : ''}>· {STATUS_LABEL[m.status]}</span>
                      )}
                    </span>
                  </div>
                </div>
                </div>
              ))}
            </div>

            </div>

            {/* Clear of the home bar in the installed app. */}
            <div className="border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3 bg-white">
              {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
              {!detail.sendingConfigured ? (
                <p className="text-sm text-slate-500">
                  Replying from the CRM isn&apos;t set up for {detail.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} yet. Reply from the phone app — it will appear here.
                </p>
              ) : !detail.canReply ? (
                // WhatsApp's rule, not ours: past 24 hours since the client's
                // last message, the API only accepts paid, pre-approved
                // templates. The WhatsApp Business app on the phone has no such
                // limit — so the way out is one tap to that chat on the phone.
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 min-w-[200px] text-sm text-slate-600">
                    Over 24h since they last wrote — WhatsApp only allows the phone app, or a paid follow-up template.
                    {detail.followUp?.lastSentAt && (
                      <span className="block text-xs text-slate-500">Follow-up sent {dayLabel(detail.followUp.lastSentAt)} at {clockLabel(detail.followUp.lastSentAt)}.</span>
                    )}
                  </p>
                  {detail.followUp?.available && (
                    <button
                      onClick={sendFollowUp}
                      disabled={sending}
                      title={detail.followUp.preview}
                      className="shrink-0 min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send follow-up
                    </button>
                  )}
                  {detail.channel === 'WHATSAPP' && (
                    <a
                      href={`https://wa.me/${detail.externalId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 min-h-11 px-4 rounded-lg bg-emerald-600 text-white text-sm font-medium inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="h-4 w-4" /> Reply in WhatsApp
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends with a keyboard; on a phone Enter is a new
                      // line and the Send button sends.
                      const touch = window.matchMedia('(pointer: coarse)').matches
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    rows={2}
                    placeholder="Write a reply"
                    className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
