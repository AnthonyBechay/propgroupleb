'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Check } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui/layout'
import { normalizeApiUrl } from '@/lib/utils/api-url'

type Market = 'LEBANON' | 'INTERNATIONAL'
interface Terms { sellerPct: number; buyerPct: number; payoutAtPct: number }

const MARKETS: Array<{ key: Market; title: string; hint: string }> = [
  { key: 'LEBANON', title: 'Lebanon', hint: 'propgrouplb.com — usually 2.5% from each side, paid when the sale closes.' },
  { key: 'INTERNATIONAL', title: 'International', hint: 'propgrp.com — usually 5.9% from the developer, nothing from the buyer, paid once the buyer has paid 30%.' },
]

const inp = 'mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

/**
 * The default commission terms. A project can have its own (on the project's
 * page), and a deal its own (in the client's Deal & commission) — these are
 * what everything else uses. Changing them moves every open deal that never
 * set its own rates; a deal already being paid off keeps its payout threshold.
 */
export default function CommissionSettingsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [terms, setTerms] = useState<Record<Market, Record<keyof Terms, string>> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${apiUrl}/api/finance/commission/settings`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        const d = j.data as Record<Market, Terms>
        const asText = (t: Terms) => ({ sellerPct: String(t.sellerPct), buyerPct: String(t.buyerPct), payoutAtPct: String(t.payoutAtPct) })
        setTerms({ LEBANON: asText(d.LEBANON), INTERNATIONAL: asText(d.INTERNATIONAL) })
      })
      .catch(() => setError('Could not load the commission settings.'))
  }, [apiUrl])

  const set = (m: Market, k: keyof Terms, v: string) => {
    setSaved(false)
    setTerms((prev) => (prev ? { ...prev, [m]: { ...prev[m], [k]: v } } : prev))
  }

  async function save() {
    if (!terms) return
    setSaving(true); setError(null)
    try {
      const toNum = (t: Record<keyof Terms, string>) => ({
        sellerPct: Number(t.sellerPct || 0), buyerPct: Number(t.buyerPct || 0), payoutAtPct: Number(t.payoutAtPct || 0),
      })
      const res = await fetch(`${apiUrl}/api/finance/commission/settings`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ LEBANON: toNum(terms.LEBANON), INTERNATIONAL: toNum(terms.INTERNATIONAL) }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
    } catch {
      setError('That did not save. Check the numbers are between 0 and 100.')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Commission"
        description="The standard terms each deal starts from. A project, or a single deal, can have its own."
        backHref="/admin/settings"
        backLabel="Back to settings"
        crumbs={[{ label: 'Settings', href: '/admin/settings' }, { label: 'Commission' }]}
      />

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!terms ? (
        !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-4">
          {MARKETS.map((m) => {
            const t = terms[m.key]
            return (
              <section key={m.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-900">{m.title}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{m.hint}</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block text-sm text-slate-700">
                    From the seller, %
                    <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={t.sellerPct} onChange={(e) => set(m.key, 'sellerPct', e.target.value)} className={inp} />
                  </label>
                  <label className="block text-sm text-slate-700">
                    From the buyer, %
                    <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={t.buyerPct} onChange={(e) => set(m.key, 'buyerPct', e.target.value)} className={inp} />
                  </label>
                  <label className="block text-sm text-slate-700">
                    Paid once the buyer has paid, %
                    <input type="number" min="0" max="100" step="1" inputMode="decimal" value={t.payoutAtPct} onChange={(e) => set(m.key, 'payoutAtPct', e.target.value)} className={inp} />
                    <span className="mt-1 block text-xs text-slate-500">0 = when the sale closes</span>
                  </label>
                </div>
              </section>
            )
          })}

          <p className="text-sm text-slate-500">
            Brokers and their share are on the <Link href="/admin/brokers" className="font-medium text-slate-800 underline">Brokers</Link> page.
            A project&apos;s own terms are set on the project&apos;s page, under Commission.
          </p>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
            </button>
            {saved && <span className="text-sm text-emerald-700">Saved.</span>}
          </div>
        </div>
      )}
    </div>
  )
}
