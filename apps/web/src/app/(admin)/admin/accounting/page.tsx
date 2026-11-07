'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Plus, Pencil, Trash2, Check, X, Wallet, Receipt, Landmark, TrendingUp, Clock, Repeat, BellRing } from 'lucide-react'
import { PageHeader, StatCard, EmptyState } from '@/components/admin/ui/layout'
import { normalizeApiUrl } from '@/lib/utils/api-url'

type Category = 'OFFICE' | 'SALARIES' | 'MARKETING' | 'TRAVEL' | 'FEES' | 'TAX' | 'OTHER'

const CATEGORY_LABEL: Record<Category, string> = {
  OFFICE: 'Office (rent, utilities, supplies)',
  SALARIES: 'Salaries',
  MARKETING: 'Marketing and ads',
  TRAVEL: 'Travel',
  FEES: 'Fees (bank, legal, software)',
  TAX: 'Tax',
  OTHER: 'Other',
}
const SHORT_LABEL: Record<Category, string> = {
  OFFICE: 'Office', SALARIES: 'Salaries', MARKETING: 'Marketing', TRAVEL: 'Travel', FEES: 'Fees', TAX: 'Tax', OTHER: 'Other',
}

interface Expense {
  id: string
  date: string
  category: Category
  amountUsd: number
  description: string | null
  market: 'LEBANON' | 'GEORGIA' | null
}

interface DealRow {
  id: string
  lead: { id: string; name: string; market: string }
  broker: { id: string; name: string } | null
  title: string
  stage: string
  soldPrice: number | null
  soldCurrency: string
  commissionUsd: number | null
  brokerCutUsd: number | null
  netUsd: number
  paidPct: number | null
  payoutAtPct: number | null
  downPaymentPct: number | null
  planMonths: number | null
  planStartAt: string | null
  /** The month the client's payments reach the payout point, from their plan. */
  expectedAt: string | null
  /** What the plan says they should have paid by today, %. */
  expectedPaidNow: number | null
  closedAt: string | null
  commissionReceivedAt: string | null
}

interface PlanRow extends DealRow {
  /** Past the expected month, or already paid past the point: ask the developer. */
  chase: boolean
}

interface Recurring {
  id: string
  category: Category
  amountUsd: number
  description: string | null
  market: 'LEBANON' | 'GEORGIA' | null
  dayOfMonth: number
  startsOn: string
  endsOn: string | null
  active: boolean
}

interface Summary {
  income: { gross: number; brokerCuts: number; sellerSide: number; net: number }
  expenses: { byCategory: Partial<Record<Category, number>>; costs: number; tax: number; total: number }
  profitBeforeTax: number
  profitAfterTax: number
  months: Array<{ month: string; income: number; costs: number; tax: number; profit: number }>
  received: DealRow[]
  due: DealRow[]
  waiting: DealRow[]
  plans: PlanRow[]
}

const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const inp = 'mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'

type PeriodKey = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year' | 'custom'
const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_year', label: 'This year' },
  { key: 'last_year', label: 'Last year' },
  { key: 'custom', label: 'Custom' },
]

function rangeOf(key: PeriodKey): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (key) {
    case 'this_month': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
    case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case 'this_quarter': { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) } }
    case 'last_year': return { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)) }
    default: return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) }
  }
}

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

type Draft = { date: string; category: Category; amount: string; description: string; market: '' | 'LEBANON' | 'GEORGIA' }
const newDraft = (): Draft => ({ date: iso(new Date()), category: 'OFFICE', amount: '', description: '', market: '' })

/**
 * The office's books: commission in, expenses out, and what is left.
 *
 * Profit is on money actually received — commission counts on the day it
 * arrived, net of any broker's share — because a Georgian sale reserved today
 * may not pay us for months. What is owed, and what is still waiting on a
 * client's payment plan, is shown beside it and never counted as profit.
 */
export default function AccountingPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [period, setPeriod] = useState<PeriodKey>('this_year')
  const [custom, setCustom] = useState(rangeOf('this_year'))
  const range = period === 'custom' ? custom : rangeOf(period)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(newDraft)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const q = `from=${range.from}&to=${range.to}`
    try {
      const [s, e] = await Promise.all([
        fetch(`${apiUrl}/api/finance/summary?${q}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/finance/expenses?${q}`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (!s.ok || !e.ok) throw new Error()
      setSummary((await s.json()).data)
      setExpenses((await e.json()).data ?? [])
    } catch {
      setError('Could not load the accounts. Check your connection.')
    } finally { setLoading(false) }
  }, [apiUrl, range.from, range.to])
  useEffect(() => { void load() }, [load])

  const startEdit = (e?: Expense) => {
    setEditing(e ? e.id : 'new')
    setDraft(e
      ? { date: e.date.slice(0, 10), category: e.category, amount: String(e.amountUsd), description: e.description ?? '', market: e.market ?? '' }
      : newDraft())
  }

  async function saveExpense() {
    const amount = Number(draft.amount)
    if (!draft.amount || !Number.isFinite(amount) || amount < 0) { setError('Enter the amount in USD.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/finance/expenses${editing === 'new' ? '' : `/${editing}`}`, {
        method: editing === 'new' ? 'POST' : 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: draft.date, category: draft.category, amountUsd: amount,
          description: draft.description.trim() || null, market: draft.market || null,
        }),
      })
      if (!res.ok) throw new Error()
      setEditing(null)
      await load()
    } catch {
      setError('That expense did not save. Try again.')
    } finally { setBusy(false) }
  }

  async function removeExpense(e: Expense) {
    if (!window.confirm(`Delete this ${SHORT_LABEL[e.category].toLowerCase()} expense of ${money(e.amountUsd)}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/finance/expenses/${e.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError('That did not delete. Try again.')
    } finally { setBusy(false) }
  }

  async function markReceived(d: DealRow) {
    const date = window.prompt(`Commission from ${d.lead.name} received on (YYYY-MM-DD):`, iso(new Date()))
    if (date === null) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/finance/deals/${d.id}/received`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received: true, date: date || iso(new Date()) }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError('That did not save. Try again.')
    } finally { setBusy(false) }
  }

  const categories = useMemo(
    () => (Object.entries(summary?.expenses.byCategory ?? {}) as Array<[Category, number]>).sort((a, b) => b[1] - a[1]),
    [summary],
  )
  const owed = (summary?.due ?? []).reduce((t, d) => t + d.netUsd, 0)
  const waitingRows = (summary?.waiting ?? []).filter((d) => !((d.payoutAtPct ?? 0) > 0))
  const waiting = waitingRows.reduce((t, d) => t + d.netUsd, 0)

  const expenseForm = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block text-sm text-slate-700">Date<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={inp} /></label>
        <label className="block text-sm text-slate-700">Amount (USD)<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className={inp} autoFocus /></label>
        <label className="col-span-2 block text-sm text-slate-700">Type
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })} className={inp}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="col-span-2 block text-sm text-slate-700 sm:col-span-3">What for<input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="November rent, Achrafieh office" className={inp} /></label>
        <label className="col-span-2 block text-sm text-slate-700 sm:col-span-1">Office
          <select value={draft.market} onChange={(e) => setDraft({ ...draft, market: e.target.value as Draft['market'] })} className={inp}>
            <option value="">Shared</option>
            <option value="LEBANON">Lebanon</option>
            <option value="GEORGIA">Georgia</option>
          </select>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Cancel</button>
        <button onClick={saveExpense} disabled={busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting"
        description="Commission received, expenses and tax, and what is left. Commission counts on the day it arrives, after the broker's share."
      />

      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${period === p.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <span className="flex items-center gap-2">
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="min-h-11 rounded-lg border border-slate-200 px-2 text-sm" />
            <span className="text-slate-400">to</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="min-h-11 rounded-lg border border-slate-200 px-2 text-sm" />
          </span>
        )}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard icon={<Wallet className="h-3.5 w-3.5" />} label="Commission received" value={money(summary.income.net)}
              hint={summary.income.brokerCuts > 0 ? `${money(summary.income.gross + summary.income.sellerSide)} less ${money(summary.income.brokerCuts)} to brokers` : undefined}
              accent="text-emerald-700" />
            <StatCard icon={<Receipt className="h-3.5 w-3.5" />} label="Expenses" value={money(summary.expenses.costs)} hint="Before tax" />
            <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Profit before tax" value={money(summary.profitBeforeTax)}
              accent={summary.profitBeforeTax < 0 ? 'text-red-600' : 'text-slate-900'} />
            <StatCard icon={<Landmark className="h-3.5 w-3.5" />} label="Tax" value={money(summary.expenses.tax)} />
            <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Profit after tax" value={money(summary.profitAfterTax)}
              accent={summary.profitAfterTax < 0 ? 'text-red-600' : 'text-emerald-700'} />
          </div>

          {/* Money not in yet — never counted as profit. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Owed to us now <span className="font-normal text-slate-500">· {money(owed)}</span></h2>
              <p className="mt-0.5 text-xs text-slate-500">Earned and not received yet. Mark each one when the money arrives.</p>
              {summary.due.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing outstanding.</p> : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {summary.due.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{d.lead.name} <span className="font-normal text-slate-500">· {d.title}</span></p>
                        <p className="text-xs text-slate-500">{money(d.netUsd)}{d.broker ? ` after ${money(d.brokerCutUsd ?? 0)} to ${d.broker.name}` : ''}</p>
                      </div>
                      <button onClick={() => markReceived(d)} disabled={busy} className="min-h-11 shrink-0 rounded-lg border border-emerald-200 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Received</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900"><Clock className="-mt-0.5 mr-1 inline h-4 w-4 text-amber-600" />Waiting on clients <span className="font-normal text-slate-500">· {money(waiting)}</span></h2>
              <p className="mt-0.5 text-xs text-slate-500">Agreed, but paid when the sale closes. Payment plans are below.</p>
              {waitingRows.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing waiting.</p> : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {waitingRows.map((d) => (
                    <li key={d.id} className="py-2">
                      <p className="truncate text-sm font-medium text-slate-900">{d.lead.name} <span className="font-normal text-slate-500">· {d.title}</span></p>
                      <p className="text-xs text-slate-500">
                        {money(d.netUsd)} · {(d.payoutAtPct ?? 0) > 0 ? `paid ${d.paidPct ?? 0}% of ${d.payoutAtPct}%` : 'paid when it closes'}
                      </p>
                      {(d.payoutAtPct ?? 0) > 0 && (
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, ((d.paidPct ?? 0) / (d.payoutAtPct ?? 1)) * 100)}%` }} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-slate-500">Update what a client has paid from their card, under Deal &amp; commission.</p>
            </section>
          </div>

          <PlansSection plans={summary.plans} busy={busy} onReceived={markReceived} />

          {/* Expenses */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-sm font-semibold text-slate-900">Expenses <span className="font-normal text-slate-500">· {money(summary.expenses.total)} with tax</span></h2>
              {editing === null && (
                <button onClick={() => startEdit()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">
                  <Plus className="h-4 w-4" /> Add expense
                </button>
              )}
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map(([c, v]) => (
                  <span key={c} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${c === 'TAX' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {SHORT_LABEL[c]} {money(v)}
                  </span>
                ))}
              </div>
            )}

            {editing === 'new' && expenseForm}

            {expenses.length === 0 && editing !== 'new' ? (
              <EmptyState icon={<Receipt className="h-8 w-8" />} title="No expenses in this period" description="Add rent, salaries, ads, fees and tax as they are paid." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {expenses.map((e) => (
                  <li key={e.id} className="py-2">
                    {editing === e.id ? expenseForm : (
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-xs text-slate-500">{new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-900">{e.description || SHORT_LABEL[e.category]}</p>
                          <p className="text-xs text-slate-500">{SHORT_LABEL[e.category]}{e.market ? ` · ${e.market === 'LEBANON' ? 'Lebanon' : 'Georgia'}` : ''}</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-slate-900">{money(e.amountUsd)}</span>
                        <button onClick={() => startEdit(e)} aria-label="Edit expense" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => removeExpense(e)} aria-label="Delete expense" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <RecurringSection apiUrl={apiUrl} onChanged={load} />

          {/* Month by month */}
          {summary.months.length > 1 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Month by month</h2>
              <div className="pg-scroll-x mt-2">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1.5 font-medium">Month</th>
                      <th className="py-1.5 text-right font-medium">Received</th>
                      <th className="py-1.5 text-right font-medium">Expenses</th>
                      <th className="py-1.5 text-right font-medium">Tax</th>
                      <th className="py-1.5 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.months.map((m) => (
                      <tr key={m.month}>
                        <td className="py-1.5 text-slate-700">{monthLabel(m.month)}</td>
                        <td className="py-1.5 text-right text-emerald-700">{m.income ? money(m.income) : '—'}</td>
                        <td className="py-1.5 text-right text-slate-700">{m.costs ? money(m.costs) : '—'}</td>
                        <td className="py-1.5 text-right text-slate-700">{m.tax ? money(m.tax) : '—'}</td>
                        <td className={`py-1.5 text-right font-semibold ${m.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{money(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* What came in */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Commission received in this period</h2>
            {summary.received.length === 0 ? <p className="mt-2 text-sm text-slate-500">None.</p> : (
              <ul className="mt-2 divide-y divide-slate-100">
                {summary.received.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 py-2">
                    <span className="w-20 shrink-0 text-xs text-slate-500">{d.commissionReceivedAt ? new Date(d.commissionReceivedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-900">{d.lead.name} <span className="text-slate-500">· {d.title}</span></p>
                      {d.broker && <p className="text-xs text-slate-500">{money(d.brokerCutUsd ?? 0)} to {d.broker.name}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-emerald-700">{money(d.netUsd)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Rates and brokers: <Link href="/admin/settings/commission" className="underline">Commission settings</Link> · <Link href="/admin/brokers" className="underline">Brokers</Link>
            </p>
          </section>
        </>
      )}
    </div>
  )
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })

/**
 * Payment plans, by the month the commission should be ours. A row turns red
 * when that month has passed (or the client has paid past the point) and the
 * money has not come: that is the developer to call.
 */
function PlansSection({ plans, busy, onReceived }: { plans: PlanRow[]; busy: boolean; onReceived: (d: DealRow) => void }) {
  const chase = plans.filter((p) => p.chase)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        <BellRing className="-mt-0.5 mr-1 inline h-4 w-4 text-slate-500" />Payment plans
        {chase.length > 0 && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{chase.length} to chase</span>}
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        When each client&apos;s payments reach the point we are paid at. Red: that month has passed — ask the developer for the commission.
      </p>
      {plans.length === 0 ? <p className="mt-3 text-sm text-slate-500">No deals on a payment plan.</p> : (
        <ul className="mt-2 divide-y divide-slate-100">
          {plans.map((d) => {
            const threshold = d.payoutAtPct ?? 0
            const paid = d.paidPct ?? 0
            return (
              <li key={d.id} className={`flex items-start gap-2 py-2.5 ${d.chase ? '-mx-2 rounded-lg bg-red-50 px-2' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{d.lead.name} <span className="font-normal text-slate-500">· {d.title}</span></p>
                  <p className={`text-xs ${d.chase ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
                    {paid >= threshold
                      ? `Paid ${paid}% — past ${threshold}%. Commission due now.`
                      : d.expectedAt
                        ? d.chase
                          ? `Should have reached ${threshold}% by ${monthYear(d.expectedAt)} — chase the developer`
                          : `Reaches ${threshold}% in ${monthYear(d.expectedAt)}`
                        : `Due at ${threshold}% — add their payment plan to know when`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {money(d.netUsd)} to us
                    {d.downPaymentPct != null && ` · ${d.downPaymentPct}% down`}
                    {d.planMonths ? ` + ${d.planMonths} monthly` : ''}
                    {` · recorded paid ${paid}%`}
                    {d.expectedPaidNow != null && d.expectedPaidNow !== paid && ` (plan says ${d.expectedPaidNow}% by now)`}
                  </p>
                  <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${d.chase ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, threshold ? (Math.max(paid, d.expectedPaidNow ?? 0) / threshold) * 100 : 0)}%` }} />
                  </div>
                </div>
                {d.chase && (
                  <button onClick={() => onReceived(d)} disabled={busy} className="min-h-11 shrink-0 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Received</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">Each plan is set on the client&apos;s card, under Deal &amp; commission.</p>
    </section>
  )
}

type RDraft = { description: string; category: Category; amount: string; day: string; startsOn: string; endsOn: string; market: '' | 'LEBANON' | 'GEORGIA' }
const firstOfMonth = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)) }
const newRDraft = (): RDraft => ({ description: '', category: 'OFFICE', amount: '', day: '0', startsOn: firstOfMonth(), endsOn: '', market: '' })
const dayLabel = (n: number) => (n <= 0 ? 'last day of the month' : `the ${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`)

/**
 * Rent, salaries, subscriptions: added to the expenses by themselves each
 * month on their day. Deleting one month's entry skips that month; changing
 * the amount applies from the next month on.
 */
function RecurringSection({ apiUrl, onChanged }: { apiUrl: string; onChanged: () => void }) {
  const [items, setItems] = useState<Recurring[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<RDraft>(newRDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/finance/recurring`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error()
      setItems((await res.json()).data ?? [])
    } catch { setItems([]); setError('Could not load the recurring expenses.') }
  }, [apiUrl])
  useEffect(() => { void load() }, [load])

  const start = (r?: Recurring) => {
    setError(null)
    setEditing(r ? r.id : 'new')
    setDraft(r
      ? { description: r.description ?? '', category: r.category, amount: String(r.amountUsd), day: String(r.dayOfMonth), startsOn: r.startsOn.slice(0, 10), endsOn: r.endsOn ? r.endsOn.slice(0, 10) : '', market: r.market ?? '' }
      : newRDraft())
  }

  async function save() {
    const amount = Number(draft.amount)
    if (!draft.amount || !Number.isFinite(amount) || amount < 0) { setError('Enter the monthly amount in USD.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/finance/recurring${editing === 'new' ? '' : `/${editing}`}`, {
        method: editing === 'new' ? 'POST' : 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: draft.description.trim() || null, category: draft.category, amountUsd: amount,
          dayOfMonth: Number(draft.day), startsOn: draft.startsOn, endsOn: draft.endsOn || null, market: draft.market || null,
        }),
      })
      if (!res.ok) throw new Error()
      setEditing(null)
      await load()
      onChanged()
    } catch { setError('That did not save. Try again.') } finally { setBusy(false) }
  }

  async function toggle(r: Recurring) {
    setBusy(true)
    try {
      await fetch(`${apiUrl}/api/finance/recurring/${r.id}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !r.active }),
      })
      await load(); onChanged()
    } finally { setBusy(false) }
  }

  async function remove(r: Recurring) {
    if (!window.confirm(`Stop "${r.description || SHORT_LABEL[r.category]}"? The months already added stay in the books.`)) return
    setBusy(true)
    try {
      await fetch(`${apiUrl}/api/finance/recurring/${r.id}`, { method: 'DELETE', credentials: 'include' })
      await load(); onChanged()
    } finally { setBusy(false) }
  }

  const form = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 block text-sm text-slate-700">What<input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Office rent, Achrafieh" className={inp} autoFocus /></label>
        <label className="block text-sm text-slate-700">Each month (USD)<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className={inp} /></label>
        <label className="block text-sm text-slate-700">On
          <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} className={inp}>
            <option value="0">Last day of the month</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
        </label>
        <label className="col-span-2 block text-sm text-slate-700">Type
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })} className={inp}>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="block text-sm text-slate-700">Starting<input type="date" value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} className={inp} /></label>
        <label className="block text-sm text-slate-700">Until (optional)<input type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} className={inp} /></label>
        <label className="col-span-2 block text-sm text-slate-700 sm:col-span-1">Office
          <select value={draft.market} onChange={(e) => setDraft({ ...draft, market: e.target.value as RDraft['market'] })} className={inp}>
            <option value="">Shared</option>
            <option value="LEBANON">Lebanon</option>
            <option value="GEORGIA">Georgia</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-slate-500">Months from the start date up to today are added at once; after that, each on its day.</p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Cancel</button>
        <button onClick={save} disabled={busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
        </button>
      </div>
    </div>
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold text-slate-900"><Repeat className="-mt-0.5 mr-1 inline h-4 w-4 text-slate-500" />Recurring expenses</h2>
        {editing === null && (
          <button onClick={() => start()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add recurring
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">Added to the expenses by themselves every month. To skip one month, delete that month&apos;s entry above.</p>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {editing === 'new' && form}
      {items === null ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : items.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-slate-500">None yet — add rent, salaries and subscriptions here.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((r) => (
            <li key={r.id} className="py-2">
              {editing === r.id ? form : (
                <div className={`flex items-center gap-2 ${r.active ? '' : 'opacity-60'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">{r.description || SHORT_LABEL[r.category]}{!r.active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">Paused</span>}</p>
                    <p className="text-xs text-slate-500">
                      {SHORT_LABEL[r.category]} · on {dayLabel(r.dayOfMonth)} · from {monthYear(r.startsOn)}{r.endsOn ? ` to ${monthYear(r.endsOn)}` : ''}
                      {r.market ? ` · ${r.market === 'LEBANON' ? 'Lebanon' : 'Georgia'}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">{money(r.amountUsd)}<span className="text-xs font-normal text-slate-500">/mo</span></span>
                  <button onClick={() => toggle(r)} disabled={busy} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100">{r.active ? 'Pause' : 'Resume'}</button>
                  <button onClick={() => start(r)} aria-label="Edit recurring expense" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(r)} aria-label="Stop recurring expense" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
