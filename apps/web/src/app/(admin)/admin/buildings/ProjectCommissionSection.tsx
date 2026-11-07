'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Loader2, Percent } from 'lucide-react'
import { FormSection } from '@/components/admin/ui/layout'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { useAuth } from '@/contexts/AuthContext'
import { canSeeMoney } from '@/lib/permissions'

type Field = 'sellerPct' | 'buyerPct' | 'payoutAtPct'
interface Defaults { sellerPct: number; buyerPct: number; payoutAtPct: number }

const inp = 'mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

/**
 * This project's own commission terms — Georgia agrees them per developer.
 * Saved on its own, apart from the property form, and stored apart from the
 * Building row so they can never reach a public page. Empty boxes use the
 * market's terms from Settings → Commission.
 */
export function ProjectCommissionSection({ buildingId, country }: { buildingId: string; country: string }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const { user } = useAuth()
  const allowed = canSeeMoney(user?.role)
  const [values, setValues] = useState<Record<Field, string>>({ sellerPct: '', buyerPct: '', payoutAtPct: '' })
  const [defaults, setDefaults] = useState<Defaults | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    if (!allowed) return
    const str = (n: number | null | undefined) => (n == null ? '' : String(n))
    fetch(`${apiUrl}/api/finance/commission/projects/${buildingId}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setValues({ sellerPct: str(j.data.sellerPct), buyerPct: str(j.data.buyerPct), payoutAtPct: str(j.data.payoutAtPct) }) })
      .catch(() => {})
    // The market's terms, for the placeholders.
    fetch(`${apiUrl}/api/finance/commission/settings`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setDefaults(j.data[country === 'LEBANON' ? 'LEBANON' : 'INTERNATIONAL']) })
      .catch(() => {})
  }, [allowed, apiUrl, buildingId, country])

  if (!allowed) return null

  async function save() {
    setState('saving')
    const num = (v: string) => (v.trim() === '' ? null : Number(v))
    try {
      const res = await fetch(`${apiUrl}/api/finance/commission/projects/${buildingId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerPct: num(values.sellerPct), buyerPct: num(values.buyerPct), payoutAtPct: num(values.payoutAtPct) }),
      })
      setState(res.ok ? 'saved' : 'error')
    } catch { setState('error') }
  }

  const field = (key: Field, label: string, hint?: string) => (
    <label className="block text-sm text-slate-700">
      {label}
      <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={values[key]}
        placeholder={defaults ? `${defaults[key]} (market default)` : ''}
        onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setState('idle') }} className={inp} />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )

  return (
    <FormSection
      id="commission"
      title="Commission"
      icon={<Percent className="h-4 w-4" />}
      description={<>What we earn on a sale here. Leave a box empty to use the <Link href="/admin/settings/commission" className="underline">market&apos;s terms</Link>. Never shown on the website.</>}
      tone="muted"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {field('sellerPct', 'From the seller / developer, %')}
        {field('buyerPct', 'From the buyer, %')}
        {field('payoutAtPct', 'Paid once the buyer has paid, %', '0 = when the sale closes')}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={state === 'saving'}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
          {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save commission terms
        </button>
        {state === 'saved' && <span className="text-sm text-emerald-700">Saved. New and open deals on this project use them.</span>}
        {state === 'error' && <span className="text-sm text-red-700">That did not save. Numbers must be 0–100.</span>}
      </div>
    </FormSection>
  )
}
