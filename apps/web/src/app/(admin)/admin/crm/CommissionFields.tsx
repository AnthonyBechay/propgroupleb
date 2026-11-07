'use client'

import { useEffect, useState } from 'react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { type Opportunity, payoutStatus } from './types'

/**
 * The commission part of the deal form.
 *
 * Commission is a percentage from the seller plus one from the buyer. The
 * boxes start empty and show the default they will use — the project's own
 * terms, else the market's (Settings → Commission) — so leaving them alone
 * keeps the deal on the default, and typing a figure makes it this deal's own.
 * The amount follows the price and the rates until somebody types one in.
 */

export interface Terms {
  sellerPct: string
  buyerPct: string
  commission: string
  /** The amount was typed in, so it no longer follows the rates. */
  commissionTyped: boolean
  brokerId: string
  brokerTakes: BrokerTakes
  brokerPct: string
  paidPct: string
  downPaymentPct: string
  planMonths: string
  planStartAt: string
  payoutAtPct: string
  received: boolean
  receivedOn: string
}

interface Defaults { sellerPct: number; buyerPct: number; payoutAtPct: number; source: 'project' | 'market' }
type BrokerTakes = 'SHARE' | 'SELLER_SIDE' | 'BUYER_SIDE'
interface BrokerOption { id: string; name: string; sharePct: number; takes?: BrokerTakes; active: boolean; company?: string | null }

/**
 * The month the client's payments reach the point we are paid at — mirrors
 * expectedPayoutDate() on the server. Null without a plan.
 */
export function expectedPayout(threshold: number, down: number, months: number, start: string): Date | null {
  if (threshold <= 0 || !start) return null
  const d = new Date(`${start}T12:00:00`)
  if (down >= threshold) return d
  if (!months || months <= 0 || down >= 100) return null
  d.setMonth(d.getMonth() + Math.ceil((threshold - down) / ((100 - down) / months) - 1e-9))
  return d
}

const str = (n: number | null | undefined) => (n == null ? '' : String(n))
const today = () => new Date().toISOString().slice(0, 10)

export function termsFrom(o?: Opportunity): Terms {
  return {
    sellerPct: str(o?.sellerPct),
    buyerPct: str(o?.buyerPct),
    commission: str(o?.commissionUsd),
    commissionTyped: o?.commissionUsd != null,
    brokerId: o?.brokerId ?? '',
    brokerTakes: o?.brokerTakes ?? 'SHARE',
    brokerPct: str(o?.brokerPct),
    paidPct: str(o?.paidPct),
    downPaymentPct: str(o?.downPaymentPct),
    planMonths: str(o?.planMonths),
    planStartAt: o?.planStartAt ? o.planStartAt.slice(0, 10) : '',
    payoutAtPct: str(o?.payoutAtPct),
    received: Boolean(o?.commissionReceivedAt),
    receivedOn: o?.commissionReceivedAt ? o.commissionReceivedAt.slice(0, 10) : today(),
  }
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

/** What the form sends. The amount only when typed: otherwise the server works it out. */
export function termsBody(t: Terms): Record<string, unknown> {
  return {
    sellerPct: numOrNull(t.sellerPct),
    buyerPct: numOrNull(t.buyerPct),
    ...(t.commissionTyped ? { commissionUsd: numOrNull(t.commission) } : {}),
    brokerId: t.brokerId || null,
    brokerTakes: t.brokerId ? t.brokerTakes : null,
    brokerPct: t.brokerId && t.brokerTakes === 'SHARE' ? numOrNull(t.brokerPct) : null,
    paidPct: numOrNull(t.paidPct),
    downPaymentPct: numOrNull(t.downPaymentPct),
    planMonths: t.planMonths.trim() === '' ? null : Math.round(Number(t.planMonths)),
    planStartAt: t.planStartAt ? new Date(`${t.planStartAt}T12:00:00`).toISOString() : null,
    ...(t.payoutAtPct.trim() !== '' ? { payoutAtPct: Number(t.payoutAtPct) } : {}),
    commissionReceivedAt: t.received ? new Date(`${t.receivedOn || today()}T12:00:00`).toISOString() : null,
  }
}

const inp = 'mt-0.5 w-full min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300'
const money = (n: number) => `$${Math.round(n).toLocaleString()}`

export function CommissionFields({
  terms: t, setTerms, price, currency, buildingId, market,
}: {
  terms: Terms
  setTerms: (fn: (t: Terms) => Terms) => void
  price: number | null
  currency: string
  buildingId?: string | null
  market?: string | null
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [defaults, setDefaults] = useState<Defaults | null>(null)
  const [brokers, setBrokers] = useState<BrokerOption[]>([])
  const set = (patch: Partial<Terms>) => setTerms((prev) => ({ ...prev, ...patch }))

  useEffect(() => {
    const ctl = new AbortController()
    const q = new URLSearchParams({ ...(buildingId ? { buildingId } : {}), ...(market ? { market } : {}) })
    fetch(`${apiUrl}/api/finance/commission/terms?${q}`, { credentials: 'include', signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setDefaults(j.data) })
      .catch(() => {})
    return () => ctl.abort()
  }, [apiUrl, buildingId, market])

  useEffect(() => {
    fetch(`${apiUrl}/api/finance/brokers`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setBrokers(j?.data ?? []))
      .catch(() => {})
  }, [apiUrl])

  const seller = t.sellerPct !== '' ? Number(t.sellerPct) : defaults?.sellerPct ?? 0
  const buyer = t.buyerPct !== '' ? Number(t.buyerPct) : defaults?.buyerPct ?? 0
  const auto = price != null && currency === 'USD' ? Math.round((price * (seller + buyer)) / 100) : null

  // An existing figure that is exactly what the rates give is not a typed one.
  useEffect(() => {
    if (t.commissionTyped && auto != null && t.commission !== '' && Number(t.commission) === auto) set({ commissionTyped: false })
  }, [auto]) // eslint-disable-line react-hooks/exhaustive-deps

  const commission = t.commissionTyped ? numOrNull(t.commission) : auto
  const brokerPct = t.brokerId ? (t.brokerPct !== '' ? Number(t.brokerPct) : 0) : 0
  // A side is that side's rate on the price, never more than the whole commission.
  const side = price != null && currency === 'USD'
    ? Math.round((price * (t.brokerTakes === 'SELLER_SIDE' ? seller : buyer)) / 100)
    : null
  const cut = !t.brokerId ? null
    : t.brokerTakes === 'SHARE'
      ? (commission != null ? Math.round((commission * brokerPct) / 100) : null)
      : side != null && commission != null ? Math.min(side, commission) : side
  const threshold = t.payoutAtPct !== '' ? Number(t.payoutAtPct) : defaults?.payoutAtPct ?? 0
  const from = defaults?.source === 'project' ? "project's terms" : 'market default'

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Commission</p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-slate-500">From the seller, %</span>
          <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={t.sellerPct}
            placeholder={defaults ? `${defaults.sellerPct} (${from})` : ''}
            onChange={(e) => set({ sellerPct: e.target.value })} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">From the buyer, %</span>
          <input type="number" min="0" max="100" step="0.1" inputMode="decimal" value={t.buyerPct}
            placeholder={defaults ? `${defaults.buyerPct} (${from})` : ''}
            onChange={(e) => set({ buyerPct: e.target.value })} className={inp} />
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] text-slate-500">
          Our commission (USD){!t.commissionTyped && auto != null ? ` — ${seller + buyer}% of the price` : ''}
        </span>
        <input type="number" min="0" inputMode="decimal"
          value={t.commissionTyped ? t.commission : auto != null ? String(auto) : ''}
          placeholder={currency !== 'USD' ? 'Type it in — not worked out from LBP' : 'Set the price to work it out'}
          onChange={(e) => set({ commission: e.target.value, commissionTyped: true })} className={inp} />
        {t.commissionTyped && auto != null && Number(t.commission) !== auto && (
          <button type="button" onClick={() => set({ commissionTyped: false, commission: '' })}
            className="mt-0.5 text-[11px] text-slate-500 underline decoration-dotted hover:text-slate-800">
            Use the rates instead ({money(auto)})
          </button>
        )}
      </label>

      <label className="block">
        <span className="text-[11px] text-slate-500">Broker</span>
        <select value={t.brokerId} className={inp}
          onChange={(e) => {
            const b = brokers.find((x) => x.id === e.target.value)
            set({ brokerId: e.target.value, brokerPct: b ? String(b.sharePct) : '', brokerTakes: b?.takes ?? 'SHARE' })
          }}>
          <option value="">No broker</option>
          {brokers.filter((b) => b.active || b.id === t.brokerId).map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.company ? ` · ${b.company}` : ''}</option>
          ))}
        </select>
      </label>
      {t.brokerId && (
        <div className="grid grid-cols-3 gap-2">
          <label className={`block ${t.brokerTakes === 'SHARE' ? 'col-span-2' : 'col-span-3'}`}>
            <span className="text-[11px] text-slate-500">He takes</span>
            <select value={t.brokerTakes} onChange={(e) => set({ brokerTakes: e.target.value as BrokerTakes })} className={inp}>
              <option value="SHARE">A share of our commission</option>
              <option value="SELLER_SIDE">The seller&apos;s side — he brought the seller</option>
              <option value="BUYER_SIDE">The buyer&apos;s side — he brought the buyer</option>
            </select>
          </label>
          {t.brokerTakes === 'SHARE' && (
            <label className="block">
              <span className="text-[11px] text-slate-500">Share, %</span>
              <input type="number" min="0" max="100" step="1" inputMode="decimal" value={t.brokerPct}
                onChange={(e) => set({ brokerPct: e.target.value })} className={inp} />
            </label>
          )}
        </div>
      )}
      {t.brokerId && commission != null && (
        <p className="text-[11px] text-slate-600">
          Broker gets {money(cut ?? 0)}{t.brokerTakes !== 'SHARE' ? ` (${t.brokerTakes === 'SELLER_SIDE' ? seller : buyer}% of the price)` : ''} · we keep <strong>{money(commission - (cut ?? 0))}</strong>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-slate-500">We are paid once they have paid, %</span>
          <input type="number" min="0" max="100" step="1" inputMode="decimal" value={t.payoutAtPct}
            placeholder={defaults ? `${defaults.payoutAtPct || 0}${defaults.payoutAtPct ? '' : ' = on closing'}` : ''}
            onChange={(e) => set({ payoutAtPct: e.target.value })} className={inp} />
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500">They have paid so far, %</span>
          <input type="number" min="0" max="100" step="1" inputMode="decimal" value={t.paidPct}
            placeholder="0"
            onChange={(e) => set({ paidPct: e.target.value })} className={inp} />
        </label>
      </div>
      {threshold > 0 && (
        <>
          <p className="pt-1 text-[11px] font-semibold text-slate-600">Their payment plan</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[11px] text-slate-500">Down payment, %</span>
              <input type="number" min="0" max="100" step="1" inputMode="decimal" value={t.downPaymentPct} placeholder="20"
                onChange={(e) => set({ downPaymentPct: e.target.value })} className={inp} />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Then monthly for</span>
              <input type="number" min="0" max="240" step="1" inputMode="numeric" value={t.planMonths} placeholder="36 months"
                onChange={(e) => set({ planMonths: e.target.value })} className={inp} />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500">Down payment on</span>
              <input type="date" value={t.planStartAt} onChange={(e) => set({ planStartAt: e.target.value })} className={inp} />
            </label>
          </div>
          <PlanLine
            threshold={threshold}
            paid={Number(t.paidPct || 0)}
            price={price}
            down={Number(t.downPaymentPct || 0)}
            months={Number(t.planMonths || 0)}
            start={t.planStartAt}
          />
        </>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <label className="inline-flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={t.received} onChange={(e) => set({ received: e.target.checked })} className="h-4 w-4" />
          Commission received
        </label>
        {t.received && (
          <input type="date" value={t.receivedOn} onChange={(e) => set({ receivedOn: e.target.value })}
            className="min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm" />
        )}
      </div>
    </div>
  )
}

/**
 * What the plan means: how much each payment is, the month the commission
 * falls due, and whether that month has passed.
 */
function PlanLine({ threshold, paid, price, down, months, start }: {
  threshold: number; paid: number; price: number | null; down: number; months: number; start: string
}) {
  if (paid >= threshold) {
    return <p className="text-[11px] text-emerald-700">They have paid {paid}% — past the {threshold}%, so the commission is due. Ask the developer for it.</p>
  }
  const at = expectedPayout(threshold, down, months, start)
  if (!at) {
    return <p className="text-[11px] text-amber-700">Commission is due when they reach {threshold}% (now {paid}%). Add the plan to know when.</p>
  }
  const monthly = months > 0 ? (100 - down) / months : 0
  const late = at.getTime() <= Date.now()
  const when = at.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return (
    <p className={`text-[11px] ${late ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
      {price != null && `${money((price * down) / 100)} down, then ${monthly ? `${money((price * monthly) / 100)} a month` : 'nothing monthly'}. `}
      {late
        ? `They should have reached ${threshold}% by ${when} — chase the developer for the commission.`
        : `They reach ${threshold}% in ${when}: that is when the commission is ours.`}
    </p>
  )
}

/** One line under a deal: where its money stands. */
export function PayoutLine({ deal: d }: { deal: Opportunity }) {
  const status = payoutStatus(d)
  if (!status) return null
  const net = (d.commissionUsd ?? 0) - (d.brokerCutUsd ?? 0)
  const at = status === 'WAITING'
    ? expectedPayout(d.payoutAtPct ?? 0, d.downPaymentPct ?? 0, d.planMonths ?? 0, d.planStartAt?.slice(0, 10) ?? '')
    : null
  const late = at != null && at.getTime() <= Date.now()
  const text = status === 'RECEIVED'
    ? `Received${d.commissionReceivedAt ? ` ${new Date(d.commissionReceivedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`
    : status === 'DUE'
      ? `Due to us${net ? `: ${money(net)}` : ''}`
      : (d.payoutAtPct ?? 0) > 0
        ? at
          ? late
            ? `Should be due since ${at.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} — chase the developer`
            : `Due ${at.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}, when they reach ${d.payoutAtPct}%`
          : `Waiting — they have paid ${d.paidPct ?? 0}% of the ${d.payoutAtPct}% we are paid at`
        : 'Paid when the sale closes'
  const cls = status === 'RECEIVED' ? 'text-emerald-700 bg-emerald-50' : status === 'DUE' || late ? 'text-red-700 bg-red-50' : 'text-amber-800 bg-amber-50'
  return <p className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{text}</p>
}
