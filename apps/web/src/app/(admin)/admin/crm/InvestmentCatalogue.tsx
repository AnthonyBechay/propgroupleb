'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Loader2, Trash2, ExternalLink, TrendingUp, CalendarDays, X, Check, Pencil, Building2,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ALL_PROPERTY_KINDS, typeLabel } from '@/lib/property-types'
import { GEORGIA_REGION_LABEL } from '@/lib/crm-locations'
import { Upload } from 'lucide-react'

/**
 * The Georgia stock we resell.
 *
 * That inventory lives on propgrp.com, which left the CRM unable to answer the
 * one question that matters for half the book — "what can I offer this client".
 * This is a deliberately thin mirror: enough to match an investor and send them
 * a link, not a second listings system to keep in sync.
 */

export type ProductStatus = 'AVAILABLE' | 'LIMITED' | 'SOLD_OUT' | 'PAUSED'

export interface InvestmentProduct {
  id: string
  market: 'LEBANON' | 'GEORGIA'
  name: string
  developer: string | null
  city: string | null
  region: string | null
  unitKinds: string[]
  priceFrom: number | null
  priceTo: number | null
  currency: 'USD' | 'LBP'
  expectedYield: number | null
  handoverAt: string | null
  paymentPlan: string | null
  url: string | null
  notes: string | null
  status: ProductStatus
}

export const PRODUCT_STATUS_META: Record<ProductStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LIMITED:   { label: 'Few left',  cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  SOLD_OUT:  { label: 'Sold out',  cls: 'bg-slate-200 text-slate-600 border-slate-300' },
  PAUSED:    { label: 'Paused',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export function InvestmentCatalogue({ onClose }: { onClose: () => void }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [items, setItems] = useState<InvestmentProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<InvestmentProduct | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/products?market=GEORGIA`, {
        credentials: 'include', cache: 'no-store',
      })
      if (res.ok) setItems((await res.json()).data ?? [])
    } finally { setLoading(false) }
  }, [apiUrl])
  useEffect(() => { load() }, [load])

  async function save(body: Record<string, unknown>, id?: string) {
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/products${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setEditing(null); await load() }
      return res.ok
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remove this opportunity from the catalogue?')) return
    await fetch(`${apiUrl}/api/crm/products/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  /**
   * Bulk load from a propgrp.com export. Columns are matched by name so the
   * sheet doesn't have to be reshaped — only "name" is required.
   */
  async function importCsv(file: File) {
    setImporting(true)
    setImportMsg(null)
    try {
      const text = (await file.text()).replace(/^\ufeff/, '')
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) { setImportMsg('That file has no data rows.'); return }

      const split = (line: string) => {
        const out: string[] = []
        let cur = '', q = false
        for (let i = 0; i < line.length; i++) {
          const c = line[i]
          if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
          else if (c === ',' && !q) { out.push(cur); cur = '' }
          else cur += c
        }
        out.push(cur)
        return out.map((v) => v.trim())
      }

      const field = (h: string): string | null => {
        const k = h.toLowerCase().replace(/[^a-z]/g, '')
        if (k.includes('name') || k.includes('project') || k.includes('title')) return 'name'
        if (k.includes('developer') || k.includes('builder')) return 'developer'
        if (k.includes('city') || k.includes('location')) return 'city'
        if (k.includes('type') || k.includes('unit')) return 'unitKinds'
        if (k.includes('pricefrom') || k === 'price' || k.includes('from') || k.includes('startingprice')) return 'priceFrom'
        if (k.includes('priceto') || k.includes('maxprice')) return 'priceTo'
        if (k.includes('yield') || k.includes('roi') || k.includes('return')) return 'expectedYield'
        if (k.includes('handover') || k.includes('delivery') || k.includes('completion')) return 'handoverAt'
        if (k.includes('payment') || k.includes('plan') || k.includes('installment')) return 'paymentPlan'
        if (k.includes('url') || k.includes('link')) return 'url'
        if (k.includes('status')) return 'status'
        if (k.includes('note') || k.includes('description')) return 'notes'
        return null
      }

      const headers = split(lines[0]).map(field)
      if (!headers.includes('name')) {
        setImportMsg('Could not find a project name column. Check the header row.')
        return
      }

      const KIND_WORDS: Array<[RegExp, string]> = [
        [/studio/i, 'STUDIO'], [/apart|flat/i, 'APARTMENT'], [/villa/i, 'VILLA'],
        [/penthouse/i, 'PENTHOUSE'], [/duplex/i, 'DUPLEX'], [/townhouse/i, 'TOWNHOUSE'],
        [/office/i, 'OFFICE'], [/shop|retail/i, 'SHOP'], [/hotel|aparthotel/i, 'APARTMENT'],
      ]
      const num = (v: string) => {
        const n = Number(String(v || '').replace(/[^0-9.]/g, ''))
        return Number.isFinite(n) && n > 0 ? n : null
      }

      let ok = 0, failed = 0
      for (const line of lines.slice(1)) {
        const cells = split(line)
        const rec: Record<string, string> = {}
        headers.forEach((f, i) => { if (f) rec[f] = cells[i] ?? '' })
        if (!rec.name?.trim()) continue

        const blob = `${rec.unitKinds ?? ''} ${rec.name}`
        const kinds = Array.from(new Set(KIND_WORDS.filter(([re]) => re.test(blob)).map(([, k]) => k)))
        const handover = rec.handoverAt ? new Date(rec.handoverAt) : null

        const body = {
          market: 'GEORGIA',
          name: rec.name.trim(),
          developer: rec.developer?.trim() || null,
          city: rec.city?.trim() || null,
          unitKinds: kinds,
          priceFrom: num(rec.priceFrom),
          priceTo: num(rec.priceTo),
          expectedYield: num(rec.expectedYield),
          handoverAt: handover && !Number.isNaN(+handover) ? handover.toISOString() : null,
          paymentPlan: rec.paymentPlan?.trim() || null,
          url: rec.url?.trim() || null,
          notes: rec.notes?.trim() || null,
          status: /sold/i.test(rec.status ?? '') ? 'SOLD_OUT'
            : /limit|few/i.test(rec.status ?? '') ? 'LIMITED' : 'AVAILABLE',
        }
        const res = await fetch(`${apiUrl}/api/crm/products`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) ok++; else failed++
      }
      setImportMsg(`${ok} imported${failed ? `, ${failed} skipped` : ''}.`)
      await load()
    } finally { setImporting(false) }
  }

  const live = items.filter((p) => p.status === 'AVAILABLE' || p.status === 'LIMITED')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[88vh]">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              🇬🇪 Georgia opportunities
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {live.length} live · matched to Georgia investors automatically. Listings stay on
              propgrp.com — this is just what you need to make the offer.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import CSV
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = '' }}
              />
            </label>
            <button
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {importMsg && (
            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{importMsg}</p>
          )}
          {editing && (
            <ProductForm
              initial={editing === 'new' ? undefined : editing}
              busy={busy}
              onCancel={() => setEditing(null)}
              onSave={(body) => save(body, editing === 'new' ? undefined : editing.id)}
            />
          )}

          {loading ? (
            <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 && !editing ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-500">No Georgia opportunities yet.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Add the projects you resell — Georgia investors will start getting matched to them
                instead of seeing an empty list.
              </p>
            </div>
          ) : (
            items.map((p) => {
              const meta = PRODUCT_STATUS_META[p.status]
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-px rounded border ${meta.cls}`}>
                          {meta.label}
                        </span>
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer"
                             className="text-slate-400 hover:text-slate-700" title="Open on propgrp.com">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[
                          p.developer,
                          p.city,
                          p.region ? GEORGIA_REGION_LABEL[p.region] : null,
                          p.unitKinds.map(typeLabel).join(', ') || null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-[11px]">
                        {(p.priceFrom || p.priceTo) && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {p.currency} {(p.priceFrom ?? 0).toLocaleString()}
                            {p.priceTo ? `–${p.priceTo.toLocaleString()}` : '+'}
                          </span>
                        )}
                        {p.expectedYield != null && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                            <TrendingUp className="h-3 w-3" /> {p.expectedYield}% yield
                          </span>
                        )}
                        {p.handoverAt && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                            <CalendarDays className="h-3 w-3" />
                            Handover {new Date(p.handoverAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {p.paymentPlan && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{p.paymentPlan}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(p.id)} className="p-1.5 rounded text-slate-300 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10'
const lbl = 'block text-[11px] font-medium text-slate-500 mb-1'

function ProductForm({
  initial, busy, onCancel, onSave,
}: {
  initial?: InvestmentProduct
  busy: boolean
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => void
}) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    developer: initial?.developer ?? '',
    city: initial?.city ?? '',
    region: initial?.region ?? '',
    unitKinds: initial?.unitKinds ?? ([] as string[]),
    priceFrom: initial?.priceFrom?.toString() ?? '',
    priceTo: initial?.priceTo?.toString() ?? '',
    expectedYield: initial?.expectedYield?.toString() ?? '',
    handoverAt: initial?.handoverAt?.slice(0, 10) ?? '',
    paymentPlan: initial?.paymentPlan ?? '',
    url: initial?.url ?? '',
    status: initial?.status ?? ('AVAILABLE' as ProductStatus),
    notes: initial?.notes ?? '',
  })
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  // Studios and apartments are what Georgia investors buy; the full list is
  // available but these lead.
  const kinds = ALL_PROPERTY_KINDS

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 space-y-2.5 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className={lbl}>Project name *</label>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Orbi City Batumi" className={inp} />
        </div>
        <div>
          <label className={lbl}>Developer</label>
          <input value={f.developer} onChange={(e) => set('developer', e.target.value)} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className={lbl}>City</label>
          <input value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Batumi" className={inp} />
        </div>
        <div>
          <label className={lbl}>Region</label>
          <select value={f.region} onChange={(e) => set('region', e.target.value)} className={inp}>
            <option value="">—</option>
            {Object.entries(GEORGIA_REGION_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select value={f.status} onChange={(e) => set('status', e.target.value)} className={inp}>
            {(Object.keys(PRODUCT_STATUS_META) as ProductStatus[]).map((k) => (
              <option key={k} value={k}>{PRODUCT_STATUS_META[k].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={lbl}>Unit types on offer</label>
        <div className="flex flex-wrap gap-1">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() =>
                setF((p) => ({
                  ...p,
                  unitKinds: p.unitKinds.includes(k) ? p.unitKinds.filter((x) => x !== k) : [...p.unitKinds, k],
                }))
              }
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                f.unitKinds.includes(k)
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {typeLabel(k)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div>
          <label className={lbl}>Price from (USD)</label>
          <input type="number" min="0" value={f.priceFrom} onChange={(e) => set('priceFrom', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Price to</label>
          <input type="number" min="0" value={f.priceTo} onChange={(e) => set('priceTo', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Yield %</label>
          <input type="number" min="0" max="100" step="0.1" value={f.expectedYield} onChange={(e) => set('expectedYield', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={lbl}>Handover</label>
          <input type="date" value={f.handoverAt} onChange={(e) => set('handoverAt', e.target.value)} className={inp} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className={lbl}>Payment plan</label>
          <input value={f.paymentPlan} onChange={(e) => set('paymentPlan', e.target.value)} placeholder="30% down, 24 months" className={inp} />
        </div>
        <div>
          <label className={lbl}>Link on propgrp.com</label>
          <input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://propgrp.com/…" className={inp} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-600 rounded hover:bg-slate-200">Cancel</button>
        <button
          onClick={() =>
            onSave({
              market: 'GEORGIA',
              name: f.name.trim(),
              developer: f.developer.trim() || null,
              city: f.city.trim() || null,
              region: f.region || null,
              unitKinds: f.unitKinds,
              priceFrom: f.priceFrom ? Number(f.priceFrom) : null,
              priceTo: f.priceTo ? Number(f.priceTo) : null,
              expectedYield: f.expectedYield ? Number(f.expectedYield) : null,
              handoverAt: f.handoverAt ? new Date(f.handoverAt).toISOString() : null,
              paymentPlan: f.paymentPlan.trim() || null,
              url: f.url.trim() || null,
              status: f.status,
              notes: f.notes.trim() || null,
            })
          }
          disabled={busy || !f.name.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  )
}
