'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, Check } from 'lucide-react'
import { normalizeFileUrl, normalizeApiUrl } from '@/lib/utils/api-url'
import type { Listing } from '@/types'

const MOHAFAZAT_LABELS: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}
const AMENITY_LABELS: Array<[string, string]> = [
  ['hasGenerator', 'Backup generator'], ['hasElevator', 'Elevator'], ['hasPool', 'Pool'],
  ['hasGym', 'Gym'], ['hasConcierge', 'Concierge'], ['hasSecurity', '24/7 security'],
  ['hasGarden', 'Garden'], ['hasRooftop', 'Rooftop'], ['hasSolarPower', 'Solar power'],
]

// Brand palette (print-friendly)
const INK = '#1e293b'      // slate-800
const INK_SOFT = '#475569' // slate-600
const MUTED = '#64748b'    // slate-500
const LINE = '#e2e8f0'     // slate-200

function money(amount: number, currency = 'USD'): string {
  if (currency === 'LBP') return `LBP ${Math.round(amount).toLocaleString()}`
  return `$${Math.round(amount).toLocaleString()}`
}

interface OptionPlan {
  name: string; total: number; currency: string
  down: number; downPct: number; months: number; installmentsTotal: number; monthly: number
  idealFor?: string | null
}

export function ProposalExport({ listing }: { listing: Listing }) {
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)
  const [mounted, setMounted] = useState(false)
  // Use the brand logo configured in admin settings (falls back to /logo.png).
  const [logoUrl, setLogoUrl] = useState('/logo.png')
  useEffect(() => {
    setMounted(true)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    fetch(`${apiUrl}/api/content/media/branding.logoUrl`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const u = j?.data?.url || j?.url; if (u) setLogoUrl(normalizeFileUrl(u)) })
      .catch(() => {})
  }, [])

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

  const overview = listing.description ?? b?.description ?? b?.shortDescription ?? null
  // Up to 5 property photos (not all — a property may have many).
  const photoUrls = ((b?.images?.length ? b.images : unit?.images ?? []) as string[]).slice(0, 5).map((u) => normalizeFileUrl(u))
  const amenities = b ? AMENITY_LABELS.filter(([k]) => (b as unknown as Record<string, unknown>)[k]).map(([, label]) => label) : []
  const highlights = (b?.highlightedFeatures ?? []).filter(Boolean)
  const plans = b?.paymentPlans ?? []

  const inv = building?.investmentData ?? null
  const downPct = inv?.downPaymentPercentage ?? 40

  const rawOptions = unit?.options && unit.options.length > 0 ? unit.options : null
  const optionSource = (rawOptions ?? [{ name: 'Purchase' }]) as unknown as Record<string, unknown>[]
  const options: OptionPlan[] = optionSource.map((o) => {
    const ppsm = typeof o.pricePerSqm === 'number' ? o.pricePerSqm : null
    const total = ppsm != null && area ? ppsm * area : typeof o.askingPrice === 'number' ? o.askingPrice : listing.price
    const currency = (o.currency as string) || (o.askingCurrency as string) || listing.currency || 'USD'
    const down = typeof o.initialPayment === 'number' ? o.initialPayment : Math.round((total * downPct) / 100)
    const plan = (o.paymentPlanDetails ?? {}) as Record<string, unknown>
    const months = typeof plan.months === 'number' ? plan.months : (inv?.installmentYears ? inv.installmentYears * 12 : 30)
    const installmentsTotal = Math.max(total - down, 0)
    const monthly = typeof plan.monthly === 'number' ? plan.monthly : (months > 0 ? installmentsTotal / months : 0)
    return {
      name: (o.name as string) || 'Purchase', total, currency,
      down, downPct: total > 0 ? Math.round((down / total) * 100) : downPct,
      months, installmentsTotal, monthly, idealFor: (o.description as string) ?? null,
    }
  })

  const invCards = [
    { title: 'Capital Appreciation', value: inv?.capitalGrowth != null ? `${inv.capitalGrowth}%` : inv?.annualAppreciation != null ? `${inv.annualAppreciation}%/yr` : null, desc: inv?.capitalGrowth != null ? 'Projected appreciation' : 'Strong growth potential in a prime location' },
    { title: 'Rental Yield', value: inv?.rentalYield != null ? `${inv.rentalYield}%` : null, desc: inv?.rentalYield != null ? 'Expected gross yield' : 'Premium positioning, strong rental demand' },
    { title: 'Return on Investment', value: inv?.expectedROI != null ? `${inv.expectedROI}%` : null, desc: inv?.expectedROI != null ? 'Projected ROI' : 'Attractive price & high liquidity' },
    { title: 'Strategic Exit', value: null, desc: 'Flexible resale or long-term rental income' },
  ]
  const hasInvMetrics = invCards.some((c) => c.value)

  async function exportPdf() {
    setExporting(true)
    document.documentElement.classList.add('pg-exporting')
    await new Promise((r) => setTimeout(r, 300)) // let images decode
    const cleanup = () => {
      document.documentElement.classList.remove('pg-exporting')
      setExporting(false); setDone(true); setTimeout(() => setDone(false), 2500)
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    setTimeout(() => { if (document.documentElement.classList.contains('pg-exporting')) cleanup() }, 1500)
  }

  const H2 = (t: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: INK, margin: '0 0 8px', textTransform: 'uppercase' }}>{t}</div>
  )
  const noBreak: React.CSSProperties = { breakInside: 'avoid', pageBreakInside: 'avoid' }

  const sheet = (
    <div id="pg-proposal-portal">
      <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: INK, fontSize: 12, lineHeight: 1.5 }}>
        {/* Header */}
        <div style={{ borderBottom: `3px solid ${INK}`, paddingBottom: 12, marginBottom: 16, ...noBreak }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="PropGroup" style={{ height: 50, maxWidth: 180, objectFit: 'contain' }} />
            <div style={{ textAlign: 'right', fontSize: 11, color: MUTED }}>
              <div style={{ letterSpacing: 2, fontWeight: 700, color: INK }}>INVESTMENT PROPOSAL</div>
              <div>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: '12px 0 2px' }}>{title}</h1>
          <div style={{ fontSize: 12, color: INK_SOFT }}>{location}</div>
          {subline && <div style={{ fontSize: 10.5, color: MUTED, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{subline}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, fontSize: 11, color: '#334155' }}>
            {unit?.bedrooms != null && <span><strong>{unit.bedrooms}</strong> Bed</span>}
            {unit?.bathrooms != null && <span><strong>{unit.bathrooms}</strong> Bath</span>}
            {area != null && <span><strong>{area}</strong> m²</span>}
            {unit?.kind && <span style={{ textTransform: 'capitalize' }}>{unit.kind.replace(/_/g, ' ').toLowerCase()}</span>}
            {b?.builtYear != null && <span>Built <strong>{b.builtYear}</strong></span>}
            {b?.totalFloors != null && <span><strong>{b.totalFloors}</strong> floors</span>}
            {b?.parkingSpaces != null && b.parkingSpaces > 0 && <span><strong>{b.parkingSpaces}</strong> parking</span>}
          </div>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: INK }}>
            {money(listing.price, listing.currency)}
            {listing.intent === 'FOR_RENT' && listing.rentPeriod ? <span style={{ fontSize: 12, fontWeight: 500, color: MUTED }}> /{listing.rentPeriod.toLowerCase()}</span> : null}
            {listing.negotiable ? <span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}> · negotiable</span> : null}
          </div>
        </div>

        {/* Photos (up to 5) */}
        {photoUrls.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, ...noBreak }}>
            {photoUrls.length === 1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrls[0]} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, border: `1px solid ${LINE}` }} />
            ) : (
              photoUrls.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" style={{ flex: 1, height: 96, objectFit: 'cover', borderRadius: 8, border: `1px solid ${LINE}`, minWidth: 0 }} />
              ))
            )}
          </div>
        )}

        {/* Overview */}
        {overview && (
          <div style={{ marginBottom: 16, ...noBreak }}>
            {H2('Overview')}
            <div style={{ fontSize: 11.5, color: INK_SOFT, lineHeight: 1.6 }}>{overview.slice(0, 700)}</div>
          </div>
        )}

        {/* Acquisition options — only when the unit has real finish options
            (e.g. White Frame / Turnkey). A synthesized single "Purchase" option
            is not shown; the price is in the header and terms in Payment plans. */}
        {rawOptions && rawOptions.length > 0 && (
          <div style={noBreak}>
            {H2('Acquisition options')}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {options.map((o, i) => (
                <div key={i} style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 10, overflow: 'hidden', ...noBreak }}>
                  <div style={{ background: INK, color: '#fff', padding: '10px 13px' }}>
                    <div style={{ fontSize: 10, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>Option {String.fromCharCode(65 + i)}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{o.name}</div>
                    <div style={{ fontSize: 19, fontWeight: 800, marginTop: 3 }}>{money(o.total, o.currency)}</div>
                  </div>
                  <div style={{ padding: '11px 13px' }}>
                    {o.idealFor && <div style={{ fontSize: 10.5, color: INK_SOFT, marginBottom: plans.length === 0 ? 9 : 0 }}>{o.idealFor}</div>}
                    {/* Show a derived plan only if no explicit payment plans are defined */}
                    {plans.length === 0 && (
                      <>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: INK, marginBottom: 5, letterSpacing: 0.5 }}>PAYMENT PLAN</div>
                        <ol style={{ margin: 0, paddingLeft: 15, fontSize: 10.5, color: '#334155', lineHeight: 1.7 }}>
                          <li>Sales agreement on signing</li>
                          <li><strong>Down payment:</strong> {money(o.down, o.currency)} ({o.downPct}%)</li>
                          <li><strong>Installments:</strong> {money(o.installmentsTotal, o.currency)} (~{money(o.monthly, o.currency)}/mo over {o.months} months, interest-free)</li>
                          <li>Full ownership transfer on completion</li>
                        </ol>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment plans (admin-defined) */}
        {plans.length > 0 && (
          <div style={{ marginBottom: 16, ...noBreak }}>
            {H2('Payment plans')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {plans.map((p, i) => {
                let line = ''
                if (p.kind === 'INSTALLMENTS') {
                  const total = listing.price
                  const down = p.downPaymentPct != null ? Math.round((total * p.downPaymentPct) / 100) : null
                  const monthly = down != null && p.months ? Math.round((total - down) / p.months) : null
                  line = [
                    p.downPaymentPct != null ? `${p.downPaymentPct}% down (${money(down ?? 0, listing.currency)})` : null,
                    monthly && p.months ? `~${money(monthly, listing.currency)}/mo over ${p.months} months` : p.months ? `over ${p.months} months` : null,
                  ].filter(Boolean).join(' · ')
                } else if (p.kind === 'CASH') {
                  line = p.description || 'Full payment'
                } else {
                  line = p.description || ''
                }
                return (
                  <div key={i} style={{ flex: '1 1 45%', minWidth: 0, border: `1px solid ${LINE}`, borderRadius: 8, padding: '9px 12px' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{p.name}</div>
                    {line && <div style={{ fontSize: 10.5, color: INK_SOFT, marginTop: 2 }}>{line}</div>}
                    {p.kind === 'INSTALLMENTS' && p.description && <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{p.description}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Features + amenities */}
        {(highlights.length > 0 || amenities.length > 0) && (
          <div style={{ marginBottom: 16, ...noBreak }}>
            {H2('Features & amenities')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[...highlights, ...amenities].map((x, i) => (
                <span key={i} style={{ fontSize: 10.5, color: '#334155', background: '#f1f5f9', border: `1px solid ${LINE}`, borderRadius: 6, padding: '3px 9px' }}>{x}</span>
              ))}
            </div>
          </div>
        )}

        {/* Why invest */}
        {hasInvMetrics && (
          <div style={{ marginBottom: 16, ...noBreak }}>
            {H2('Why invest')}
            <div style={{ display: 'flex', gap: 10 }}>
              {invCards.map((h, i) => (
                <div key={i} style={{ flex: 1, border: `1px solid ${LINE}`, borderRadius: 10, padding: '11px 13px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: INK, marginBottom: 3 }}>{h.title}</div>
                  {h.value && <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>{h.value}</div>}
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 2, lineHeight: 1.5 }}>{h.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 10, fontSize: 9.5, color: '#94a3b8', display: 'flex', justifyContent: 'space-between', ...noBreak }}>
          <span>PropGroup — Lebanon Real Estate · Invest Smart</span>
          <span>Indicative figures. Not a contractual offer.</span>
        </div>
      </div>
    </div>
  )

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

      {/* Print isolation: the proposal is portalled to <body> as a direct child.
          On screen it's hidden; when printing we hide every OTHER body child
          with display:none (so they take no space → no blank pages) and show
          only the proposal. */}
      <style dangerouslySetInnerHTML={{ __html: `
        #pg-proposal-portal { display: none; }
        @media print {
          html.pg-exporting body > *:not(#pg-proposal-portal) { display: none !important; }
          html.pg-exporting #pg-proposal-portal { display: block !important; }
          html.pg-exporting, html.pg-exporting body { background: #fff !important; }
          @page { size: A4; margin: 12mm; }
        }
      ` }} />

      {mounted && createPortal(sheet, document.body)}
    </>
  )
}
