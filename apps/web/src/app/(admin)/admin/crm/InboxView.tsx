'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Loader2, MessageCircle, Instagram, Send, ArrowLeft, UserPlus, User,
  Bot, Megaphone, Inbox, Smartphone, Link2, X, Building2, Search, Archive, ArchiveRestore, Trash2, MoreVertical, LayoutGrid, ArrowDown, WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { AssistantControl, type AssistantMode } from './AssistantControl'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { useAuth } from '@/contexts/AuthContext'
import { canDeleteConversations } from '@/lib/permissions'
import { ChatSuggestion, type Suggestion } from './ChatSuggestion'
import { ListingPicker } from './ListingPicker'
import { ClientMoveButton } from './ClientMove'
import type { LeadType } from './types'
import { PushToggle, registerInboxWorker } from './PushToggle'
import { reportProblem, watchForProblems } from '@/lib/utils/client-problems'

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
  market?: string | null
  type?: LeadType | null
  intents?: LeadType[] | null
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

/** A message on its way, or one that didn't make it. Kept apart from the thread so a poll can't wipe it. */
interface PendingMessage {
  id: string
  threadId: string
  text: string
  status: 'sending' | 'sent' | 'failed'
  error?: string
  /** A load started after this one was confirmed contains it, and replaces it. */
  confirmedAt?: number
}

/** How often an open inbox asks for new messages. */
const POLL_MS = 6_000
/** A request on bad signal gives up after this, so nothing spins for ever. */
const REQUEST_TIMEOUT_MS = 20_000
/** Closer than this to the end of a chat counts as reading the newest message. */
const PINNED_WITHIN_PX = 80
/** Chats kept in memory, so going back into one is instant. */
const CACHED_THREADS = 10

const readDraft = (id: string) => {
  try { return localStorage.getItem(`inbox-draft:${id}`) ?? '' } catch { return '' }
}
const saveDraft = (id: string, text: string) => {
  try {
    if (text) localStorage.setItem(`inbox-draft:${id}`, text)
    else localStorage.removeItem(`inbox-draft:${id}`)
  } catch { /* private mode: the draft just doesn't outlive the page */ }
}

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
        <img src={url} alt="Attachment" loading="lazy" decoding="async" className="rounded-lg max-h-64 max-w-full mb-1" />
      </a>
    )
  }
  // Nothing downloads until it is played: a long chat holds dozens of these, and
  // iOS restarts a page that runs out of memory — a white screen, to whoever is using it.
  if (message.type === 'audio') return <audio controls preload="none" src={url} className="max-w-full mb-1" />
  if (message.type === 'video') return <video controls preload="none" playsInline src={url} className="rounded-lg max-h-64 max-w-full mb-1" />
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
  // Which chat is open right now, for an answer that arrives after it was left.
  const openRef = useRef<string | null>(null)
  openRef.current = openId
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (backTimer.current) return // already on its way back; a second Back would leave the inbox
    // The keyboard going away with the chat can leave iOS's page shifted, showing blank space.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const leaveChat = () => {
      backTimer.current = null
      const url = new URL(window.location.href)
      url.searchParams.delete('c')
      window.history.replaceState(null, '', url)
      setOpenId(null)
    }
    if (window.history.state?.inboxThread) {
      window.history.back() // popstate below clears it
      // An app reopened by iOS can keep this step but not the one before it, and
      // Back then goes nowhere. The chat still has to close.
      backTimer.current = setTimeout(leaveChat, 500)
      return
    }
    leaveChat()
  }, [])
  const shellRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fromUrl = () => {
      if (backTimer.current) { clearTimeout(backTimer.current); backTimer.current = null }
      setOpenId(new URL(window.location.href).searchParams.get('c'))
    }
    // A chat opened directly (from a notification, or the app reopening on it)
    // has nothing behind it, so a swipe back would leave the inbox altogether or
    // go nowhere. Put the list behind it, so Back always lands on the list.
    const here = new URL(window.location.href)
    const direct = here.searchParams.get('c')
    if (direct && !window.history.state?.inboxThread) {
      const list = new URL(here)
      list.searchParams.delete('c')
      window.history.replaceState(window.history.state, '', list)
      window.history.pushState({ inboxThread: direct }, '', here)
    }
    fromUrl()
    const onBack = () => {
      // The keyboard must go with the chat, or iOS can leave the page shifted.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      fromUrl()
      const vv = window.visualViewport
      if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' })
      // If the white screen ever returns, this says what state the page was in.
      if (vv && vv.scale > 1.01) reportProblem('back-zoomed', `Back while zoomed: scale ${vv.scale.toFixed(2)}`)
      // After the swipe iOS can keep showing a stale layer instead of the page.
      // One frame of a new compositing layer makes it paint the real thing.
      const shell = shellRef.current
      if (shell) {
        shell.style.opacity = '0.999'
        requestAnimationFrame(() => requestAnimationFrame(() => { shell.style.opacity = '' }))
      }
    }
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [])
  useEffect(() => watchForProblems(), [])
  const [detail, setDetail] = useState<ThreadDetail | null>(null)
  // The open chat could not be loaded, as opposed to still being on its way.
  const [detailFailed, setDetailFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<PendingMessage[]>([])
  // One at a time and in order, however fast they are typed.
  const sendChain = useRef<Promise<unknown>>(Promise.resolve())
  const composerRef = useRef<HTMLTextAreaElement>(null)
  // The follow-up template, which is paid and asked for one at a time.
  const [sending, setSending] = useState(false)
  // The last request failed for want of signal. What's on screen stays, and says so.
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // Searched on the server, so it reaches every thread, not just the newest 100.
  const [search, setSearch] = useState('')
  // Asked for once typing pauses, not on every letter.
  const [needle, setNeedle] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])
  const { user } = useAuth()
  const canDelete = canDeleteConversations(user?.role)
  // How many of the thread's latest messages are loaded.
  const [take, setTake] = useState(100)
  // Loading earlier messages grows the thread upwards. This holds the height it
  // had, so the message being read stays where it was.
  const anchorHeight = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Reading the newest message: new ones, the keyboard and photos finishing
  // loading all keep it in view. Scrolled up to read, nothing moves the chat.
  const pinned = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const toBottom = useCallback(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
    pinned.current = true
    setShowJump(false)
  }, [])
  // Opening a chat you were just in shows it at once and updates it behind.
  const detailCache = useRef(new Map<string, ThreadDetail>())
  const detailSeq = useRef(0)
  const threadsSeq = useRef(0)
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
    // pointerdown: iOS sends no mousedown for a tap on the chat itself.
    const onDown = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const call = useCallback(
    async (path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) => {
      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), timeoutMs)
      try {
        return await fetch(`${apiUrl}/api/crm/inbox${path}`, {
          credentials: 'include',
          cache: 'no-store',
          ...init,
          signal: abort.signal,
          headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
        })
      } finally {
        clearTimeout(timer)
      }
    },
    [apiUrl]
  )

  // The session ran out. These calls are not the ones the sign-in check watches,
  // so nothing else would notice: reloading lets that check send them to log in.
  const signedOut = useCallback(() => {
    try {
      if (Date.now() - Number(sessionStorage.getItem('inboxSignedOutAt') ?? 0) < 60_000) return
      sessionStorage.setItem('inboxSignedOutAt', String(Date.now()))
    } catch {
      return
    }
    window.location.reload()
  }, [])

  // The server searches every thread; the list itself only holds the newest 100.
  const loadThreads = useCallback(async () => {
    const seq = ++threadsSeq.current
    const p = new URLSearchParams({ limit: '100' })
    if (needle) p.set('search', needle)
    if (filter === 'unread') p.set('unread', 'true')
    else if (filter === 'archived') p.set('archived', 'true')
    else if (filter !== 'all') p.set('channel', filter)
    try {
      const res = await call(`?${p}`)
      if (res.status === 401) signedOut()
      const data = res.ok ? (await res.json()).data ?? [] : null
      // A slow answer to an older search must not replace a newer one.
      if (seq !== threadsSeq.current) return
      setOffline(false)
      setThreads((t) => data ?? t ?? [])
    } catch {
      // No signal, or the phone has only just woken the app. The next poll tries again.
      if (seq !== threadsSeq.current) return
      setOffline(true)
      setThreads((t) => t ?? [])
    }
  }, [call, needle, filter, signedOut])

  const loadDetail = useCallback(async (id: string) => {
    const seq = ++detailSeq.current
    let data: ThreadDetail | null
    try {
      const res = await call(`/${id}?take=${take}`)
      // Left while this was on its way: it must not reappear, or close the wrong chat.
      if (openRef.current !== id || seq !== detailSeq.current) return
      // Deleted — usually on another phone. Close it, or this screen asks for it
      // every few seconds for as long as it stays open.
      if (res.status === 404) { closeThread(); return }
      if (res.status === 401) { signedOut(); return }
      if (!res.ok) { setDetailFailed(true); return }
      data = (await res.json()).data ?? null
      // An older answer arriving after a newer one would put the chat back in time.
      if (openRef.current !== id || seq !== detailSeq.current) return
    } catch {
      // No signal. What is on screen stays; an empty chat says so instead of spinning.
      if (openRef.current === id && seq === detailSeq.current) { setDetailFailed(true); setOffline(true) }
      return
    }
    setDetail(data)
    setDetailFailed(false)
    setOffline(false)
    if (data) {
      detailCache.current.delete(id)
      detailCache.current.set(id, data)
      if (detailCache.current.size > CACHED_THREADS) {
        detailCache.current.delete(detailCache.current.keys().next().value as string)
      }
    }
    // Sent messages this answer already contains are now the real ones.
    setPending((list) => {
      const next = list.filter((m) => !(m.threadId === id && m.status === 'sent' && (m.confirmedAt ?? seq) < seq))
      return next.length === list.length ? list : next
    })
    // A message that arrives while the thread is on screen has been read; one
    // that arrives in a tab nobody is looking at has not.
    if (data && data.unreadCount > 0 && document.visibilityState === 'visible') {
      setThreads((list) => list?.map((t) => (t.id === id ? { ...t, unreadCount: 0 } : t)) ?? list)
      call(`/${id}/read`, { method: 'POST' }).catch(() => {})
    }
  }, [call, take, closeThread, signedOut])

  useEffect(() => {
    loadThreads()
    const timer = setInterval(() => { if (document.visibilityState === 'visible') loadThreads() }, POLL_MS)
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
    // Coming back to a page iOS kept frozen fires this, not visibilitychange.
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [loadThreads, loadDetail, openId])

  // A push arriving while the inbox is open: show it now, not at the next poll.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    void registerInboxWorker()
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open-thread') {
        // A tap on a notification with the app already open.
        const id = new URL(e.data.url, window.location.origin).searchParams.get('c')
        if (id) openThread(id)
        return
      }
      if (e.data?.type !== 'inbox-update') return
      loadThreads()
      if (openId) loadDetail(openId)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [loadThreads, loadDetail, openId, openThread])

  const [isPhone, setIsPhone] = useState(false)
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 1023px)')
    const update = () => setIsPhone(phone.matches)
    update()
    phone.addEventListener('change', update)
    return () => phone.removeEventListener('change', update)
  }, [])

  // On a phone the inbox is an app screen, not a web page: the list and the chat
  // each scroll inside themselves and the page itself never moves. A page that
  // can scroll is what iOS leaves shifted when the keyboard goes, and what shows
  // white and stuck after a swipe back.
  useEffect(() => {
    if (!isPhone) return
    const root = document.documentElement
    const previous = root.style.overscrollBehavior
    root.style.overscrollBehavior = 'none'
    const vv = window.visualViewport
    const settle = () => { if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: 'instant' }) }
    vv?.addEventListener('resize', settle)
    return () => {
      root.style.overscrollBehavior = previous
      vv?.removeEventListener('resize', settle)
    }
  }, [isPhone])

  // An open conversation fills what the keyboard leaves visible: iOS does not
  // shrink 100dvh for it, and slides the visible area down inside the page as
  // well, so both the height and the top have to follow. Written straight to the
  // element, because this fires on every frame of the keyboard moving.
  const paneRef = useRef<HTMLDivElement>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const shellReady = threads !== null
  useEffect(() => {
    const pane = paneRef.current
    if (!openId || !isPhone || !pane) { setKeyboardOpen(false); return }
    const vv = window.visualViewport
    const fit = () => {
      // Pinched in on purpose: the visible area is small because of the zoom,
      // not the keyboard, and the chat must not shrink to match it.
      if (vv && vv.scale > 1.01) return
      const height = vv ? vv.height : window.innerHeight
      pane.style.height = `${height}px`
      pane.style.top = `${vv ? vv.offsetTop : 0}px`
      setKeyboardOpen(window.innerHeight - height > 120)
      // Not left to the resize observer below: the newest message should ride up
      // with the keyboard, not catch up a frame later.
      const thread = scrollRef.current
      if (thread && pinned.current) thread.scrollTop = thread.scrollHeight
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      pane.style.height = ''
      pane.style.top = ''
    }
  }, [openId, isPhone, shellReady])

  useEffect(() => {
    setDetail(openId ? detailCache.current.get(openId) ?? null : null)
    setDetailFailed(false)
    setDraft(openId ? readDraft(openId) : '')
    pinned.current = true
    setShowJump(false)
    anchorHeight.current = null
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

  // Keep the newest message in view by scrolling the thread itself, before the
  // screen paints, so a new message or an opened chat never visibly jumps.
  const threadPending = pending.filter((m) => m.threadId === openId)
  const shownId = detail?.id ?? null
  const messageCount = (detail?.messages.length ?? 0) + threadPending.length
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (anchorHeight.current !== null) {
      el.scrollTop += el.scrollHeight - anchorHeight.current
      anchorHeight.current = null
      return
    }
    if (pinned.current) el.scrollTop = el.scrollHeight
    else setShowJump(true)
  }, [messageCount, shownId])

  // The keyboard opening, the reply box growing and photos finishing loading all
  // change the sizes without changing the messages.
  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { if (pinned.current) el.scrollTop = el.scrollHeight })
    observer.observe(el)
    observer.observe(content)
    return () => observer.disconnect()
  }, [shownId])

  const onThreadScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < PINNED_WITHIN_PX
    pinned.current = near
    if (near) setShowJump(false)
  }

  // The reply box grows with what is written, up to a few lines, then scrolls.
  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 132)}px`
  }, [draft, shownId])

  const editDraft = (text: string) => {
    setDraft(text)
    if (openId) saveDraft(openId, text)
  }

  const deliver = useCallback((message: PendingMessage) => {
    sendChain.current = sendChain.current.then(async () => {
      const update = (patch: Partial<PendingMessage>) =>
        setPending((list) => list.map((m) => (m.id === message.id ? { ...m, ...patch } : m)))
      update({ status: 'sending', error: undefined })
      try {
        const res = await call(`/${message.threadId}/reply`, { method: 'POST', body: JSON.stringify({ text: message.text }) }, 30_000)
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          update({ status: 'failed', error: body?.message || body?.error || 'Not sent.' })
          return
        }
        setOffline(false)
        update({ status: 'sent', confirmedAt: detailSeq.current })
        if (openRef.current === message.threadId) await loadDetail(message.threadId)
        await loadThreads()
      } catch (e) {
        // Timed out: the server may have taken it even though no answer came back.
        const timedOut = e instanceof DOMException && e.name === 'AbortError'
        update({ status: 'failed', error: timedOut ? 'No answer in time. Check it did not arrive before trying again.' : 'No connection. Not sent.' })
      }
    })
  }, [call, loadDetail, loadThreads])

  const send = () => {
    if (!openId || !draft.trim()) return
    const message: PendingMessage = { id: `pending-${Date.now()}`, threadId: openId, text: draft, status: 'sending' }
    editDraft('')
    setError(null)
    // Your own message always comes into view.
    pinned.current = true
    setPending((list) => [...list, message])
    deliver(message)
    composerRef.current?.focus()
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
    } catch {
      setError('No connection. The follow-up was not sent.')
    } finally { setSending(false) }
  }

  const addAsClient = async (leadId?: string) => {
    if (!openId) return
    try {
      const res = await call(`/${openId}/lead`, { method: 'POST', body: JSON.stringify(leadId ? { leadId } : {}) })
      if (!res.ok) { setError('The client could not be saved.'); return }
      setLinking(false)
      setLinkQuery('')
      await Promise.all([loadDetail(openId), loadThreads()])
      onChanged()
    } catch {
      setError('No connection. The client was not saved.')
    }
  }

  useEffect(() => {
    const q = linkQuery.trim()
    if (!linking || q.length < 2) { setLinkResults([]); return }
    const timer = setTimeout(async () => {
      const p = new URLSearchParams({ search: q, limit: '8' })
      try {
        const res = await fetch(`${apiUrl}/api/crm?${p}`, { credentials: 'include', cache: 'no-store' })
        if (res.ok) setLinkResults((await res.json()).data ?? [])
      } catch { /* no signal: the list stays as it was */ }
    }, 250)
    return () => clearTimeout(timer)
  }, [linking, linkQuery, apiUrl])

  const archive = async (archived: boolean) => {
    if (!detail) return
    try {
      const res = await call(`/${detail.id}/archive`, { method: 'POST', body: JSON.stringify({ archived }) })
      if (!res.ok) { setError('That did not work. Try again.'); return }
      closeThread()
      loadThreads()
    } catch {
      setError('No connection. Nothing was changed.')
    }
  }

  const remove = async () => {
    if (!detail) return
    const sure = window.confirm(
      `Delete this conversation with ${threadName(detail)} from the CRM?\n\nIts messages, transcripts, photos and voice notes are removed for good. The client record and the chat on your phone stay.`
    )
    if (!sure) return
    try {
      const res = await call(`/${detail.id}`, { method: 'DELETE' })
      if (!res.ok) { setError('The conversation was not deleted.'); return }
      detailCache.current.delete(detail.id)
      closeThread()
      loadThreads()
    } catch {
      setError('No connection. The conversation was not deleted.')
    }
  }

  const replyNow = async (): Promise<string> => {
    if (!detail) return ''
    try {
      // The assistant can take a while to think.
      const res = await call(`/${detail.id}/ai-reply`, { method: 'POST' }, 90_000)
      const outcome = res.ok ? (await res.json()).data : null
      await Promise.all([loadDetail(detail.id), loadThreads()])
      return outcome ? outcome.reason : 'The assistant could not be reached.'
    } catch {
      return 'The assistant could not be reached.'
    }
  }

  const setAssistantMode = async (mode: AssistantMode) => {
    if (!detail) return
    try {
      const res = await call(`/${detail.id}`, { method: 'PATCH', body: JSON.stringify({ mode }) })
      if (res.ok) await loadDetail(detail.id)
      else setError('The assistant setting was not changed.')
    } catch {
      setError('No connection. The assistant setting was not changed.')
    }
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

  // Never while a chat is open: an app waking with no signal gets an empty list
  // for a moment, and that must not close the chat it was showing.
  if (threads.length === 0 && !needle && filter === 'all' && !openId) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        {offline ? <WifiOff className="h-12 w-12 mx-auto text-slate-300 mb-3" /> : <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-3" />}
        <p className="font-semibold text-slate-800">{offline ? 'No connection.' : 'No conversations yet.'}</p>
        <p className="text-sm text-slate-500 mt-1">
          {offline ? 'Your conversations will appear when the connection is back.' : 'WhatsApp and Instagram messages appear here once the accounts are connected.'}
        </p>
      </div>
    )
  }

  const visible = threads
  const openThreadRow = threads.find((t) => t.id === openId)

  return (
    // Sized to the space under the top bar (4rem) and the page's padding, so the
    // page itself has nothing to scroll.
    <div ref={shellRef} className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col lg:grid lg:grid-cols-[360px_minmax(0,1fr)] ${fill ? 'h-[calc(100dvh-6rem)] sm:h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-9rem)]' : 'h-[70vh]'}`}>
      {/* Threads. On a phone the open chat lies over this rather than replacing
          it: the list keeps its place, and is what's there the moment a swipe
          back begins. `inert` so the keyboard's arrows can't wander into it. */}
      <div inert={isPhone && Boolean(openId)} className="flex-1 min-h-0 flex flex-col lg:border-r lg:border-slate-200">
      <div className="p-2 pb-1.5 border-b border-slate-200 space-y-1.5">
      {offline && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5 shrink-0" /> No connection. Trying again…
        </p>
      )}
      <PushToggle compact />
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
      <ul className="divide-y divide-slate-100 overflow-y-auto overscroll-contain flex-1 min-h-0 pb-[env(safe-area-inset-bottom)]">
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
        ref={paneRef}
        className={`flex-col min-w-0 lg:min-h-0 ${openId ? 'flex fixed inset-x-0 top-0 z-40 h-[100dvh] bg-white pt-[env(safe-area-inset-top)] lg:static lg:z-auto lg:h-auto lg:pt-0' : 'hidden lg:flex'}`}
      >
        {!openId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Select a conversation</div>
        ) : !detail ? (
          // Full screen on a phone, so never without a way out: a chat that is
          // slow or fails to load used to be a white page with no Back.
          <>
            <div className="lg:hidden px-2 py-2 border-b border-slate-200 flex items-center gap-1.5">
              <button onClick={closeThread} aria-label="Back to conversations" className="shrink-0 min-h-11 min-w-11 -ml-1 inline-flex items-center justify-center text-slate-600">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <p className="font-semibold text-slate-900 truncate">{openThreadRow ? threadName(openThreadRow) : 'Conversation'}</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              {detailFailed ? (
                <>
                  <p className="text-sm">This conversation didn&apos;t load. Check your connection.</p>
                  <button onClick={() => loadDetail(openId)} className="min-h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Try again</button>
                </>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              )}
            </div>
          </>
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

              {/* Where they stand, changed right here: reading the chat to remember
                  what happened and then hunting for the card on the board was the
                  whole round trip this saves. The same menu as the board's cards. */}
              {detail.lead && (
                <div className="shrink-0">
                  <ClientMoveButton
                    lead={detail.lead}
                    buttonClassName="min-h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                    onMoved={(to) => {
                      // Noise also archives the chat: it leaves the inbox like Archive does.
                      if (to === 'NOISE') { closeThread(); loadThreads() }
                      else { void loadDetail(detail.id); loadThreads() }
                      onChanged()
                    }}
                  />
                </div>
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

            {/* While typing on a phone there is little height left; it comes back
                with the keyboard's going. */}
            {detail.suggestion && !keyboardOpen && (
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

            <div className="relative flex-1 min-h-0 min-w-0 flex flex-col">
            <div ref={scrollRef} onScroll={onThreadScroll} className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-100">
            <div ref={contentRef} className="px-3 sm:px-4 py-4 space-y-2">
              {detail.hasEarlier && (
                <p className="text-center">
                  <button
                    onClick={() => { anchorHeight.current = scrollRef.current?.scrollHeight ?? null; setTake((n) => n + 200) }}
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
              {threadPending.map((m) => (
                <div key={m.id} className="flex justify-end">
                  <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words text-slate-900 ${m.status === 'failed' ? 'bg-red-50 border border-red-200' : 'bg-emerald-100'}`}>
                    {m.text}
                    {m.status === 'failed' ? (
                      <span className="block mt-1.5 text-xs text-red-800">
                        {m.error}
                        <span className="flex gap-1 mt-1 -mb-1">
                          <button onClick={() => deliver(m)} className="min-h-9 px-2.5 rounded-lg bg-white border border-red-200 font-semibold">Try again</button>
                          <button onClick={() => setPending((list) => list.filter((x) => x.id !== m.id))} className="min-h-9 px-2.5 rounded-lg font-medium">Remove</button>
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-1 text-[11px] mt-1 text-slate-600">
                        <Loader2 className="h-3 w-3 animate-spin" /> Sending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
            {showJump && (
              <button onClick={toBottom} aria-label="Go to the newest message" className="absolute right-3 bottom-3 h-11 w-11 rounded-full bg-white border border-slate-200 shadow-md inline-flex items-center justify-center text-slate-700">
                <ArrowDown className="h-5 w-5" />
              </button>
            )}
            </div>

            </div>

            {/* Clear of the home bar in the installed app. */}
            <div className={`border-t border-slate-200 bg-white ${keyboardOpen ? 'p-2' : 'p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3'}`}>
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
                    ref={composerRef}
                    value={draft}
                    onChange={(e) => editDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends with a keyboard; on a phone Enter is a new
                      // line and the Send button sends.
                      const touch = window.matchMedia('(pointer: coarse)').matches
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    rows={1}
                    placeholder="Write a reply"
                    autoCapitalize="sentences"
                    className="flex-1 min-w-0 min-h-11 max-h-[132px] resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                  <button
                    // Tapping Send must not take the focus off the reply box, or
                    // the keyboard drops after every message.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={send}
                    disabled={!draft.trim()}
                    aria-label="Send"
                    className="min-h-11 min-w-11 px-3 sm:px-4 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" /> <span className="hidden sm:inline">Send</span>
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
