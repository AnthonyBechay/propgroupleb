'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, MessageCircle, Instagram, Send, ArrowLeft, UserPlus, User,
  Bot, Megaphone, Inbox, Smartphone, Link2, X, Building2,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
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
  lastPreview: string | null
  unreadCount: number
  aiPaused: boolean
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
  /** What the chat assistant understood they want, waiting for a decision. */
  suggestion: Suggestion | null
  /** The thread has older messages than the ones loaded. */
  hasEarlier: boolean
  sendingConfigured: boolean
  autoReplyOn: boolean
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

type Filter = 'all' | 'unread' | 'WHATSAPP' | 'INSTAGRAM'
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'WHATSAPP', label: 'WhatsApp' },
  { key: 'INSTAGRAM', label: 'Instagram' },
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

export function InboxView({
  search,
  onOpenLead,
  onChanged,
  focusLeadId,
}: {
  /** Open this client's conversation, when the page was sent here from their drawer. */
  focusLeadId?: string | null
  /** The page's single search box. The inbox doesn't own one. */
  search: string
  onOpenLead: (id: string) => void
  /** A client was created or linked — the page should reload its client list. */
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
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

  useEffect(() => {
    setDetail(null)
    setDraft('')
    setError(null)
    setLinking(false)
    setLinkQuery('')
    setShowListings(false)
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

  const toggleAi = async () => {
    if (!detail) return
    const res = await call(`/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ aiPaused: !detail.aiPaused }) })
    if (res.ok) loadDetail(detail.id)
  }

  // Arriving from a client's drawer: go straight to their thread.
  useEffect(() => {
    if (!focusLeadId || !threads) return
    const theirs = threads.find((t) => t.lead?.id === focusLeadId)
    if (theirs) setOpenId(theirs.id)
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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden lg:grid lg:grid-cols-[340px_1fr] lg:h-[70vh]">
      {/* Threads — below lg, one pane at a time */}
      <div className={`lg:border-r lg:border-slate-200 lg:flex lg:flex-col lg:min-h-0 ${openId ? 'hidden lg:flex' : ''}`}>
      <div className="flex gap-1 p-2 border-b border-slate-200 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-9 px-3 rounded-full text-sm font-medium whitespace-nowrap ${filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-slate-100 overflow-y-auto lg:flex-1">
        {visible.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => setOpenId(t.id)}
              className={`w-full min-h-11 text-left px-4 py-3 flex gap-3 hover:bg-slate-50 ${openId === t.id ? 'bg-slate-100' : t.unreadCount > 0 ? 'bg-emerald-50/60' : ''}`}
            >
              <ChannelIcon channel={t.channel} className="h-5 w-5 mt-0.5 shrink-0" />
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
                  {/* First wrote in the last day, and nobody has decided who they are yet. */}
                  {!t.lead && Date.now() - new Date(t.createdAt).getTime() < 86_400_000 && (
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
      <div className={`flex-col min-h-[60vh] lg:min-h-0 ${openId ? 'flex' : 'hidden lg:flex'}`}>
        {!openId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Select a conversation</div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <div className="px-3 sm:px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 flex-wrap">
              <button onClick={() => setOpenId(null)} aria-label="Back to conversations" className="lg:hidden min-h-11 min-w-11 inline-flex items-center justify-center text-slate-600">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <ChannelIcon channel={detail.channel} className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 truncate">{threadName(detail)}</p>
                {detail.channel === 'WHATSAPP' && threadName(detail) !== `+${detail.externalId}` && (
                  <p className="text-xs text-slate-500">+{detail.externalId}</p>
                )}
                {detail.adId && (
                  <p className="text-xs text-slate-500 truncate inline-flex items-center gap-1">
                    <Megaphone className="h-3 w-3" /> From an ad{detail.adLabel ? `: ${detail.adLabel}` : ''}
                  </p>
                )}
              </div>
              {detail.autoReplyOn && (
                <button
                  onClick={toggleAi}
                  title={detail.aiPaused ? 'Auto-reply is paused on this conversation' : 'Auto-reply may answer this conversation'}
                  className={`min-h-11 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border ${detail.aiPaused ? 'border-slate-200 text-slate-500' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
                >
                  <Bot className="h-4 w-4" /> {detail.aiPaused ? 'Auto-reply off' : 'Auto-reply on'}
                </button>
              )}
              <button
                onClick={() => setShowListings((v) => !v)}
                className={`min-h-11 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border ${showListings ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <Building2 className="h-4 w-4" /> Properties
              </button>
              {detail.lead ? (
                <button onClick={() => onOpenLead(detail.lead!.id)} className="min-h-11 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50">
                  <User className="h-4 w-4" /> Open client
                </button>
              ) : (
                <>
                  <button onClick={() => setLinking((v) => !v)} className="min-h-11 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <Link2 className="h-4 w-4" /> Link to client
                  </button>
                  <button onClick={() => addAsClient()} className="min-h-11 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800">
                    <UserPlus className="h-4 w-4" /> Add as client
                  </button>
                </>
              )}
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

            {showListings && (
              <ListingPicker
                // Re-fetch when what they want changes.
                key={`${detail.id}:${detail.suggestion?.id ?? ''}:${JSON.stringify(detail.suggestion?.patch ?? {})}`}
                conversationId={detail.id}
                canSend={detail.canReply}
                onSent={() => { loadDetail(detail.id); loadThreads() }}
              />
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-2 bg-slate-100 max-h-[55vh] lg:max-h-none">
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
                          {ORIGIN_LABEL[m.origin] ?? m.origin} ·
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

            <div className="border-t border-slate-200 p-3">
              {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
              {!detail.sendingConfigured ? (
                <p className="text-sm text-slate-500">
                  Replying from the CRM isn&apos;t set up for {detail.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} yet. Reply from the phone app — it will appear here.
                </p>
              ) : !detail.canReply ? (
                <p className="text-sm text-slate-500">
                  More than 24 hours since their last message, so only the phone app can reply. It will appear here.
                </p>
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
