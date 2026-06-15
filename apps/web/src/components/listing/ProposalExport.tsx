'use client'

import { useState } from 'react'
import { Download, Loader2, Check } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'
import type { Listing } from '@/types'

const MOHAFAZAT_LABELS: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}

function money(amount: number, currency = 'USD'): string {
  if (currency === 'LBP') return `LBP ${Math.round(amount).toLocaleString()}`
  return `$${Math.round(amount).toLocaleString()}`
}

interface OptionPlan {
  name: string
  total: number
  currency: string
  down: number
  downPct: number
  months: number
  installmentsTotal: number
  monthly: number
  includes: string[]
  idealFor?: string | null
}

/**
 * Client-facing "Investment Proposal" PDF export for a listing.
 *
 * Renders a hidden, print-only A4 proposal sheet and a button that triggers the
 * browser's print-to-PDF. No PDF library — print isolation via CSS (visibility
 * trick) so none of the app chrome leaks onto the page. Layout follows the
 * standard proposal format: header → acquisition options → payment plan →
 * investment highlights.
 */
export function ProposalExport({ listing }: { listing: Listing }) {
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)

  const { unit, building } = listing
  const b = building ?? unit?.building
  const area = unit?.areaSqm ?? null

  const locParts = [b?.neighborhood, b?.city, b?.caza, b?.mohafazat ? (MOHAFAZAT_LABELS[b.mohafazat] ?? b.mohafazat) : null].filter(Boolean)
  const location = locParts.length ? `${locParts.join(', ')}, Lebanon` : 'Lebanon'
  const title = listing.headline ?? unit?.name ?? b?.title ?? 'Property'
  const subline = [
    b?.title,
    unit?.floor != null ? `Floor ${unit.floor}` : null,
    unit?.views?.length ? unit.views.map((v) => v.replace(/_/g, ' ').toLowerCase()).join(' / ') + ' view' : null,
  ].filter(Boolean).join('  ·  ')

  const inv = building?.investmentData ?? null
  const downPct = inv?.downPaymentPercentage ?? 40

  // Build the acquisition options. Prefer real UnitOptions; otherwise synthesize
  // a single option from the listing price.
  const rawOptions = unit?.options && unit.options.length > 0 ? unit.options : null
  const optionSource = (rawOptions ?? [{ name: 'Purchase' }]) as unknown as Record<string, unknown>[]
  const options: OptionPlan[] = optionSource.map((o) => {
    const ppsm = typeof o.pricePerSqm === 'number' ? o.pricePerSqm : null
    const total = ppsm != null && area ? ppsm * area
      : typeof o.askingPrice === 'number' ? o.askingPrice
      : listing.price
    const currency = (o.currency as string) || (o.askingCurrency as string) || listing.currency || 'USD'
    const down = typeof o.initialPayment === 'number' ? o.initialPayment : Math.round((total * downPct) / 100)
    const plan = (o.paymentPlanDetails ?? {}) as Record<string, unknown>
    const months = typeof plan.months === 'number' ? plan.months : (inv?.installmentYears ? inv.installmentYears * 12 : 30)
    const installmentsTotal = Math.max(total - down, 0)
    const monthly = typeof plan.monthly === 'number' ? plan.monthly : (months > 0 ? installmentsTotal / months : 0)
    const includes = Array.isArray(plan.includes) ? (plan.includes as string[]) : []
    return {
      name: (o.name as string) || 'Purchase',
      total, currency,
      down, downPct: total > 0 ? Math.round((down / total) * 100) : downPct,
      months, installmentsTotal, monthly,
      includes,
      idealFor: (o.description as string) ?? null,
    }
  })

  // Investment highlight cards (use real metrics when present).
  const highlights = [
    {
      title: 'Capital Appreciation',
      value: inv?.capitalGrowth != null ? `${inv.capitalGrowth}%` : inv?.annualAppreciation != null ? `${inv.annualAppreciation}%/yr` : null,
      desc: inv?.capitalGrowth != null ? 'Projected appreciation' : 'Strong growth potential in a prime location',
    },
    {
      title: 'High Rental Yield',
      value: inv?.rentalYield != null ? `${inv.rentalYield}%` : null,
      desc: inv?.rentalYield != null ? 'Expected gross rental yield' : 'Premium positioning drives strong rental demand',
    },
    {
      title: 'Return on Investment',
      value: inv?.expectedROI != null ? `${inv.expectedROI}%` : null,
      desc: inv?.expectedROI != null ? 'Projected ROI' : 'Attractive price point & high liquidity',
    },
    {
      title: 'Strategic Exit',
      value: null,
      desc: 'Flexible resale or long-term rental income strategy',
    },
  ]

  async function exportPdf() {
    setExporting(true)
    document.documentElement.classList.add('pg-exporting')
    // Give the print sheet's logo/images a beat to be present.
    await new Promise((r) => setTimeout(r, 250))
    const cleanup = () => {
      document.documentElement.classList.remove('pg-exporting')
      setExporting(false)
      setDone(true)
      setTimeout(() => setDone(false), 2500)
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    // Safari/fallback: ensure cleanup even if afterprint doesn't fire.
    setTimeout(() => { if (document.documentElement.classList.contains('pg-exporting')) cleanup() }, 1500)
  }

  const logo = normalizeFileUrl('/logo.png')

  return (
    <>
      <button
        type="button"
        onClick={exportPdf}
        disabled={exporting}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
        {exporting ? 'Preparing PDF…' : done ? 'Ready' : 'Export investment proposal (PDF)'}
      </button>

      {/* Print-isolation CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        #pg-proposal { display: none; }
        @media print {
          html.pg-exporting body * { visibility: hidden !important; }
          html.pg-exporting #pg-proposal, html.pg-exporting #pg-proposal * { visibility: visible !important; }
          html.pg-exporting #pg-proposal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4; margin: 12mm; }
        }
      ` }} />

      {/* The proposal sheet (hidden on screen, shown only when printing) */}
      <div id="pg-proposal" aria-hidden className="text-slate-900" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {/* Header */}
        <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="PropGroup" style={{ height: 56 }} />
            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
              <div style={{ letterSpacing: 2, fontWeight: 700, color: '#1e293b' }}>INVESTMENT PROPOSAL</div>
              <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 14, marginBottom: 2 }}>{title}</h1>
          <div style={{ fontSize: 12, color: '#475569' }}>{location}</div>
          {subline && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{subline}</div>}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: '#334155' }}>
            {unit?.bedrooms != null && <span><strong>{unit.bedrooms}</strong> Bed</span>}
            {unit?.bathrooms != null && <span><strong>{unit.bathrooms}</strong> Bath</span>}
            {area != null && <span><strong>{area}</strong> m²</span>}
            {unit?.kind && <span>{unit.kind.replace(/_/g, ' ')}</span>}
          </div>
        </div>

        {/* Acquisition options */}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#1e293b', marginBottom: 10 }}>ACQUISITION OPTIONS</div>
        <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
          {options.map((o, i) => (
            <div key={i} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#1e293b', color: '#fff', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Option {String.fromCharCode(65 + i)}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{o.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{money(o.total, o.currency)}</div>
              </div>
              <div style={{ padding: '12px 14px' }}>
                {o.idealFor && <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>{o.idealFor}</div>}
                {/* Payment plan */}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 6, letterSpacing: 0.5 }}>PAYMENT PLAN</div>
                <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#334155', lineHeight: 1.7 }}>
                  <li>Sales agreement on signing</li>
                  <li><strong>Down payment:</strong> {money(o.down, o.currency)} ({o.downPct}%)</li>
                  <li><strong>Installments:</strong> {money(o.installmentsTotal, o.currency)} (~{money(o.monthly, o.currency)}/mo over {o.months} months, interest-free)</li>
                  <li>Full ownership transfer on completion</li>
                </ol>
              </div>
            </div>
          ))}
        </div>

        {/* Investment highlights */}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: '#1e293b', marginBottom: 10 }}>WHY INVEST</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {highlights.map((h, i) => (
            <div key={i} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{h.title}</div>
              {h.value && <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>{h.value}</div>}
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>{h.desc}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, fontSize: 10, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
          <span>PropGroup — Lebanon Real Estate · Invest Smart</span>
          <span>Indicative figures. Not a contractual offer.</span>
        </div>
      </div>
    </>
  )
}
