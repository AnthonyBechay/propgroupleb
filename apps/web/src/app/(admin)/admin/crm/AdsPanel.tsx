'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Loader2, PlugZap, CheckCircle2, XCircle, Send } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * What each Meta ad cost against what it produced.
 *
 * Ads Manager can say an ad got forty leads; only the CRM knows whether any of
 * them bought. This puts the two side by side so the budget follows the ads
 * that close, not the ones that are merely cheap to click.
 */

interface AdRow {
  adId: string
  name: string | null
  campaign: string | null
  spend: number | null
  leads: number
  won: number
  commissionUsd: number
  costPerLead: number | null
}

interface AdsReport {
  days: number
  currency: string
  spendConnected: boolean
  spendError: string | null
  totals: { spend: number | null; leads: number; won: number; commissionUsd: number }
  ads: AdRow[]
}

const RANGES = [30, 90, 365] as const

interface Check { name: string; ok: boolean; detail: string }

export function AdsPanel() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [days, setDays] = useState<(typeof RANGES)[number]>(90)
  const [report, setReport] = useState<AdsReport | null>(null)
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState<string | null>(null)

  const sendResults = async () => {
    setReporting(true)
    setReported(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm/ads/report-leads`, { method: 'POST', credentials: 'include' })
      const r = res.ok ? (await res.json()).data : null
      setReported(
        !r ? 'The report could not be run.'
          : r.firstError && !r.sent ? `Meta did not accept them: ${r.firstError}`
          : `Sent ${r.sent} to Meta${r.failed ? `, ${r.failed} refused (${r.firstError})` : ''}${r.skipped ? `, ${r.skipped} already up to date` : ''}.`
      )
    } finally { setReporting(false) }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/ads/test`, { credentials: 'include', cache: 'no-store' })
      setChecks(res.ok ? (await res.json()).data.checks : [{ name: 'Test', ok: false, detail: 'The test could not be run.' }])
    } finally { setTesting(false) }
  }

  useEffect(() => {
    let live = true
    fetch(`${apiUrl}/api/crm/ads?days=${days}`, { credentials: 'include', cache: 'no-store' })
      // 403 for a role that may not see money — the panel simply isn't shown.
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (live) setReport(json?.data ?? null) })
      .catch(() => { if (live) setReport(null) })
    return () => { live = false }
  }, [apiUrl, days])

  if (!report) return null

  const money = (n: number | null, currency = report.currency) =>
    n === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5 text-slate-300" /> Meta ads
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">What each ad cost, and the clients and deals it produced</p>
        </div>
        <button
          onClick={test}
          disabled={testing}
          className="min-h-9 px-3 rounded-lg border border-slate-300 text-slate-800 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />} Test the Meta connection
        </button>
        <button
          onClick={sendResults}
          disabled={reporting}
          title="Tell Meta which ad leads reached which stage, so it can optimise the ads for buyers"
          className="min-h-9 px-3 rounded-lg border border-slate-300 text-slate-800 text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {reporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send lead results to Meta
        </button>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`min-h-9 px-2.5 rounded-md text-xs font-medium ${days === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {r === 365 ? '1 year' : `${r} days`}
            </button>
          ))}
        </div>
      </div>

      {reported && <p className="text-sm text-slate-800 px-3.5 py-2.5 border-b border-slate-100">{reported}</p>}

      {checks && (
        <ul className="border-b border-slate-100 divide-y divide-slate-50">
          {checks.map((c) => (
            <li key={c.name} className="flex items-start gap-2 px-3.5 py-2">
              {c.ok
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
              <span className="text-sm min-w-0">
                <span className="font-semibold text-slate-900">{c.name}</span>
                <span className="block text-slate-700 break-words">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!report.spendConnected && (
        <p className="text-xs text-slate-500 px-3.5 py-2.5 border-b border-slate-100">
          Spend isn&apos;t connected yet, so only the CRM side is shown. Set <code>META_AD_ACCOUNT_ID</code> on the backend to add it.
        </p>
      )}
      {report.spendError && (
        <p className="text-xs text-red-600 px-3.5 py-2.5 border-b border-slate-100">
          Meta did not return spend: {report.spendError}
        </p>
      )}

      {report.ads.length === 0 ? (
        <p className="text-sm text-slate-500 px-3.5 py-6 text-center">No ad activity in this period.</p>
      ) : (
        <div className="pg-scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-3.5 py-2 font-semibold">Ad</th>
                <th className="px-3 py-2 font-semibold text-right">Spend</th>
                <th className="px-3 py-2 font-semibold text-right">Clients</th>
                <th className="px-3 py-2 font-semibold text-right hidden sm:table-cell">Cost / client</th>
                <th className="px-3 py-2 font-semibold text-right">Won</th>
                <th className="px-3.5 py-2 font-semibold text-right hidden sm:table-cell">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.ads.map((a) => (
                <tr key={a.adId}>
                  <td className="px-3.5 py-2 max-w-[260px]">
                    <p className="text-slate-800 truncate">{a.name ?? `Ad ${a.adId}`}</p>
                    {a.campaign && <p className="text-[11px] text-slate-500 truncate">{a.campaign}</p>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{money(a.spend)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${a.leads === 0 ? 'text-slate-300' : 'text-slate-900'}`}>{a.leads}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700 hidden sm:table-cell">{money(a.costPerLead)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${a.won === 0 ? 'text-slate-300' : 'text-emerald-700'}`}>{a.won}</td>
                  <td className="px-3.5 py-2 text-right tabular-nums text-slate-700 hidden sm:table-cell">{money(a.commissionUsd || null, 'USD')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td className="px-3.5 py-2">Total</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(report.totals.spend)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{report.totals.leads}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                  {money(report.totals.spend !== null && report.totals.leads > 0 ? report.totals.spend / report.totals.leads : null)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{report.totals.won}</td>
                <td className="px-3.5 py-2 text-right tabular-nums hidden sm:table-cell">{money(report.totals.commissionUsd || null, 'USD')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
