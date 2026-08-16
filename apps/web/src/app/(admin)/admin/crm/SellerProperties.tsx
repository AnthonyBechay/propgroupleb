'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, ExternalLink, Home, DollarSign, X, Check } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ALL_PROPERTY_KINDS, typeLabel } from '@/lib/property-types'
import {
  type LeadProperty, type LeadPropertyStatus, PROPERTY_STATUS_META,
} from './types'

/**
 * What a seller actually has on the market.
 *
 * A seller used to be described by one set of fields — one type, one area, one
 * price — which quietly broke the moment he listed a second flat: the second
 * one either overwrote the first or never got matched to anyone. Each row here
 * is matched to buyers independently, and carries its own sale figures so
 * "what did we make on that one" has an answer.
 */
export function SellerProperties({
  leadId,
  properties,
  onChanged,
}: {
  leadId: string
  properties: LeadProperty[]
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [sellingId, setSellingId] = useState<string | null>(null)

  async function save(path: string, method: string, body?: unknown) {
    setBusy(path)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      if (res.ok) onChanged()
      return res.ok
    } finally { setBusy(null) }
  }

  const live = properties.filter((p) => p.status !== 'SOLD' && p.status !== 'WITHDRAWN')
  const closed = properties.filter((p) => p.status === 'SOLD' || p.status === 'WITHDRAWN')
  const earned = closed.reduce((t, p) => t + (p.commissionUsd ?? 0), 0)

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <Home className="h-3.5 w-3.5" /> On the market
          {properties.length > 0 && (
            <span className="text-slate-400 font-normal normal-case">({live.length} live)</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {earned > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
              ${earned.toLocaleString()} earned
            </span>
          )}
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      {adding && (
        <PropertyForm
          onCancel={() => setAdding(false)}
          onSave={async (body) => {
            const ok = await save(`${leadId}/properties`, 'POST', body)
            if (ok) setAdding(false)
          }}
          busy={busy === `${leadId}/properties`}
        />
      )}

      {properties.length === 0 && !adding ? (
        <p className="text-sm text-slate-400 py-3">
          Nothing recorded yet. Add each property this client is selling so buyers get matched to
          the right one.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {[...live, ...closed].map((p) => {
            const meta = PROPERTY_STATUS_META[p.status]
            const sold = p.status === 'SOLD'
            return (
              <li key={p.id} className={`rounded-lg border p-2.5 ${sold ? 'border-slate-100 bg-slate-50/60' : 'border-slate-200'}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {p.title || typeLabel(p.kind)}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-px rounded border ${meta.cls}`}>
                        {meta.label}
                      </span>
                      {p.externalUrl && (
                        <a
                          href={p.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-700"
                          title="Open listing"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {[
                        typeLabel(p.kind),
                        p.areas.join(', ') || null,
                        p.bedrooms != null ? `${p.bedrooms} bed` : null,
                        p.areaSqm ? `${p.areaSqm} m²` : null,
                        p.askingPrice ? `${p.currency} ${p.askingPrice.toLocaleString()}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    {sold && (
                      <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                        Sold {p.soldPrice ? `for ${p.currency} ${p.soldPrice.toLocaleString()}` : ''}
                        {p.commissionUsd ? ` · commission $${p.commissionUsd.toLocaleString()}` : ''}
                        {p.soldAt ? ` · ${new Date(p.soldAt).toLocaleDateString()}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!sold && (
                      <button
                        onClick={() => setSellingId(sellingId === p.id ? null : p.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        <DollarSign className="h-3 w-3" /> Sold
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Remove this property?')) save(`properties/${p.id}`, 'DELETE')
                      }}
                      disabled={busy === `properties/${p.id}`}
                      className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {sellingId === p.id && (
                  <SaleForm
                    currency={p.currency}
                    defaultPrice={p.askingPrice}
                    busy={busy === `properties/${p.id}`}
                    onCancel={() => setSellingId(null)}
                    onSave={async (soldPrice, commissionUsd) => {
                      const ok = await save(`properties/${p.id}`, 'PATCH', {
                        status: 'SOLD', soldPrice, commissionUsd,
                      })
                      if (ok) setSellingId(null)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const inp = 'w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10'

/** Record what it sold for and what we made. */
function SaleForm({
  currency, defaultPrice, busy, onCancel, onSave,
}: {
  currency: string
  defaultPrice: number | null
  busy: boolean
  onCancel: () => void
  onSave: (soldPrice: number | null, commissionUsd: number | null) => void
}) {
  const [price, setPrice] = useState(defaultPrice?.toString() ?? '')
  const [commission, setCommission] = useState('')

  return (
    <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-slate-500">Sold for ({currency})</span>
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Our commission (USD)</span>
          <input type="number" min="0" value={commission} onChange={(e) => setCommission(e.target.value)} className={inp} />
        </label>
      </div>
      <p className="text-[10px] text-slate-400">
        Commission is stored in USD so totals across both markets add up.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-2.5 py-1 text-xs text-slate-500 rounded hover:bg-slate-100">
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onSave(price ? Number(price) : null, commission ? Number(commission) : null)}
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Mark sold
        </button>
      </div>
    </div>
  )
}

/** Add one property to a seller's book. */
function PropertyForm({
  onCancel, onSave, busy,
}: {
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => void
  busy: boolean
}) {
  const [f, setF] = useState({
    kind: 'APARTMENT', title: '', areas: '', askingPrice: '', currency: 'USD',
    bedrooms: '', areaSqm: '', externalUrl: '', notes: '',
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2 mb-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-slate-500">Type</span>
          <select value={f.kind} onChange={(e) => set('kind', e.target.value)} className={inp}>
            {ALL_PROPERTY_KINDS.map((k) => (
              <option key={k} value={k}>{typeLabel(k)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Asking price</span>
          <input type="number" min="0" value={f.askingPrice} onChange={(e) => set('askingPrice', e.target.value)} className={inp} />
        </label>
      </div>
      <label className="block">
        <span className="text-[11px] text-slate-500">Description</span>
        <input
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="3BR Achrafieh, 5th floor, sea view"
          className={inp}
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[11px] text-slate-500">Areas</span>
          <input value={f.areas} onChange={(e) => set('areas', e.target.value)} placeholder="Achrafieh" className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">Beds</span>
          <input type="number" min="0" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">m²</span>
          <input type="number" min="0" value={f.areaSqm} onChange={(e) => set('areaSqm', e.target.value)} className={inp} />
        </label>
      </div>
      <label className="block">
        <span className="text-[11px] text-slate-500">Link (optional)</span>
        <input
          value={f.externalUrl}
          onChange={(e) => set('externalUrl', e.target.value)}
          placeholder="https://propgrp.com/… or our own listing"
          className={inp}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-600 rounded hover:bg-slate-200">Cancel</button>
        <button
          onClick={() =>
            onSave({
              kind: f.kind,
              title: f.title || null,
              // Comma-separated for speed; the matcher compares case-insensitively.
              areas: f.areas.split(',').map((a) => a.trim()).filter(Boolean),
              askingPrice: f.askingPrice ? Number(f.askingPrice) : null,
              currency: f.currency,
              bedrooms: f.bedrooms ? Number(f.bedrooms) : null,
              areaSqm: f.areaSqm ? Number(f.areaSqm) : null,
              externalUrl: f.externalUrl || null,
              notes: f.notes || null,
            })
          }
          disabled={busy}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add property
        </button>
      </div>
    </div>
  )
}

export type { LeadPropertyStatus }
