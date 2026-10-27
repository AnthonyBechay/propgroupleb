'use client'

import { useState } from 'react'
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import type { UnitOption } from './UnitOptions'

/**
 * A project unit type's finishes, as the table a buyer actually chooses from:
 *
 *   Finishing        Details          Price / m²   Studio · 30 m²   First payment
 *   Black frame      Mountain view    $1,500       $45,000          30%
 *   White frame      Sea view         $1,800       $54,000          30%
 *
 * It replaced a short list hidden inside the unit's Edit panel, under fields
 * about owners and rent that a project type never has — so the thing that
 * prices a Batumi project was the hardest thing on the screen to find.
 * Every row edits in place; "Add finishing" is always the last row.
 */
export function FinishingTable({
  buildingId, unitId, options, areaSqm, unitLabel, onChanged,
}: {
  buildingId: string
  unitId: string
  options: UnitOption[]
  /** What one unit measures — turns a price per m² into the price a buyer pays. */
  areaSqm: number | null
  unitLabel: string
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const base = `${apiUrl}/api/buildings/${buildingId}/units/${unitId}/options`
  const [editing, setEditing] = useState<string | 'new' | null>(options.length === 0 ? null : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(body: Record<string, unknown>, id?: string) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(id ? `${base}/${id}` : base, {
        method: id ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || j.error || 'Could not save this finishing.')
        return
      }
      setEditing(null)
      onChanged()
    } finally { setBusy(false) }
  }

  async function remove(o: UnitOption) {
    if (!confirm(`Remove the "${o.name}" finishing from ${unitLabel}?`)) return
    setBusy(true)
    try {
      await fetch(`${base}/${o.id}`, { method: 'DELETE', credentials: 'include' })
      onChanged()
    } finally { setBusy(false) }
  }

  const area = Number(areaSqm) || 0
  const money = (n: number, currency: string) =>
    `${currency === 'USD' ? '$' : `${currency} `}${Math.round(n).toLocaleString('en-US')}`

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-semibold">Finishing</th>
            <th className="py-2 pr-3 font-semibold">Details</th>
            <th className="py-2 pr-3 text-right font-semibold">Price / m²</th>
            <th className="py-2 pr-3 text-right font-semibold">{area ? `Price · ${area} m²` : 'Price'}</th>
            <th className="py-2 pr-3 text-right font-semibold">First payment</th>
            <th className="w-20 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {/* Cheapest first, always — the order no longer jumps after an edit. */}
          {[...options].sort((a, b) => Number(a.pricePerSqm) - Number(b.pricePerSqm)).map((o) =>
            editing === o.id ? (
              <FinishingRow key={o.id} initial={o} area={area} busy={busy} onCancel={() => setEditing(null)} onSave={(b) => save(b, o.id)} />
            ) : (
              <tr key={o.id} className="group">
                <td className="py-2.5 pr-3 font-medium text-slate-900">{o.name}</td>
                <td className="py-2.5 pr-3 text-slate-600">{o.description || <span className="text-slate-300">—</span>}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{money(Number(o.pricePerSqm), o.currency)}</td>
                <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-slate-900">
                  {area && Number(o.pricePerSqm) > 0 ? money(Number(o.pricePerSqm) * area, o.currency) : <span className="font-normal text-slate-300">set the size</span>}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">
                  {o.initialPayment != null ? `${Number(o.initialPayment)}%` : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-1.5 text-right">
                  <button type="button" onClick={() => setEditing(o.id)} aria-label={`Edit ${o.name}`} title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(o)} disabled={busy} aria-label={`Remove ${o.name}`} title="Remove"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ),
          )}
          {editing === 'new' ? (
            <FinishingRow area={area} busy={busy} onCancel={() => setEditing(null)} onSave={(b) => save(b)} />
          ) : (
            <tr>
              <td colSpan={6} className="pt-2">
                <button type="button" onClick={() => setEditing('new')}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50">
                  <Plus className="h-3.5 w-3.5" /> Add finishing
                </button>
                {options.length === 0 && (
                  <span className="ml-3 text-xs text-slate-500">No finishes yet — this unit has no price on the website until it has one.</span>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const cell = 'w-full min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10'

function FinishingRow({
  initial, area, busy, onCancel, onSave,
}: {
  initial?: UnitOption
  area: number
  busy: boolean
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    pricePerSqm: initial?.pricePerSqm != null ? String(Number(initial.pricePerSqm)) : '',
    currency: initial?.currency ?? 'USD',
    initialPayment: initial?.initialPayment != null ? String(Number(initial.initialPayment)) : '',
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const total = area && Number(f.pricePerSqm) > 0 ? Number(f.pricePerSqm) * area : null
  const submit = () => onSave({
    name: f.name.trim(),
    description: f.description.trim() || null,
    pricePerSqm: Number(f.pricePerSqm) || 0,
    currency: f.currency,
    initialPayment: f.initialPayment !== '' ? Number(f.initialPayment) : null,
  })

  return (
    <tr className="bg-slate-50 align-top">
      <td className="py-2 pr-2">
        <input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="White frame" className={cell} aria-label="Finishing" />
      </td>
      <td className="py-2 pr-2">
        <input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Sea view, floors 8–15" className={cell} aria-label="Details"
          onKeyDown={(e) => { if (e.key === 'Enter' && f.name.trim()) submit() }} />
      </td>
      <td className="py-2 pr-2">
        <div className="flex gap-1">
          <input type="number" min="0" inputMode="decimal" value={f.pricePerSqm} onChange={(e) => set('pricePerSqm', e.target.value)} placeholder="1500" className={`${cell} text-right`} aria-label="Price per m²" />
          <select value={f.currency} onChange={(e) => set('currency', e.target.value)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-1 text-xs" aria-label="Currency">
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </select>
        </div>
      </td>
      <td className="py-2 pr-3 pt-4 text-right font-semibold tabular-nums text-slate-900">
        {total ? `${f.currency === 'USD' ? '$' : `${f.currency} `}${Math.round(total).toLocaleString('en-US')}` : '—'}
      </td>
      <td className="py-2 pr-2">
        <div className="relative">
          <input type="number" min="0" max="100" value={f.initialPayment} onChange={(e) => set('initialPayment', e.target.value)} placeholder="30" className={`${cell} pr-6 text-right`} aria-label="First payment %" />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
        </div>
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <button type="button" onClick={onCancel} aria-label="Cancel"
          className="inline-flex h-10 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200">
          <X className="h-4 w-4" />
        </button>
        <button type="button" onClick={submit} disabled={busy || !f.name.trim()} aria-label="Save"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
      </td>
    </tr>
  )
}
