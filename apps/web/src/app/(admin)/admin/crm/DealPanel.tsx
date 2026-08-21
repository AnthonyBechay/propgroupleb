'use client'

import { useState } from 'react'
import { Loader2, DollarSign, Pencil, Check, X, Plus, Globe } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { type Lead, type Opportunity } from './types'

/**
 * The money on a closed deal.
 *
 * Commission used to be capturable only while pressing "Deal closed" on an
 * opportunity that was already at Offer Made. Drag a card straight to Won —
 * which is what people actually do — and there was nowhere to put the figure,
 * and no way to correct it afterwards. Everything here is editable after the
 * fact, including the date, because deals get entered days after they close.
 *
 * Hidden entirely from roles that may not see the office's takings; the server
 * strips the fields as well, so this is presentation, not the control.
 */
export function DealPanel({
  lead,
  canSeeMoney,
  onChanged,
}: {
  lead: Lead
  canSeeMoney: boolean
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canSeeMoney) return null

  const opportunities = lead.opportunities ?? []
  // A deal is anything won, plus anything already carrying figures — so a
  // half-recorded deal can still be found and finished.
  const deals = opportunities.filter(
    (o) => o.stage === 'WON' || o.soldPrice != null || o.commissionUsd != null
  )
  const isClosed = lead.status === 'WON'
  const total = deals.reduce((t, d) => t + (d.commissionUsd ?? 0), 0)

  async function saveDeal(id: string, body: Record<string, unknown>) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm/opportunities/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || j.error || 'Could not save')
        return false
      }
      setEditingId(null)
      onChanged()
      return true
    } finally { setBusy(false) }
  }

  /** Record a deal for a client who has no shortlist entry to attach it to. */
  async function createDeal(body: Record<string, unknown>) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}/opportunities`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'WON', ...body }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || j.error || 'Could not record the deal')
        return false
      }
      setCreating(false)
      onChanged()
      return true
    } finally { setBusy(false) }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" /> Deal &amp; commission
        </p>
        {total > 0 && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
            ${total.toLocaleString()} earned
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-2">{error}</p>
      )}

      {deals.length === 0 && !creating && (
        <div className="py-2">
          <p className="text-sm text-slate-400">
            {isClosed
              ? 'This client is marked Won but no sale has been recorded.'
              : 'Nothing closed yet.'}
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-50"
          >
            <Plus className="h-3.5 w-3.5" /> Record a sale
          </button>
        </div>
      )}

      {creating && (
        <DealForm
          busy={busy}
          onCancel={() => setCreating(false)}
          onSave={(body) => createDeal(body)}
          allowSubject
        />
      )}

      <ul className="space-y-1.5">
        {deals.map((d) => (
          <li key={d.id} className="rounded-lg border border-slate-200 p-2.5">
            {editingId === d.id ? (
              <DealForm
                busy={busy}
                initial={d}
                onCancel={() => setEditingId(null)}
                onSave={(body) => saveDeal(d.id, body)}
              />
            ) : (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {d.subject?.ref && (
                      <span className="font-mono text-[10px] font-semibold text-slate-500">{d.subject.ref}</span>
                    )}
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {d.subject?.title ?? d.externalTitle ?? 'Deal'}
                    </span>
                    {d.subject?.kind === 'EXTERNAL' && (
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-px rounded">
                        <Globe className="h-2.5 w-2.5" /> Off-platform
                      </span>
                    )}
                  </div>
                  {d.soldUnitRef && (
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{d.soldUnitRef}</p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">
                    {d.soldPrice != null
                      ? `Sold for ${d.soldCurrency} ${d.soldPrice.toLocaleString()}`
                      : 'Sale price not recorded'}
                    {d.commissionUsd != null
                      ? ` · we made $${d.commissionUsd.toLocaleString()}`
                      : ' · commission not recorded'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {d.closedAt
                      ? `Closed ${new Date(d.closedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : 'No sale date set'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingId(d.id)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 shrink-0"
                  title="Edit the figures"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {deals.length > 0 && !creating && (
        <button
          onClick={() => setCreating(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <Plus className="h-3.5 w-3.5" /> Record another sale
        </button>
      )}
    </section>
  )
}

const inp = 'w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10'

/** Editable sale figures. Every field can be corrected later. */
function DealForm({
  initial, busy, onCancel, onSave, allowSubject = false,
}: {
  initial?: Opportunity
  busy: boolean
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => void
  allowSubject?: boolean
}) {
  const [title, setTitle] = useState(initial?.externalTitle ?? '')
  const [url, setUrl] = useState(initial?.externalUrl ?? '')
  const [price, setPrice] = useState(initial?.soldPrice?.toString() ?? '')
  const [currency, setCurrency] = useState(initial?.soldCurrency ?? 'USD')
  const [commission, setCommission] = useState(initial?.commissionUsd?.toString() ?? '')
  const [unitRef, setUnitRef] = useState(initial?.soldUnitRef ?? '')
  const [closedAt, setClosedAt] = useState(
    initial?.closedAt ? initial.closedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )

  return (
    <div className="space-y-2">
      {allowSubject && (
        <>
          <label className="block">
            <span className="text-[11px] text-slate-500">What did they buy?</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Studio, Orbi City Batumi"
              className={inp}
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-500">Link (optional)</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://propgrp.com/…"
              className={inp}
            />
          </label>
        </>
      )}

      {/* In a development we broker, the shortlist item is a type — this is
          where the actual apartment gets pinned down. */}
      <label className="block">
        <span className="text-[11px] text-slate-500">Which apartment did they get?</span>
        <input
          value={unitRef}
          onChange={(e) => setUnitRef(e.target.value)}
          placeholder="Studio 1204, 12th floor"
          className={inp}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="block col-span-2">
          <span className="text-[11px] text-slate-500">Sold for</span>
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as 'USD' | 'LBP')} className={inp}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-slate-500">Our profit (USD)</span>
          <input type="number" min="0" value={commission} onChange={(e) => setCommission(e.target.value)} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Sale date</span>
          <input type="date" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} className={inp} />
        </label>
      </div>

      <p className="text-[10px] text-slate-400">
        Profit is kept in USD so totals across Lebanon and Georgia add up.
      </p>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-2.5 py-1 text-xs text-slate-500 rounded hover:bg-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() =>
            onSave({
              ...(allowSubject ? { externalTitle: title || 'Sale', externalUrl: url || null } : {}),
              soldUnitRef: unitRef.trim() || null,
              soldPrice: price ? Number(price) : null,
              soldCurrency: currency,
              commissionUsd: commission ? Number(commission) : null,
              closedAt: closedAt ? new Date(closedAt).toISOString() : null,
            })
          }
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  )
}
