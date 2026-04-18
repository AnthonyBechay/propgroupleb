'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Bed, Bath, Maximize, ChevronDown, ChevronUp,
  FileText, Download, CreditCard, Calculator,
  GitCompare, Check, X, Image as ImageIcon,
  FileDown, MapPin, TrendingUp, Gem, Zap, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useComparator } from '@/contexts/ComparatorContext'
import type { Unit, UnitOption, PropertyDocument, PaymentPlanDetails, ComparatorItem } from '@/lib/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  propertyId: string
  propertyTitle: string
  propertySlug: string
  propertyCountry: string
  propertyCity?: string | null
  propertyStatus: string
  propertyType: string
  units: Unit[]
  documents: PropertyDocument[]
  currency: string
  rentalYield?: number | null
  capitalGrowth?: number | null
  /** callback to update the gallery images shown in the parent */
  onUnitImagesChange?: (images: string[]) => void
}

const AVAILABILITY_STYLE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  RESERVED: 'bg-amber-100 text-amber-700',
  SOLD: 'bg-red-100 text-red-700',
  OFF_MARKET: 'bg-gray-100 text-gray-600',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  BROCHURE: 'Brochure',
  CONTRACT: 'Contract',
  LEGAL_DOCUMENT: 'Legal Document',
  CERTIFICATE: 'Certificate',
  OTHER: 'Document',
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Payment plan helpers ──────────────────────────────────────────────────────

function calcMonthlyPayment(totalPrice: number, ppd: PaymentPlanDetails | null | undefined): number | null {
  if (!ppd?.installmentMonths || !ppd.milestones) return null
  const installmentMilestone = ppd.milestones.find(m => m.type === 'installment')
  const installmentPct = installmentMilestone?.percentage ?? (100 - (ppd.milestones.find(m => m.type === 'upfront')?.percentage ?? 0))
  return (totalPrice * installmentPct / 100) / ppd.installmentMonths
}

// ── ROI mini-calculator (inline, option-aware) ─────────────────────────────

function OptionRoiPanel({
  totalPrice,
  currency,
  initialPayment,
  paymentPlanDetails,
  rentalYield,
}: {
  totalPrice: number
  currency: string
  initialPayment?: number | null
  paymentPlanDetails?: PaymentPlanDetails | null
  rentalYield?: number | null
}) {
  const [open, setOpen] = useState(false)

  const estimatedMonthlyRent = rentalYield ? (totalPrice * rentalYield / 100) / 12 : totalPrice * 0.005
  const monthly = calcMonthlyPayment(totalPrice, paymentPlanDetails)
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)

  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Calculator className="w-3.5 h-3.5" />
          ROI & Payment Breakdown
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 bg-slate-50 border-t border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-3">
            <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
              <p className="text-xs text-slate-500 mb-0.5">Total Price</p>
              <p className="font-bold text-[#1B3A5C] text-sm">{fmt(totalPrice)}</p>
            </div>
            {initialPayment != null && initialPayment > 0 && (
              <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Initial Payment</p>
                <p className="font-bold text-[#D97706] text-sm">{fmt(initialPayment)}</p>
              </div>
            )}
            {monthly != null && (
              <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Monthly</p>
                <p className="font-bold text-emerald-600 text-sm">{fmt(monthly)}</p>
              </div>
            )}
            {rentalYield != null && rentalYield > 0 && (
              <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Est. Monthly Rent</p>
                <p className="font-bold text-slate-700 text-sm">{fmt(estimatedMonthlyRent)}</p>
              </div>
            )}
            {rentalYield != null && rentalYield > 0 && (
              <div className="bg-white rounded-lg p-2.5 border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-0.5">Rental Yield</p>
                <p className="font-bold text-emerald-600 text-sm">{rentalYield.toFixed(1)}%</p>
              </div>
            )}
          </div>

          {/* Payment plan milestones */}
          {paymentPlanDetails?.milestones && paymentPlanDetails.milestones.length > 0 && (
            <div>
              {paymentPlanDetails.summary && (
                <p className="text-xs text-slate-600 mb-2 font-medium">{paymentPlanDetails.summary}</p>
              )}
              <div className="flex rounded-full overflow-hidden h-1.5 mb-2">
                {paymentPlanDetails.milestones.map((m, i) => {
                  const colors = ['bg-[#1B3A5C]', 'bg-[#D97706]', 'bg-emerald-500', 'bg-amber-400', 'bg-slate-400']
                  return (
                    <div key={i} className={colors[i % colors.length]} style={{ width: `${m.percentage}%` }} title={`${m.label}: ${m.percentage}%`} />
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {paymentPlanDetails.milestones.map((m, i) => (
                  <div key={i} className="bg-white rounded px-2 py-1 border border-slate-100 flex justify-between items-center">
                    <span className="text-xs text-slate-500">{m.label}</span>
                    <span className="text-xs font-semibold text-[#1B3A5C]">{m.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Unit Investment Proposal PDF ───────────────────────────────────────────────

interface UnitSheetProps {
  propertyTitle: string
  propertyCountry: string
  propertyCity?: string | null
  propertyStatus: string
  unit: Unit
  currency: string
  rentalYield?: number | null
  capitalGrowth?: number | null
  logoUrl?: string
  onClose: () => void
}

/**
 * Parse a free-form description into bullet points.
 * Splits on newlines or commas (whichever produces more lines).
 */
function parseBullets(desc?: string | null): string[] {
  if (!desc) return []
  const byLine = desc.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (byLine.length >= 2) return byLine
  const byComma = desc.split(/[,;•·]/).map(s => s.trim()).filter(Boolean)
  return byComma.length >= 2 ? byComma : byLine
}

function UnitSheetPrint({
  propertyTitle, propertyCountry, propertyCity, propertyStatus,
  unit, currency, rentalYield, capitalGrowth, logoUrl, onClose,
}: UnitSheetProps) {
  const [mounted, setMounted] = useState(false)
  const hasPrinted = useRef(false)

  // Portal to document.body to avoid React-tree nesting issues with @media print
  useEffect(() => { setMounted(true) }, [])

  // Trigger print after render
  useEffect(() => {
    if (!mounted || hasPrinted.current) return
    hasPrinted.current = true
    const t = setTimeout(() => {
      window.print()
      // Listen for print dialog close to auto-cleanup
      const cleanup = () => { onClose(); window.removeEventListener('focus', cleanup) }
      window.addEventListener('focus', cleanup, { once: true })
      // Fallback: close after 500ms regardless
      setTimeout(() => onClose(), 2000)
    }, 250)
    return () => clearTimeout(t)
  }, [mounted, onClose])

  if (!mounted || typeof window === 'undefined') return null

  const options = unit.options
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)

  // Option color scheme: first navy, second gold, then cycle
  const colorSchemes = [
    { header: '#1B3A5C', headerText: '#FFFFFF', priceText: '#FFFFFF', accent: '#1B3A5C' },
    { header: '#C49A2E', headerText: '#FFFFFF', priceText: '#FFFFFF', accent: '#C49A2E' },
    { header: '#475569', headerText: '#FFFFFF', priceText: '#FFFFFF', accent: '#475569' },
  ]

  // Subtitle line from unit (floor, unit number, notes)
  const subtitleParts: string[] = []
  if (unit.unitNumber) subtitleParts.push(unit.unitNumber)
  if (unit.floor != null) subtitleParts.push(`${unit.floor}${getFloorSuffix(unit.floor)} Floor`)
  if (unit.notes) subtitleParts.push(unit.notes)
  const subtitle = subtitleParts.join(' | ').toUpperCase()

  // Pillars from investment data (fallbacks if not set)
  const pillars = [
    {
      icon: 'CAPITAL APPRECIATION',
      text: capitalGrowth && capitalGrowth > 0
        ? `${capitalGrowth}% appreciation by project completion`
        : '15-20% appreciation by project completion',
    },
    {
      icon: 'HIGH RENTAL YIELD',
      text: rentalYield && rentalYield > 0
        ? `${rentalYield.toFixed(1)}% yield — premium location drives strong ADR`
        : 'Premium location drives strong ADR',
    },
    { icon: 'HIGH LIQUIDITY', text: 'Attractive price point & premium location' },
    { icon: 'STRATEGIC EXIT', text: 'Flexible resale or long-term rental income strategy' },
  ]

  const sheet = (
    <div className="propgroup-print-sheet" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'white',
      overflowY: 'auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1e293b',
    }}>
      {/* Close button (screen-only) */}
      <button
        onClick={onClose}
        className="print-close-btn"
        style={{
          position: 'fixed', top: '16px', right: '16px', zIndex: 10000,
          background: '#1B3A5C', color: 'white', border: 'none',
          width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div id="propgroup-sheet-content" style={{
        maxWidth: '794px', // A4 portrait at 96dpi
        margin: '0 auto',
        padding: '40px 48px',
        background: 'white',
        boxSizing: 'border-box',
      }}>

        {/* Cream header block */}
        <div style={{
          background: '#FDF8EF',
          padding: '32px 40px 28px',
          margin: '-40px -48px 32px',
          borderBottom: '3px solid #C49A2E',
          textAlign: 'center',
        }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" style={{
              height: '40px', objectFit: 'contain', marginBottom: '16px', display: 'block', margin: '0 auto 16px',
            }} />
          )}
          <div style={{
            fontSize: '11px', fontWeight: '600', letterSpacing: '0.2em',
            color: '#C49A2E', marginBottom: '10px',
          }}>
            INVESTMENT PROPOSAL
          </div>
          <h1 style={{
            fontSize: '26px', fontWeight: '900', color: '#1B3A5C',
            margin: '0 0 10px', letterSpacing: '0.02em', lineHeight: 1.2,
          }}>
            {propertyTitle.toUpperCase()}{unit.unitNumber ? ` – UNIT ${unit.unitNumber}` : ''}
          </h1>
          {subtitle && (
            <div style={{
              fontSize: '13px', fontWeight: '600', color: '#C49A2E',
              letterSpacing: '0.1em', marginBottom: '8px',
            }}>
              {subtitle}
            </div>
          )}
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {options.length >= 2 ? 'Acquisition Options — Investment Organigram' : 'Acquisition Details'}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
            {[propertyCity, propertyCountry].filter(Boolean).join(', ')} · {propertyStatus.replace(/_/g, ' ')}
          </div>
        </div>

        {/* Options columns — side by side */}
        {options.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: options.length === 1 ? '1fr' : options.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: '20px',
            marginBottom: '28px',
          }}>
            {options.map((opt, idx) => {
              const scheme = colorSchemes[idx % colorSchemes.length]
              const totalPrice = opt.pricePerSqm * unit.area
              const ppd = opt.paymentPlanDetails as PaymentPlanDetails | null
              const monthly = calcMonthlyPayment(totalPrice, ppd)
              const upfrontPct = ppd?.milestones?.find(m => m.type === 'upfront')?.percentage
                ?? ppd?.milestones?.[0]?.percentage
              const installmentPct = ppd?.milestones?.find(m => m.type === 'installment')?.percentage
                ?? (upfrontPct != null ? 100 - upfrontPct : undefined)
              const installmentTotal = installmentPct != null ? totalPrice * installmentPct / 100 : null
              const bullets = parseBullets(opt.description)
              const installmentMonths = ppd?.installmentMonths

              return (
                <div key={opt.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Option header card */}
                  <div style={{
                    background: scheme.header,
                    color: scheme.headerText,
                    padding: '18px 20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    marginBottom: '18px',
                  }}>
                    <div style={{
                      fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em',
                      opacity: 0.9, marginBottom: '6px',
                    }}>
                      OPTION {String.fromCharCode(65 + idx)}: {opt.name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '0.02em' }}>
                      TOTAL PRICE: {fmt(totalPrice)}
                    </div>
                  </div>

                  {/* Payment steps */}
                  <div style={{ marginBottom: '18px' }}>
                    {/* 1. AGREEMENT */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#1B3A5C', marginBottom: '2px' }}>
                        1. AGREEMENT
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>Execution of Sales Agreement</div>
                    </div>

                    {/* 2. DOWN PAYMENT */}
                    {(opt.initialPayment != null && opt.initialPayment > 0) || upfrontPct != null ? (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#1B3A5C', marginBottom: '2px' }}>
                          2. DOWN PAYMENT
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          {opt.initialPayment != null && opt.initialPayment > 0
                            ? fmt(opt.initialPayment)
                            : fmt(totalPrice * (upfrontPct! / 100))}
                          {upfrontPct != null && ` (${upfrontPct}%)`} Upon Signing
                        </div>
                      </div>
                    ) : null}

                    {/* 3. INSTALLMENT PLAN */}
                    {(installmentTotal || monthly || installmentMonths) && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#1B3A5C', marginBottom: '2px' }}>
                          3. INSTALLMENT PLAN
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.45 }}>
                          {installmentTotal && <>{fmt(installmentTotal)} Total</>}
                          {monthly && <> (~{fmt(monthly)} Monthly)</>}
                          {installmentMonths && <><br />{installmentMonths} Months Interest-Free</>}
                        </div>
                      </div>
                    )}

                    {/* 4. OWNERSHIP */}
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#1B3A5C', marginBottom: '2px' }}>
                        4. OWNERSHIP
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>
                        Full Ownership Transfer Upon Completion of Payment Plan
                      </div>
                    </div>
                  </div>

                  {/* Delivery includes */}
                  {bullets.length > 0 && (
                    <div style={{
                      border: `1.5px solid ${scheme.accent}`,
                      borderRadius: '8px',
                      padding: '14px 16px',
                      marginBottom: '14px',
                      background: idx === 0 ? '#F8FAFC' : '#FDFAF3',
                    }}>
                      <div style={{
                        fontSize: '11px', fontWeight: '800', color: '#1B3A5C',
                        letterSpacing: '0.1em', marginBottom: '8px',
                        borderBottom: '1px solid #e2e8f0', paddingBottom: '6px',
                      }}>
                        {opt.name.toUpperCase()} INCLUDES
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
                        {bullets.map((b, i) => (
                          <div key={i} style={{ marginBottom: '2px' }}>✓ {b}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ideal for (from notes or auto) */}
                  <div style={{
                    background: '#F1F5F9',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#475569',
                    fontStyle: 'italic',
                    lineHeight: 1.45,
                    marginTop: 'auto',
                  }}>
                    <strong style={{ color: '#1B3A5C', fontStyle: 'normal' }}>IDEAL FOR:</strong>{' '}
                    {idx === 0
                      ? 'Investors seeking customization, flexibility or lower entry cost.'
                      : 'Passive investors seeking immediate rental income with zero additional setup.'}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
            background: '#f8fafc',
            borderRadius: '8px',
            marginBottom: '28px',
          }}>
            No finish options configured for this unit.
          </div>
        )}

        {/* Bottom pillars band */}
        <div style={{
          background: '#1B3A5C',
          color: 'white',
          padding: '20px 24px',
          margin: '32px -48px -40px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '20px',
            maxWidth: '794px',
            margin: '0 auto',
          }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '10px', fontWeight: '800', color: '#C49A2E',
                  letterSpacing: '0.1em', marginBottom: '6px',
                }}>
                  {p.icon}
                </div>
                <div style={{ fontSize: '10px', color: 'white', lineHeight: 1.4 }}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )

  return (
    <>
      {/* Print CSS — visibility pattern with portal ensures sheet prints clean */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          .propgroup-print-sheet, .propgroup-print-sheet * { visibility: visible !important; }
          .propgroup-print-sheet { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; overflow: visible !important; inset: auto !important; }
          .print-close-btn { display: none !important; }
          @page { margin: 0; size: A4 portrait; }
        }
      `}</style>
      {createPortal(sheet, document.body)}
    </>
  )
}

function getFloorSuffix(n: number): string {
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return 'th'
  if (lastDigit === 1) return 'st'
  if (lastDigit === 2) return 'nd'
  if (lastDigit === 3) return 'rd'
  return 'th'
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PropertyUnitsSection({
  propertyId,
  propertyTitle,
  propertySlug,
  propertyCountry,
  propertyCity,
  propertyStatus,
  propertyType,
  units,
  documents,
  currency,
  rentalYield,
  capitalGrowth,
  onUnitImagesChange,
}: Props) {
  const { add, remove, has } = useComparator()

  // selectedOptionId per unit — tracks which option tab is active for each unit
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    units.forEach(u => { if (u.options[0]) init[u.id] = u.options[0].id })
    return init
  })

  // Which unit is expanded for image preview
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null)

  // Print state — when set, shows the UnitSheetPrint overlay for a full unit (all finish options)
  const [printUnit, setPrintUnit] = useState<Unit | null>(null)

  // Logo URL from branding settings
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { normalizeApiUrl } = await import('@/lib/utils/api-url')
        const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
        const res = await fetch(`${apiUrl}/api/content/media/branding.logoUrl`)
        if (res.ok) {
          const data = await res.json()
          setLogoUrl(data.data?.url || data.url || undefined)
        }
      } catch {}
    }
    fetchLogo()
  }, [])

  const selectOption = useCallback((unitId: string, optionId: string) => {
    setSelectedOptions(prev => ({ ...prev, [unitId]: optionId }))
  }, [])

  const toggleUnitExpanded = useCallback((unit: Unit) => {
    setExpandedUnit(prev => {
      const next = prev === unit.id ? null : unit.id
      if (onUnitImagesChange) {
        onUnitImagesChange(next && unit.images.length > 0 ? unit.images : [])
      }
      return next
    })
  }, [onUnitImagesChange])

  // Documents filtered for a given selection
  const getDocsFor = useCallback((unitId: string | null, optionId: string | null) => {
    return documents.filter(d => {
      if (optionId && d.unitOptionId === optionId) return true
      if (!d.unitOptionId && unitId && d.unitId === unitId) return true
      if (!d.unitOptionId && !d.unitId) return true // project-level
      return false
    })
  }, [documents])

  const projectDocs = documents.filter(d => !d.unitId && !d.unitOptionId)

  if (units.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Available Units</h2>
        <p className="text-sm text-slate-500">Unit details coming soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ─── Unit cards ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Available Units</h2>
          <span className="text-sm text-slate-500">{units.length} type{units.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {units.map(unit => {
            const selOptId = selectedOptions[unit.id]
            const selOpt = unit.options.find(o => o.id === selOptId) ?? unit.options[0]
            const totalPrice = selOpt ? selOpt.pricePerSqm * unit.area : 0
            const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: selOpt?.currency || currency, maximumFractionDigits: 0 }).format(v)
            const unitDocs = getDocsFor(unit.id, selOptId ?? null)
            const isExpanded = expandedUnit === unit.id
            const inComparator = selOpt ? has(unit.id, selOpt.id) : false

            return (
              <div key={unit.id} className={isExpanded ? 'bg-slate-50/50' : ''}>
                {/* ── Unit header ── */}
                <div
                  className={`px-5 py-4 cursor-pointer transition-colors ${
                    isExpanded
                      ? 'bg-[#1B3A5C] text-white'
                      : 'hover:bg-slate-50'
                  }`}
                  onClick={() => toggleUnitExpanded(unit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleUnitExpanded(unit)}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className={`font-bold text-base ${isExpanded ? 'text-white' : 'text-slate-900'}`}>
                        {unit.name}
                      </span>
                      {unit.unitNumber && (
                        <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                          isExpanded ? 'bg-[#C49A2E] text-white' : 'bg-[#E0EDF7] text-[#1B3A5C]'
                        }`}>
                          #{unit.unitNumber}
                        </span>
                      )}
                      {unit.propertyType && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isExpanded ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {unit.propertyType}
                        </span>
                      )}
                      <div className={`flex items-center gap-3 text-sm ${isExpanded ? 'text-white/85' : 'text-slate-600'}`}>
                        <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{unit.bedrooms}</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{unit.bathrooms}</span>
                        <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{unit.area} m²</span>
                        {unit.floor != null && <span className="hidden sm:inline">· Floor {unit.floor}</span>}
                      </div>
                      {unit.images.length > 0 && (
                        <span className={`text-xs flex items-center gap-1 ${isExpanded ? 'text-white/70' : 'text-slate-400'}`}>
                          <ImageIcon className="w-3 h-3" />{unit.images.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Starting-from price preview (collapsed only) */}
                      {!isExpanded && selOpt && (
                        <div className="hidden sm:flex flex-col items-end mr-2">
                          <span className="text-xs text-slate-400 leading-tight">From</span>
                          <span className="text-base font-bold text-[#1B3A5C] leading-tight">{fmt(totalPrice)}</span>
                        </div>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAILABILITY_STYLE[unit.availabilityStatus] || 'bg-gray-100 text-gray-600'}`}>
                        {unit.availabilityStatus.replace('_', ' ')}
                      </span>
                      {/* Export PDF — only when expanded and unit has options */}
                      {isExpanded && unit.options.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPrintUnit(unit) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C49A2E] hover:bg-[#B38824] text-white text-xs font-semibold transition-colors"
                          title="Export Investment Proposal PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Export PDF</span>
                        </button>
                      )}
                      {isExpanded
                        ? <ChevronUp className={`w-5 h-5 ${isExpanded ? 'text-white' : 'text-slate-400'}`} />
                        : <ChevronDown className="w-5 h-5 text-slate-400" />
                      }
                    </div>
                  </div>
                </div>

                {/* ── Expanded content ── */}
                {isExpanded && (
                  <div className="border-t-2 border-[#C49A2E]">
                    {/* Unit-specific images */}
                    {unit.images.length > 0 && (
                      <div className="px-5 py-4 bg-white border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                          <ImageIcon className="w-3.5 h-3.5" /> Unit Photos
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {unit.images.map((img, i) => (
                            <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                              <img
                                src={img}
                                alt={`${unit.name} photo ${i + 1}`}
                                className="h-24 w-36 object-cover rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Finish options */}
                    {unit.options.length > 0 && (
                      <div className="bg-white">
                        {/* Section header */}
                        <div className="px-5 pt-4 pb-2">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            Choose Finish Option
                          </p>
                        </div>

                        {/* Option tab picker — clearer pill buttons */}
                        <div className="flex items-center gap-2 px-5 pb-1 overflow-x-auto">
                          {unit.options.map(opt => {
                            const isSelected = selOptId === opt.id
                            return (
                              <button
                                key={opt.id}
                                onClick={() => selectOption(unit.id, opt.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border-2 ${
                                  isSelected
                                    ? 'bg-[#C49A2E] text-white border-[#C49A2E] shadow-sm'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#C49A2E] hover:text-[#C49A2E]'
                                }`}
                              >
                                {opt.name}
                              </button>
                            )
                          })}
                        </div>

                        {/* Selected option details */}
                        {selOpt && (
                          <div className="px-5 py-4 mx-5 mb-4 mt-3 bg-gradient-to-br from-[#FDF8EF] to-white rounded-lg border border-[#C49A2E]/30">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold uppercase tracking-wider text-[#C49A2E]">Selected</span>
                                  <span className="font-bold text-slate-900 text-base">{selOpt.name}</span>
                                </div>
                                {selOpt.description && (
                                  <p className="text-sm text-slate-600 mt-1">{selOpt.description}</p>
                                )}
                                <div className="text-xs text-slate-500 pt-1">
                                  {fmt(selOpt.pricePerSqm)}/m²
                                  {selOpt.initialPayment != null && selOpt.initialPayment > 0 && (
                                    <> · Initial: <span className="text-[#D97706] font-semibold">{fmt(selOpt.initialPayment)}</span></>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Total Price</div>
                                <div className="text-3xl font-black text-[#1B3A5C] leading-tight">{fmt(totalPrice)}</div>
                                <div className="text-xs text-slate-500">{unit.area} m² total</div>
                              </div>
                            </div>

                            {/* Add to Comparator */}
                            <div className="mt-4 pt-3 border-t border-[#C49A2E]/20 flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={inComparator ? 'outline' : 'default'}
                                onClick={() => {
                                  if (inComparator) {
                                    remove(unit.id, selOpt.id)
                                  } else {
                                    const item: ComparatorItem = {
                                      propertyId,
                                      propertyTitle,
                                      propertySlug,
                                      propertyCountry,
                                      propertyCity,
                                      propertyStatus,
                                      propertyType,
                                      unitId: unit.id,
                                      unitName: unit.name,
                                      bedrooms: unit.bedrooms,
                                      bathrooms: unit.bathrooms,
                                      area: unit.area,
                                      floor: unit.floor,
                                      optionId: selOpt.id,
                                      optionName: selOpt.name,
                                      totalPrice,
                                      pricePerSqm: selOpt.pricePerSqm,
                                      currency: selOpt.currency || currency,
                                      initialPayment: selOpt.initialPayment,
                                      paymentPlanDetails: selOpt.paymentPlanDetails,
                                    }
                                    add(item)
                                  }
                                }}
                                className={inComparator
                                  ? 'border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white h-8'
                                  : 'bg-[#1B3A5C] hover:bg-[#24507D] text-white h-8'}
                              >
                                {inComparator
                                  ? <><Check className="w-3.5 h-3.5 mr-1.5" />In Comparator</>
                                  : <><GitCompare className="w-3.5 h-3.5 mr-1.5" />Add to Compare</>
                                }
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ROI panel for selected option */}
                    {selOpt && totalPrice > 0 && (
                      <OptionRoiPanel
                        totalPrice={totalPrice}
                        currency={selOpt.currency || currency}
                        initialPayment={selOpt.initialPayment}
                        paymentPlanDetails={selOpt.paymentPlanDetails}
                        rentalYield={rentalYield}
                      />
                    )}

                    {/* Documents for selected option + unit + project */}
                    {unitDocs.length > 0 && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" /> Related Documents
                        </p>
                        <div className="space-y-1.5">
                          {unitDocs.map(doc => (
                            <a
                              key={doc.id}
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 hover:border-[#1B3A5C] hover:bg-slate-50 transition-all group text-sm"
                            >
                              <div className="w-7 h-7 rounded bg-[#E0EDF7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#1B3A5C] transition-colors">
                                <FileText className="w-3.5 h-3.5 text-[#1B3A5C] group-hover:text-white transition-colors" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-slate-900 truncate block">{doc.title}</span>
                                <span className="text-xs text-slate-400">
                                  {DOC_TYPE_LABELS[doc.type] || 'Document'}
                                  {doc.unitOptionId ? ` · ${selOpt?.name ?? 'Option'}` : doc.unitId ? ' · Unit' : ' · Project'}
                                  {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                                </span>
                              </div>
                              <Download className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#1B3A5C] flex-shrink-0 transition-colors" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Project-level documents (if any) ──────────── */}
      {projectDocs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#1B3A5C]" />
            Project Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {projectDocs.map(doc => (
              <a
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:border-[#1B3A5C] hover:bg-slate-50 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-[#E0EDF7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#1B3A5C] transition-colors">
                  <FileText className="w-4 h-4 text-[#1B3A5C] group-hover:text-white transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate text-sm">{doc.title}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span>{DOC_TYPE_LABELS[doc.type] || 'Document'}</span>
                    {doc.fileSize && <><span>·</span><span>{formatFileSize(doc.fileSize)}</span></>}
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-[#1B3A5C] flex-shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ─── Unit Investment Proposal PDF Overlay ────────── */}
      {printUnit && (
        <UnitSheetPrint
          propertyTitle={propertyTitle}
          propertyCountry={propertyCountry}
          propertyCity={propertyCity}
          propertyStatus={propertyStatus}
          unit={printUnit}
          currency={currency}
          rentalYield={rentalYield}
          capitalGrowth={capitalGrowth}
          logoUrl={logoUrl}
          onClose={() => setPrintUnit(null)}
        />
      )}
    </div>
  )
}
