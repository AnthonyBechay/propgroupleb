'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Pencil, Trash2, X, Check, Handshake } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/admin/ui/layout'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface Broker {
  id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  sharePct: number
  notes: string | null
  active: boolean
  deals: number
  owedUsd: number
  earnedUsd: number
}

type Draft = { name: string; phone: string; email: string; company: string; sharePct: string; notes: string; active: boolean }
const EMPTY: Draft = { name: '', phone: '', email: '', company: '', sharePct: '50', notes: '', active: true }

const inp = 'mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
const money = (n: number) => `$${Math.round(n).toLocaleString()}`

/**
 * Outside brokers we split commission with. Each has a usual share of OUR
 * commission; picking them on a deal copies it there, where it can be changed
 * for that deal alone.
 */
export default function BrokersPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [brokers, setBrokers] = useState<Broker[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/finance/brokers`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error()
      setBrokers((await res.json()).data ?? [])
    } catch {
      setError('Could not load the brokers.')
      setBrokers([])
    }
  }, [apiUrl])
  useEffect(() => { void load() }, [load])

  const startEdit = (b?: Broker) => {
    setError(null)
    setEditing(b ? b.id : 'new')
    setDraft(b
      ? { name: b.name, phone: b.phone ?? '', email: b.email ?? '', company: b.company ?? '', sharePct: String(b.sharePct), notes: b.notes ?? '', active: b.active }
      : EMPTY)
  }

  async function save() {
    if (!draft.name.trim()) { setError('Give the broker a name.'); return }
    setBusy(true); setError(null)
    try {
      const body = {
        name: draft.name.trim(), phone: draft.phone.trim() || null, email: draft.email.trim() || null,
        company: draft.company.trim() || null, sharePct: Number(draft.sharePct || 0), notes: draft.notes.trim() || null,
        active: draft.active,
      }
      const res = await fetch(`${apiUrl}/api/finance/brokers${editing === 'new' ? '' : `/${editing}`}`, {
        method: editing === 'new' ? 'POST' : 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setEditing(null)
      await load()
    } catch {
      setError('That did not save. Check the email and that the share is between 0 and 100.')
    } finally { setBusy(false) }
  }

  async function remove(b: Broker) {
    const msg = b.deals > 0
      ? `${b.name} is on ${b.deals} deal${b.deals === 1 ? '' : 's'}, so they will be marked inactive instead of deleted — what they were owed stays on record.`
      : `Delete ${b.name}?`
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/finance/brokers/${b.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError('That did not work. Try again.')
    } finally { setBusy(false) }
  }

  const form = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-700">Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inp} autoFocus /></label>
        <label className="block text-sm text-slate-700">Company<input value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} className={inp} /></label>
        <label className="block text-sm text-slate-700">Phone<input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className={inp} /></label>
        <label className="block text-sm text-slate-700">Email<input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inp} /></label>
        <label className="block text-sm text-slate-700">
          Their share of our commission, %
          <input type="number" min="0" max="100" step="1" inputMode="decimal" value={draft.sharePct} onChange={(e) => setDraft({ ...draft, sharePct: e.target.value })} className={inp} />
          <span className="mt-1 block text-xs text-slate-500">50 = they get half of what we earn on the deal.</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:mt-7">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="h-4 w-4" />
          Active — offered on new deals
        </label>
      </div>
      <label className="block text-sm text-slate-700">Notes<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} className={`${inp} py-2`} /></label>
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Cancel</button>
        <button onClick={save} disabled={busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader
        title="Brokers"
        description="Brokers and agents we share commission with. Pick one on a deal and their share comes off our commission."
        actions={editing === null && (
          <button onClick={() => startEdit()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Add broker
          </button>
        )}
      />

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {editing === 'new' && form}

      {brokers === null ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : brokers.length === 0 && editing !== 'new' ? (
        <EmptyState icon={<Handshake className="h-8 w-8" />} title="No brokers yet" description="Add the brokers and agents you split deals with, and their usual share." />
      ) : (
        <ul className="space-y-2">
          {brokers.map((b) => (
            <li key={b.id}>
              {editing === b.id ? form : (
                <div className={`flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 ${b.active ? '' : 'opacity-60'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {b.name}{b.company && <span className="font-normal text-slate-500"> · {b.company}</span>}
                      {!b.active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Inactive</span>}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {b.sharePct}% of our commission{[b.phone, b.email].filter(Boolean).length > 0 && ` · ${[b.phone, b.email].filter(Boolean).join(' · ')}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {b.deals} deal{b.deals === 1 ? '' : 's'} · {money(b.earnedUsd)} their share in all
                      {b.owedUsd > 0 && <span className="font-medium text-amber-700"> · {money(b.owedUsd)} on deals we have not been paid for yet</span>}
                    </p>
                    {b.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{b.notes}</p>}
                  </div>
                  <button onClick={() => startEdit(b)} aria-label={`Edit ${b.name}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(b)} aria-label={`Remove ${b.name}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
