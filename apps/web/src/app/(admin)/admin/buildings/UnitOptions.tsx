'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Check, X, Pencil, Layers3 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * Finish / payment options on a unit — "white frame" vs "turnkey", each with
 * its own price per m² and down payment.
 *
 * This is what an off-plan buyer actually chooses between, and it's how the
 * imported Georgian projects are priced. The data existed and the legacy API
 * could edit it, but the current admin had no way to see or change it.
 */

export interface UnitOption {
  id: string
  name: string
  pricePerSqm: number | string
  currency: 'USD' | 'LBP'
  initialPayment: number | string | null
  description: string | null
}

const inp = 'w-full px-2 py-1.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10'

export function UnitOptions({
  buildingId,
  unitId,
  options,
  areaSqm,
  onChanged,
}: {
  buildingId: string
  unitId: string
  options: UnitOption[]
  /** Used to show what the option actually costs for this unit. */
  areaSqm?: number | null
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [editing, setEditing] = useState<UnitOption | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `${apiUrl}/api/buildings/${buildingId}/units/${unitId}/options`

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
        setError(j.message || j.error || 'Could not save')
        return
      }
      setEditing(null)
      onChanged()
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remove this option?')) return
    setBusy(true)
    try {
      await fetch(`${base}/${id}`, { method: 'DELETE', credentials: 'include' })
      onChanged()
    } finally { setBusy(false) }
  }

  const total = (o: UnitOption) =>
    areaSqm && Number(o.pricePerSqm) > 0 ? Number(o.pricePerSqm) * areaSqm : null

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
          <Layers3 className="h-3.5 w-3.5" /> Finish options
          {options.length > 0 && <span className="text-zinc-400 font-normal normal-case">({options.length})</span>}
        </p>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {editing === 'new' && (
        <OptionForm busy={busy} onCancel={() => setEditing(null)} onSave={(b) => save(b)} />
      )}

      {options.length === 0 && editing !== 'new' ? (
        <p className="text-xs text-zinc-400">
          No options — the unit is sold at one price. Add one for projects that quote
          white-frame and turnkey separately.
        </p>
      ) : (
        <ul className="space-y-1">
          {options.map((o) =>
            editing !== 'new' && (editing as UnitOption)?.id === o.id ? (
              <li key={o.id}>
                <OptionForm
                  initial={o}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={(b) => save(b, o.id)}
                />
              </li>
            ) : (
              <li
                key={o.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-zinc-900">{o.name}</span>
                    <span className="text-xs text-zinc-500">
                      {o.currency} {Number(o.pricePerSqm).toLocaleString()}/m²
                    </span>
                    {total(o) && (
                      <span className="text-xs font-medium text-emerald-700">
                        ≈ {o.currency} {total(o)!.toLocaleString()}
                      </span>
                    )}
                    {o.initialPayment != null && (
                      <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-px rounded">
                        {Number(o.initialPayment)}% down
                      </span>
                    )}
                  </div>
                  {o.description && <p className="text-xs text-zinc-400 truncate">{o.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(o)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(o.id)}
                  disabled={busy}
                  className="p-1 rounded text-zinc-300 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function OptionForm({
  initial, busy, onCancel, onSave,
}: {
  initial?: UnitOption
  busy: boolean
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    pricePerSqm: initial?.pricePerSqm != null ? String(Number(initial.pricePerSqm)) : '',
    currency: initial?.currency ?? 'USD',
    initialPayment: initial?.initialPayment != null ? String(Number(initial.initialPayment)) : '',
    description: initial?.description ?? '',
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  return (
    <div className="rounded-lg border border-zinc-300 bg-zinc-50 p-2.5 space-y-2 mb-1">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label className="block sm:col-span-2">
          <span className="text-[11px] text-zinc-500">Option name</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Turnkey" className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-zinc-500">Price / m²</span>
          <input type="number" min="0" value={f.pricePerSqm} onChange={(e) => set('pricePerSqm', e.target.value)} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-zinc-500">Currency</span>
          <select value={f.currency} onChange={(e) => set('currency', e.target.value)} className={inp}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="block">
          <span className="text-[11px] text-zinc-500">Down payment %</span>
          <input type="number" min="0" max="100" value={f.initialPayment} onChange={(e) => set('initialPayment', e.target.value)} className={inp} />
        </label>
        <label className="block sm:col-span-3">
          <span className="text-[11px] text-zinc-500">Description</span>
          <input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Fully finished, appliances included" className={inp} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-2.5 py-1 text-xs text-zinc-600 rounded hover:bg-zinc-200">
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              name: f.name.trim(),
              pricePerSqm: Number(f.pricePerSqm) || 0,
              currency: f.currency,
              initialPayment: f.initialPayment !== '' ? Number(f.initialPayment) : null,
              description: f.description.trim() || null,
            })
          }
          disabled={busy || !f.name.trim()}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-zinc-800 rounded hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  )
}
