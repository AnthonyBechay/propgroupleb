'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, MessageCircle, UserPlus, EyeOff, Ban, Inbox, Check, ShieldOff,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { type LeadMarket, type LeadType, TYPE_LABELS } from './types'

/**
 * WhatsApp triage.
 *
 * A work number receives suppliers, family, wrong numbers and spam alongside
 * real enquiries. Nothing here is a client yet — the CRM only gains one when a
 * person says so. Messages from numbers already in the CRM never reach this
 * screen; they go straight onto that client's timeline.
 */

interface InboxMessage {
  id: string
  body: string
  receivedAt: string
}

interface Thread {
  waId: string
  profileName: string | null
  messages: InboxMessage[]
  latestAt: string
}

interface BlockedSender {
  id: string
  waId: string
  label: string | null
}

export function InboxView({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [threads, setThreads] = useState<Thread[]>([])
  const [blocked, setBlocked] = useState<BlockedSender[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [showBlocked, setShowBlocked] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inbox, blk] = await Promise.all([
        fetch(`${apiUrl}/api/crm/inbox`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/inbox/blocked`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (inbox.ok) setThreads((await inbox.json()).data?.threads ?? [])
      if (blk.ok) setBlocked((await blk.json()).data ?? [])
    } finally { setLoading(false) }
  }, [apiUrl])
  useEffect(() => { load() }, [load])

  async function triage(waId: string, body: Record<string, unknown>) {
    setBusy(waId)
    try {
      const res = await fetch(`${apiUrl}/api/crm/inbox/triage`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waId, ...body }),
      })
      if (res.ok) {
        const j = await res.json().catch(() => ({}))
        setAdding(null)
        await load()
        if (body.action === 'ADD' && j.data?.id) onOpenLead(j.data.id)
      }
    } finally { setBusy(null) }
  }

  async function unblock(waId: string) {
    await fetch(`${apiUrl}/api/crm/inbox/blocked/${waId}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          {threads.length === 0
            ? 'Nothing waiting.'
            : `${threads.length} number${threads.length === 1 ? '' : 's'} you don't have in the CRM yet.`}
        </p>
        {blocked.length > 0 && (
          <button
            onClick={() => setShowBlocked((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <Ban className="h-3.5 w-3.5" /> {blocked.length} muted
          </button>
        )}
      </div>

      {showBlocked && blocked.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-50">
          {blocked.map((b) => (
            <div key={b.id} className="flex items-center gap-2 px-3.5 py-2">
              <Ban className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-sm text-slate-700">+{b.waId}</span>
              {b.label && <span className="text-xs text-slate-400">{b.label}</span>}
              <button
                onClick={() => unblock(b.waId)}
                className="ml-auto text-xs text-slate-400 hover:text-slate-800 inline-flex items-center gap-1"
              >
                <ShieldOff className="h-3.5 w-3.5" /> Unmute
              </button>
            </div>
          ))}
        </div>
      )}

      {threads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Inbox className="h-10 w-10 mx-auto text-slate-200 mb-3" />
          <p className="font-semibold text-slate-800">Inbox clear</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Messages from numbers already in the CRM go straight onto that client&apos;s timeline.
            Only unrecognised numbers wait here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <div key={t.waId} className="bg-white border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-slate-900">
                      {t.profileName || `+${t.waId}`}
                    </span>
                    {t.profileName && <span className="text-xs text-slate-400">+{t.waId}</span>}
                    <span className="text-xs text-slate-400">
                      {new Date(t.latestAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {t.messages.length > 1 && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-px rounded">
                        {t.messages.length} messages
                      </span>
                    )}
                  </div>

                  <ol className="mt-2 space-y-1">
                    {t.messages.slice(0, 3).map((m) => (
                      <li key={m.id} className="text-sm text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap">
                        {m.body}
                      </li>
                    ))}
                    {t.messages.length > 3 && (
                      <li className="text-xs text-slate-400">…and {t.messages.length - 3} more</li>
                    )}
                  </ol>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={`https://wa.me/${t.waId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-slate-50"
                    title="Reply on WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => setAdding(adding === t.waId ? null : t.waId)}
                    disabled={busy === t.waId}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" /> Add as client
                  </button>
                  <button
                    onClick={() => triage(t.waId, { action: 'IGNORE' })}
                    disabled={busy === t.waId}
                    className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50"
                    title="Not business — dismiss"
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Mute +${t.waId}? Future messages from this number are dropped.`)) {
                        triage(t.waId, { action: 'BLOCK' })
                      }
                    }}
                    disabled={busy === t.waId}
                    className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Mute this number for good"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {adding === t.waId && (
                <AddForm
                  defaultName={t.profileName ?? ''}
                  busy={busy === t.waId}
                  onCancel={() => setAdding(null)}
                  onAdd={(body) => triage(t.waId, { action: 'ADD', ...body })}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** The minimum needed to open a client file — the rest is filled in later. */
function AddForm({
  defaultName, busy, onCancel, onAdd,
}: {
  defaultName: string
  busy: boolean
  onCancel: () => void
  onAdd: (body: { name: string; market: LeadMarket; type: LeadType }) => void
}) {
  const [name, setName] = useState(defaultName)
  const [market, setMarket] = useState<LeadMarket>('LEBANON')
  const [type, setType] = useState<LeadType>('BUYER')
  const inp = 'px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white'

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2">
      <label className="flex-1 min-w-[160px]">
        <span className="block text-[11px] text-slate-500 mb-1">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${inp} w-full`} placeholder="Client name" />
      </label>
      <label>
        <span className="block text-[11px] text-slate-500 mb-1">Market</span>
        <select value={market} onChange={(e) => setMarket(e.target.value as LeadMarket)} className={inp}>
          <option value="LEBANON">🇱🇧 Lebanon</option>
          <option value="GEORGIA">🇬🇪 Georgia</option>
        </select>
      </label>
      <label>
        <span className="block text-[11px] text-slate-500 mb-1">They are a</span>
        <select value={type} onChange={(e) => setType(e.target.value as LeadType)} className={inp}>
          {(Object.keys(TYPE_LABELS) as LeadType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </label>
      <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-500 rounded-lg hover:bg-slate-100">
        Cancel
      </button>
      <button
        onClick={() => onAdd({ name: name.trim() || `WhatsApp contact`, market, type })}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Add
      </button>
    </div>
  )
}
