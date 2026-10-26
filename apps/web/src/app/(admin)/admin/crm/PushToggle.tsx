'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * Chat notifications on this device.
 *
 * iPhone: only inside the app added to the Home Screen (Safari → Share → Add to
 * Home Screen), iOS 16.4 or later — Safari itself cannot receive them. Android:
 * Chrome, installed or not. The permission prompt can only follow a tap, so
 * nothing is asked until the button is pressed.
 */

type State = 'loading' | 'unsupported' | 'install-first' | 'blocked' | 'off' | 'on'
type Mode = 'all' | 'needs_you'

const SW_URL = '/inbox-sw.js'

function base64ToBytes(b64: string): Uint8Array {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/** Registers the worker; the inbox uses it to refresh the moment a push lands. */
export async function registerInboxWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: '/admin/' })
  } catch {
    return null
  }
}

export function PushToggle() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [state, setState] = useState<State>('loading')
  const [mode, setMode] = useState<Mode>('all')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const api = useCallback(
    (path: string, method: string, body?: unknown) =>
      fetch(`${apiUrl}/api/push${path}`, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      }),
    [apiUrl]
  )

  useEffect(() => {
    void (async () => {
      if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
        setState(isIos() && !isStandalone() ? 'install-first' : 'unsupported')
        return
      }
      if (Notification.permission === 'denied') { setState('blocked'); return }
      const reg = await registerInboxWorker()
      const sub = await reg?.pushManager.getSubscription()
      setState(sub && Notification.permission === 'granted' ? 'on' : 'off')
      try {
        const saved = localStorage.getItem('pg_push_mode')
        if (saved === 'all' || saved === 'needs_you') setMode(saved)
      } catch { /* keep the default */ }
    })()
  }, [])

  const subscribe = async (nextMode: Mode) => {
    setBusy(true)
    setNote(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return }
      const reg = await registerInboxWorker()
      if (!reg) { setState('unsupported'); return }
      await navigator.serviceWorker.ready
      const keyRes = await api('/key', 'GET')
      const { publicKey } = (await keyRes.json()).data
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToBytes(publicKey) as unknown as BufferSource,
        }))
      const res = await api('/subscribe', 'POST', { subscription: sub.toJSON(), mode: nextMode })
      if (!res.ok) throw new Error('save')
      setMode(nextMode)
      try { localStorage.setItem('pg_push_mode', nextMode) } catch { /* ignore */ }
      setState('on')
    } catch {
      setNote('Notifications could not be turned on. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/admin/')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await api('/subscribe', 'DELETE', { endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setState('off')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const res = await api('/test', 'POST')
      const sent = res.ok ? (await res.json()).data?.sent : 0
      setNote(sent ? 'Test sent — it should appear in a few seconds.' : 'This device is not registered. Turn notifications off and on again.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading') return null

  if (state === 'install-first' || state === 'unsupported' || state === 'blocked') {
    const text =
      state === 'install-first'
        ? 'For notifications on iPhone, open this page in Safari, tap Share → Add to Home Screen, then open the Inbox from the Home Screen.'
        : state === 'blocked'
          ? 'Notifications are blocked for this site. Allow them in the phone or browser settings.'
          : 'This browser cannot receive notifications.'
    return (
      <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-2 flex gap-2">
        <BellOff className="h-4 w-4 shrink-0 text-slate-400" /> {text}
      </p>
    )
  }

  if (state === 'off') {
    return (
      <div>
        <button onClick={() => subscribe(mode)} disabled={busy}
          className="w-full min-h-11 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Notify me on this device when a client writes
        </button>
        {note && <p className="text-xs text-red-700 mt-1">{note}</p>}
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full min-h-10 rounded-lg bg-emerald-50 text-emerald-800 text-sm font-medium inline-flex items-center gap-2 px-3">
        <BellRing className="h-4 w-4" />
        {mode === 'all' ? 'Notifying for every message' : 'Notifying only when you are needed'}
        <span className="ml-auto text-xs underline">Change</span>
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-slate-200 p-2 space-y-1.5">
          {([
            ['all', 'Every message', 'Each time a client writes, even if the assistant answers.'],
            ['needs_you', 'Only when I am needed', 'The assistant handed over, or it will not answer this one.'],
          ] as const).map(([value, title, hint]) => (
            <label key={value} className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="push-mode" checked={mode === value} disabled={busy}
                onChange={() => subscribe(value)} className="mt-1 h-4 w-4" />
              <span>
                <span className="block text-sm text-slate-900">{title}</span>
                <span className="block text-xs text-slate-600">{hint}</span>
              </span>
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={test} disabled={busy} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm">Send a test</button>
            <button onClick={unsubscribe} disabled={busy} className="min-h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-600">Turn off</button>
          </div>
        </div>
      )}
      {note && <p className="text-xs text-slate-700 mt-1">{note}</p>}
    </div>
  )
}
