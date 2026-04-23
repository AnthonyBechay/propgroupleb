'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Bed, Bath, Maximize, ChevronDown, ChevronUp,
  FileText, Download, CreditCard, Calculator,
  GitCompare, Check, X, Image as ImageIcon,
  FileDown, MapPin, TrendingUp, Gem, Zap, Target,
  Share2, Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useComparator } from '@/contexts/ComparatorContext'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import type { Unit, UnitOption, PropertyDocument, PaymentPlanDetails, ComparatorItem } from '@/lib/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Optional investor-facing metadata surfaced in the three PDF exports:
 * handover date (off-plan), Golden Visa eligibility (Georgia residency
 * program hook), and annual holding costs. These live on the
 * `PropertyInvestmentData` Prisma model and are already in the detail
 * include — we just thread them through to the PDF sheets.
 */
interface PdfInvestmentMeta {
  completionDate?: string | null
  handoverDate?: string | null
  expectedRentalStart?: string | null
  isGoldenVisaEligible?: boolean
  goldenVisaMinAmount?: number | null
  serviceFee?: number | null
  propertyTax?: number | null
}

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
  /** Project-level images (for per-option PDF export) */
  propertyImages?: string[]
  /** Project description (for per-option PDF export) */
  propertyDescription?: string | null
  /** Optional investor-facing metadata surfaced in PDFs */
  investmentMeta?: PdfInvestmentMeta | null
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
  if (!ppd) return null
  const months = ppd.installmentMonths ?? ppd.totalInstallments
  if (!months) return null
  // Use explicit installmentAmount if present
  if (ppd.installmentAmount && ppd.installmentAmount > 0) return ppd.installmentAmount
  if (!ppd.milestones || ppd.milestones.length === 0) return null
  // Prefer typed milestone, fall back to label-matched, fall back to label containing "install" or "monthly"
  const installMs = ppd.milestones.find(m => m.type === 'installment')
    ?? ppd.milestones.find(m => /install|monthly|month/i.test(m.label || ''))
  const upfrontMs = ppd.milestones.find(m => m.type === 'upfront')
    ?? ppd.milestones.find(m => /down|booking|upfront|initial/i.test(m.label || ''))
  const installmentPct = installMs?.percentage
    ?? (upfrontMs ? 100 - (upfrontMs.percentage || 0) : null)
  if (installmentPct == null) return null
  return (totalPrice * installmentPct / 100) / months
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
  const estimatedMonthlyRent = rentalYield ? (totalPrice * rentalYield / 100) / 12 : totalPrice * 0.005
  const monthly = calcMonthlyPayment(totalPrice, paymentPlanDetails)
  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)

  return (
    <div className="px-5 py-4 space-y-3 bg-slate-50">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
  )
}

// ── Print CSS (shared by both PDF variants) ────────────────────────────────────

// Print CSS. Goals:
//  • On screen, the sheet is rendered off-screen (not as a dark overlay) so
//    the user only sees a small "Preparing PDF…" toast — no misleading flash.
//  • No chrome from the app (nav / modals / overlays) leaks onto the printed page.
//  • No blank trailing page — root cause is browsers flushing margins / tiny
//    overflow after the last element. We neutralise last-child margins and
//    clip the sheet to a strict single-page max-height for "single-page"
//    variants. Multi-page variants opt out via .propgroup-print-multipage.
//  • Single-page max-height uses 297mm − 24mm (≈12mm per margin incl. a safety
//    buffer) so Safari, which is more conservative around rounding, doesn't
//    spill onto a second blank page the way it did with 297−20.
const PRINT_CSS = `
  /* Screen: render the sheet off-screen, not as a visible overlay. */
  .propgroup-print-sheet {
    position: fixed !important;
    left: -100vw !important;
    top: 0 !important;
    width: 794px !important;
    visibility: hidden !important;
    pointer-events: none !important;
    background: white !important;
    z-index: -1 !important;
  }

  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    @page { size: A4 portrait; margin: 12mm; }

    html, body {
      margin: 0 !important; padding: 0 !important;
      background: white !important; height: auto !important; overflow: visible !important;
    }
    body > *:not(.propgroup-print-sheet) { display: none !important; }
    .print-preparing-toast { display: none !important; }

    .propgroup-print-sheet {
      position: static !important;
      left: auto !important;
      top: auto !important;
      inset: auto !important;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      background: white !important;
      padding: 0 !important;
      display: block !important;
      visibility: visible !important;
      pointer-events: auto !important;
      z-index: auto !important;
    }
    .propgroup-print-content {
      max-width: none !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    /* Single-page variant — clip to a hair under one A4 page so any stray
       overflow (trailing margin, rounding pixel) cannot force a blank page 2.
       12mm + 12mm page margins = 24mm non-content; subtract a further 1mm
       safety buffer for Safari. */
    .propgroup-print-content:not(.propgroup-print-multipage) {
      max-height: calc(297mm - 25mm) !important;
      overflow: hidden !important;
    }
    .propgroup-print-content > *:last-child {
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .print-section { break-inside: avoid; page-break-inside: avoid; }
    .propgroup-print-multipage .print-section { break-inside: avoid-page; page-break-inside: avoid; }
    .print-close-btn { display: none !important; }
    .print-page-break { page-break-after: always; break-after: page; }
  }
`

// ── Preparing toast + investor insights row ──────────────────────────────────

/**
 * Screen-only toast shown while the print dialog is being opened. Replaces
 * the prior full-screen dark backdrop, which looked like a misleading popup.
 */
function PrintPreparingToast({ onClose }: { onClose: () => void }) {
  return (
    <div className="print-preparing-toast" style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: '12px',
        padding: '18px 22px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', gap: '14px', maxWidth: '360px',
      }}>
        <div style={{
          width: '28px', height: '28px', flexShrink: 0,
          border: '3px solid #E2E8F0', borderTopColor: '#1B3A5C',
          borderRadius: '50%', animation: 'pg-print-spin 0.9s linear infinite',
        }} />
        <style>{`@keyframes pg-print-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1B3A5C' }}>
            Preparing PDF…
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Your print dialog will open shortly
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Cancel"
          style={{
            background: '#F1F5F9', border: 'none', padding: '6px',
            borderRadius: '6px', cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Compact investor-insights row. Sits beneath the main KPI row to surface
 * the numbers an investor actually cares about: what goes in each month,
 * how long to break even, cumulative 5-year return, and price per m².
 */
interface ReportInsightsRowProps {
  fmt: (v: number) => string
  basePrice: number
  pricePerSqm?: number | null
  rentalYield?: number | null
  capitalGrowth?: number | null
}

function ReportInsightsRow({ fmt, basePrice, pricePerSqm, rentalYield, capitalGrowth }: ReportInsightsRowProps) {
  const monthlyRent = rentalYield && rentalYield > 0 && basePrice > 0
    ? (basePrice * rentalYield / 100) / 12
    : null
  const payback = rentalYield && rentalYield > 0 ? 100 / rentalYield : null
  const fiveYrReturn = (rentalYield ?? 0) > 0 || (capitalGrowth ?? 0) > 0
    ? (rentalYield ?? 0) * 5 + (capitalGrowth ?? 0)
    : null

  const cellStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#FDF8EF',
    border: '1px solid #EBD99A', borderRadius: '6px',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '8.5px', color: '#92691A', fontWeight: 700, letterSpacing: '0.1em',
  }
  const valueStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 900, color: '#1B3A5C', marginTop: '2px',
  }

  return (
    <div className="print-section" style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px',
    }}>
      <div style={cellStyle}>
        <div style={labelStyle}>EST. MONTHLY RENT</div>
        <div style={valueStyle}>{monthlyRent ? fmt(monthlyRent) : '—'}</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>PAYBACK</div>
        <div style={valueStyle}>{payback ? `~${payback.toFixed(1)} yrs` : '—'}</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>5-YR RETURN</div>
        <div style={valueStyle}>{fiveYrReturn ? `${fiveYrReturn.toFixed(0)}%` : '—'}</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>PRICE / M²</div>
        <div style={valueStyle}>{pricePerSqm ? fmt(pricePerSqm) : '—'}</div>
      </div>
    </div>
  )
}

// ── Unit Investment Proposal PDF ───────────────────────────────────────────────

interface UnitSheetProps {
  propertyTitle: string
  propertyCountry: string
  propertyCity?: string | null
  propertyStatus: string
  propertyType: string
  propertyImages: string[]
  investmentMeta?: PdfInvestmentMeta | null
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

/**
 * Truncate a string at a word boundary, preserving full grapheme clusters
 * (so emojis and combining characters aren't split mid-surrogate). Avoids
 * the classic ".slice(0, N)" artefact that produced cuts like "investmen 💰"
 * or half-emojis in PDF exports.
 */
function truncateAtWord(s: string, maxChars: number): string {
  const chars = Array.from(s.trim())
  if (chars.length <= maxChars) return s.trim()
  let cut = chars.slice(0, maxChars).join('')
  const lastSpace = cut.lastIndexOf(' ')
  // Only back up to whitespace if we don't lose too much content
  if (lastSpace > maxChars * 0.6) cut = cut.slice(0, lastSpace)
  // Strip trailing punctuation that looks odd before an ellipsis
  cut = cut.replace(/[\s,.;:·–—-]+$/, '')
  return cut + '…'
}

// ── Shared report header ──────────────────────────────────────────────────────
// Unified header used across all three PDF variants so the documents feel like
// a series. Variants differ only by the scope line (the gold caps subtitle).

interface ReportHeaderProps {
  logoUrl?: string
  propertyTitle: string
  scopeLine: string   // e.g. "PROJECT OVERVIEW" / "UNIT #501 – WHITE FRAME"
  locationLine: string  // e.g. "BATUMI, GEORGIA · UNDER CONSTRUCTION · APARTMENT"
  handoverLabel?: string | null   // e.g. "Handover Q3 2027"
  isGoldenVisa?: boolean
}

function ReportHeader({
  logoUrl, propertyTitle, scopeLine, locationLine, handoverLabel, isGoldenVisa,
}: ReportHeaderProps) {
  const hasPills = handoverLabel || isGoldenVisa
  return (
    <div className="print-section" style={{
      background: '#FDF8EF', padding: '24px 36px 18px',
      borderBottom: '3px solid #C49A2E', textAlign: 'center',
      boxSizing: 'border-box',
    }}>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo" style={{
          height: '32px', objectFit: 'contain', display: 'block', margin: '0 auto 8px',
        }} />
      )}
      <div style={{
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.25em',
        color: '#C49A2E', marginBottom: '6px',
      }}>
        INVESTMENT REPORT
      </div>
      <h1 style={{
        fontSize: '21px', fontWeight: 900, color: '#1B3A5C',
        margin: '0 0 4px', letterSpacing: '0.02em', lineHeight: 1.2,
      }}>
        {propertyTitle.toUpperCase()}
      </h1>
      {scopeLine && (
        <div style={{
          fontSize: '11px', fontWeight: 700, color: '#C49A2E',
          letterSpacing: '0.12em', marginBottom: '4px',
        }}>
          {scopeLine}
        </div>
      )}
      {locationLine && (
        <div style={{
          fontSize: '10px', color: '#64748b',
          letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>
          {locationLine}
        </div>
      )}
      {hasPills && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '6px',
          marginTop: '8px', flexWrap: 'wrap',
        }}>
          {handoverLabel && (
            <span style={{
              display: 'inline-block', padding: '3px 10px',
              fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em',
              color: '#1B3A5C', background: '#FFFFFF',
              border: '1px solid #C49A2E', borderRadius: '999px',
            }}>
              {handoverLabel}
            </span>
          )}
          {isGoldenVisa && (
            <span style={{
              display: 'inline-block', padding: '3px 10px',
              fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em',
              color: '#065F46', background: '#D1FAE5',
              border: '1px solid #10B981', borderRadius: '999px',
            }}>
              ✓ Golden Visa Eligible
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Compact legal/context footer shown at the bottom of each PDF. Gives the
 * document an official look and ticks the "figures are projections, not
 * guarantees" box that investor-facing material should always carry.
 */
function ReportFooter({ propertyTitle }: { propertyTitle: string }) {
  const generatedOn = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  return (
    <div className="print-section" style={{
      padding: '10px 24px', background: '#F8FAFC',
      borderTop: '1px solid #e2e8f0',
      fontSize: '8px', color: '#64748b', lineHeight: 1.5,
      display: 'flex', justifyContent: 'space-between', gap: '14px',
      flexWrap: 'wrap',
    }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        Figures (rental yield, capital growth, payback and multi-year returns)
        are projections based on current market assumptions, not guaranteed
        returns. Final terms are set at contract signing.
      </span>
      <span style={{ flexShrink: 0, fontWeight: 600, color: '#475569' }}>
        Generated {generatedOn} · {propertyTitle}
      </span>
    </div>
  )
}

/**
 * Build the small "Handover Q3 2027" / "Handover Jun 2027" / "Ready Now"
 * label shown as a pill in the header. Prefers handoverDate, falls back to
 * completionDate. Returns null if neither is set.
 */
function buildHandoverLabel(
  handoverDate?: string | null,
  completionDate?: string | null,
  propertyStatus?: string,
): string | null {
  const raw = handoverDate || completionDate
  if (!raw) {
    // For COMPLETED / READY properties show a positive "Ready Now" pill.
    if (propertyStatus && /COMPLETED|READY|MOVE_IN/i.test(propertyStatus)) {
      return 'Ready Now'
    }
    return null
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const year = d.getFullYear()
  // Use a quarter if the date lands in mid/end-of-quarter month for readability.
  const qMonth = d.getMonth()
  const quarter = Math.floor(qMonth / 3) + 1
  return `Handover Q${quarter} ${year} · ${month} ${year}`
}

// KPI row shared by all three PDFs so key commercials are always visible.
interface ReportKpiRowProps {
  fmt: (v: number) => string
  minPrice: number
  maxPrice: number
  unitsCount?: number | null
  rentalYield?: number | null
  capitalGrowth?: number | null
}

function ReportKpiRow({ fmt, minPrice, maxPrice, unitsCount, rentalYield, capitalGrowth }: ReportKpiRowProps) {
  const showUnitsCount = unitsCount != null
  return (
    <div className="print-section" style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px',
    }}>
      <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em' }}>FROM PRICE</div>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#1B3A5C', marginTop: '2px' }}>
          {minPrice ? fmt(minPrice) : '—'}
        </div>
        {minPrice !== maxPrice && maxPrice > 0 && (
          <div style={{ fontSize: '9px', color: '#94a3b8' }}>up to {fmt(maxPrice)}</div>
        )}
      </div>
      <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em' }}>
          {showUnitsCount ? 'UNITS' : 'FINISH'}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#1B3A5C', marginTop: '2px' }}>
          {showUnitsCount ? unitsCount : '—'}
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
          {showUnitsCount ? 'available types' : ''}
        </div>
      </div>
      <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em' }}>RENTAL YIELD</div>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
          {rentalYield ? `${rentalYield.toFixed(1)}%` : '—'}
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8' }}>gross p.a.</div>
      </div>
      <div style={{ padding: '10px 12px', background: '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em' }}>CAPITAL GROWTH</div>
        <div style={{ fontSize: '15px', fontWeight: 900, color: '#C49A2E', marginTop: '2px' }}>
          {capitalGrowth ? `${capitalGrowth}%` : '—'}
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8' }}>by completion</div>
      </div>
    </div>
  )
}

function formatLocationLine(city: string | null | undefined, country: string, status: string, propertyType?: string): string {
  const parts: string[] = []
  const place = [city, country].filter(Boolean).join(', ')
  if (place) parts.push(place)
  if (status) parts.push(status.replace(/_/g, ' '))
  if (propertyType) parts.push(propertyType.replace(/_/g, ' '))
  return parts.join(' · ')
}

function UnitSheetPrint({
  propertyTitle, propertyCountry, propertyCity, propertyStatus, propertyType,
  propertyImages, investmentMeta,
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

  // Unified scope line for the header: UNIT #X · Y BD/Z BA · A m² · Floor N
  const scopeParts: string[] = []
  const unitLabel = unit.unitNumber ? `UNIT #${unit.unitNumber}` : 'UNIT PROPOSAL'
  scopeParts.push(unitLabel)
  if (unit.bedrooms != null || unit.bathrooms != null) {
    scopeParts.push(`${unit.bedrooms ?? 0} BD / ${unit.bathrooms ?? 0} BA · ${unit.area} M²`)
  }
  if (unit.floor != null) scopeParts.push(`${unit.floor}${getFloorSuffix(unit.floor)} FLOOR`)
  const scopeLine = scopeParts.join(' · ')
  const locationLine = formatLocationLine(propertyCity, propertyCountry, propertyStatus, propertyType)

  // KPI row inputs: price range across options for this unit
  const unitPrices = options.map(o => o.pricePerSqm * unit.area).filter(n => n > 0)
  const unitMinPrice = unitPrices.length ? Math.min(...unitPrices) : 0
  const unitMaxPrice = unitPrices.length ? Math.max(...unitPrices) : 0

  const heroImages = propertyImages.slice(0, 3)
  const handoverLabel = buildHandoverLabel(
    investmentMeta?.handoverDate,
    investmentMeta?.completionDate,
    propertyStatus,
  )
  const isGoldenVisa = !!investmentMeta?.isGoldenVisaEligible

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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1e293b',
    }}>
      <div className="propgroup-print-content" style={{
        maxWidth: '794px',
        margin: '0 auto',
        background: 'white',
        boxSizing: 'border-box',
      }}>

        {/* Unified header */}
        <ReportHeader
          logoUrl={logoUrl}
          propertyTitle={propertyTitle}
          scopeLine={scopeLine}
          locationLine={locationLine}
          handoverLabel={handoverLabel}
          isGoldenVisa={isGoldenVisa}
        />

        <div style={{ padding: '16px 28px 0' }}>
          {/* Project hero images — compact (90px) so the single-page A4 layout
              fits header + KPI + insights + options grid + pillars cleanly. */}
          {heroImages.length > 0 && (
            <div className="print-section" style={{
              display: 'grid',
              gridTemplateColumns: heroImages.length === 1 ? '1fr' : heroImages.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: '6px', marginBottom: '12px',
            }}>
              {heroImages.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt="" style={{
                  width: '100%', height: '90px', objectFit: 'cover',
                  borderRadius: '6px', display: 'block',
                }} />
              ))}
            </div>
          )}

          {/* KPI row — asset fundamentals */}
          <ReportKpiRow
            fmt={fmt}
            minPrice={unitMinPrice}
            maxPrice={unitMaxPrice}
            unitsCount={options.length || null}
            rentalYield={rentalYield}
            capitalGrowth={capitalGrowth}
          />

          {/* Insights row — cash flow & return fundamentals */}
          <ReportInsightsRow
            fmt={fmt}
            basePrice={unitMinPrice}
            pricePerSqm={options.length ? Math.min(...options.map(o => o.pricePerSqm).filter(n => n > 0)) : null}
            rentalYield={rentalYield}
            capitalGrowth={capitalGrowth}
          />

          {/* Acquisition options header */}
          <div style={{
            fontSize: '10px', fontWeight: 800, color: '#1B3A5C',
            letterSpacing: '0.15em', marginBottom: '8px',
          }}>
            {options.length >= 2 ? 'ACQUISITION OPTIONS' : 'ACQUISITION DETAILS'}
          </div>
        </div>

        {/* Options grid */}
        <div style={{ padding: '0 28px 24px' }}>
          {options.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: options.length === 1 ? '1fr' : options.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: '16px',
            }}>
              {options.map((opt, idx) => {
                const scheme = colorSchemes[idx % colorSchemes.length]
                const totalPrice = opt.pricePerSqm * unit.area
                const ppd = opt.paymentPlanDetails as PaymentPlanDetails | null
                const monthly = calcMonthlyPayment(totalPrice, ppd)
                const bullets = parseBullets(opt.description)
                const installmentMonths = ppd?.installmentMonths ?? ppd?.totalInstallments
                const freqLabel = ppd?.installmentFrequency
                  ? ppd.installmentFrequency.charAt(0).toUpperCase() + ppd.installmentFrequency.slice(1).replace('-', ' ')
                  : null

                return (
                  <div key={opt.id} className="print-section" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Option header card */}
                    <div style={{
                      background: scheme.header, color: scheme.headerText,
                      padding: '14px 16px', borderRadius: '6px',
                      textAlign: 'center', marginBottom: '14px',
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', opacity: 0.9, marginBottom: '4px' }}>
                        OPTION {String.fromCharCode(65 + idx)}: {opt.name.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '0.02em' }}>
                        TOTAL: {fmt(totalPrice)}
                      </div>
                      <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '3px' }}>
                        {fmt(opt.pricePerSqm)}/m² · {unit.area} m²
                      </div>
                    </div>

                    {/* Initial payment (if present) */}
                    {opt.initialPayment != null && opt.initialPayment > 0 && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#1B3A5C', letterSpacing: '0.1em', marginBottom: '2px' }}>
                          INITIAL PAYMENT
                        </div>
                        <div style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>
                          {fmt(opt.initialPayment)} <span style={{ color: '#64748b', fontWeight: 500 }}>upon signing</span>
                        </div>
                      </div>
                    )}

                    {/* Payment plan — dynamic from milestones */}
                    {ppd?.milestones && ppd.milestones.length > 0 ? (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: '#1B3A5C', letterSpacing: '0.1em', marginBottom: '6px' }}>
                          PAYMENT PLAN
                        </div>
                        {ppd.summary && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic', marginBottom: '8px' }}>
                            {ppd.summary}
                          </div>
                        )}
                        {ppd.milestones.map((m, i) => {
                          const amount = totalPrice * (m.percentage || 0) / 100
                          return (
                            <div key={i} style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1B3A5C', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                <span>{i + 1}. {(m.label || 'Milestone').toUpperCase()}</span>
                                <span style={{ color: scheme.accent }}>{m.percentage}%</span>
                              </div>
                              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.4 }}>
                                {fmt(amount)}
                                {m.description && <> · {m.description}</>}
                                {m.dueDate && <> · {new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</>}
                              </div>
                            </div>
                          )
                        })}
                        {(installmentMonths || freqLabel || monthly) && (
                          <div style={{
                            marginTop: '6px', paddingTop: '6px',
                            borderTop: '1px dashed #cbd5e1',
                            fontSize: '10px', color: '#475569',
                          }}>
                            {installmentMonths && <>{installmentMonths} installments</>}
                            {freqLabel && <> · {freqLabel}</>}
                            {monthly && <> · ~{fmt(monthly)}/mo</>}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback when no milestones — show simple pricing */
                      <div style={{ marginBottom: '14px', fontSize: '10px', color: '#64748b' }}>
                        Full payment on booking
                      </div>
                    )}

                    {/* Includes */}
                    {bullets.length > 0 && (
                      <div style={{
                        border: `1.5px solid ${scheme.accent}`, borderRadius: '6px',
                        padding: '10px 12px', marginBottom: '10px',
                        background: idx === 0 ? '#F8FAFC' : '#FDFAF3',
                      }}>
                        <div style={{
                          fontSize: '10px', fontWeight: 800, color: '#1B3A5C',
                          letterSpacing: '0.1em', marginBottom: '6px',
                          borderBottom: '1px solid #e2e8f0', paddingBottom: '4px',
                        }}>
                          {opt.name.toUpperCase()} INCLUDES
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>
                          {bullets.map((b, i) => (
                            <div key={i} style={{ marginBottom: '2px' }}>✓ {b}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ideal for */}
                    <div style={{
                      background: '#F1F5F9', padding: '8px 12px', borderRadius: '5px',
                      fontSize: '10px', color: '#475569', fontStyle: 'italic',
                      lineHeight: 1.4, marginTop: 'auto',
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
              padding: '32px', textAlign: 'center', color: '#64748b',
              background: '#f8fafc', borderRadius: '6px',
            }}>
              No finish options configured for this unit.
            </div>
          )}
        </div>

        {/* Bottom pillars band — full width, no negative margins */}
        <div className="print-section" style={{
          background: '#1B3A5C', color: 'white',
          padding: '14px 24px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#C49A2E', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  {p.icon}
                </div>
                <div style={{ fontSize: '9px', color: 'white', lineHeight: 1.4 }}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ReportFooter propertyTitle={propertyTitle} />

      </div>
    </div>
  )

  return (
    <>
      <style>{PRINT_CSS}</style>
      {createPortal(
        <>
          <PrintPreparingToast onClose={onClose} />
          {sheet}
        </>,
        document.body,
      )}
    </>
  )
}

// ── Per-Option Investment Proposal PDF ─────────────────────────────────────────

interface OptionSheetProps {
  propertyTitle: string
  propertyCountry: string
  propertyCity?: string | null
  propertyStatus: string
  propertyType: string
  propertyImages: string[]
  propertyDescription?: string | null
  investmentMeta?: PdfInvestmentMeta | null
  unit: Unit
  option: UnitOption
  currency: string
  rentalYield?: number | null
  capitalGrowth?: number | null
  logoUrl?: string
  onClose: () => void
}

function OptionSheetPrint({
  propertyTitle, propertyCountry, propertyCity, propertyStatus, propertyType,
  propertyImages, propertyDescription, investmentMeta,
  unit, option, currency, rentalYield, capitalGrowth, logoUrl, onClose,
}: OptionSheetProps) {
  const [mounted, setMounted] = useState(false)
  const hasPrinted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || hasPrinted.current) return
    hasPrinted.current = true
    const t = setTimeout(() => {
      window.print()
      const cleanup = () => { onClose(); window.removeEventListener('focus', cleanup) }
      window.addEventListener('focus', cleanup, { once: true })
      setTimeout(() => onClose(), 2000)
    }, 300)
    return () => clearTimeout(t)
  }, [mounted, onClose])

  if (!mounted || typeof window === 'undefined') return null

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  const totalPrice = option.pricePerSqm * unit.area
  const ppd = option.paymentPlanDetails as PaymentPlanDetails | null
  const monthly = calcMonthlyPayment(totalPrice, ppd)
  const bullets = parseBullets(option.description)
  // Compact description so the whole proposal fits one A4 page even after the
  // KPI + insights rows, option hero card, and payment plan are stacked.
  const shortDesc = propertyDescription ? truncateAtWord(propertyDescription, 240) : null

  const heroImages = propertyImages.slice(0, 3)

  // Unified header lines
  const scopeLine = `${unit.unitNumber ? `UNIT #${unit.unitNumber}` : 'UNIT'} · ${option.name.toUpperCase()}`
  const locationLine = formatLocationLine(propertyCity, propertyCountry, propertyStatus, propertyType)
  const handoverLabel = buildHandoverLabel(
    investmentMeta?.handoverDate,
    investmentMeta?.completionDate,
    propertyStatus,
  )
  const isGoldenVisa = !!investmentMeta?.isGoldenVisaEligible

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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1e293b',
    }}>
      <div className="propgroup-print-content" style={{
        maxWidth: '794px', margin: '0 auto', background: 'white',
        boxSizing: 'border-box',
      }}>

        {/* Unified header */}
        <ReportHeader
          logoUrl={logoUrl}
          propertyTitle={propertyTitle}
          scopeLine={scopeLine}
          locationLine={locationLine}
          handoverLabel={handoverLabel}
          isGoldenVisa={isGoldenVisa}
        />

        <div style={{ padding: '18px 28px 0' }}>

          {/* KPI row — asset fundamentals */}
          <ReportKpiRow
            fmt={fmt}
            minPrice={totalPrice}
            maxPrice={totalPrice}
            unitsCount={null}
            rentalYield={rentalYield}
            capitalGrowth={capitalGrowth}
          />

          {/* Insights row — cash flow & return fundamentals */}
          <ReportInsightsRow
            fmt={fmt}
            basePrice={totalPrice}
            pricePerSqm={option.pricePerSqm}
            rentalYield={rentalYield}
            capitalGrowth={capitalGrowth}
          />

          {/* Project images — compacted to 90px so the proposal stays single-page. */}
          {heroImages.length > 0 && (
            <div className="print-section" style={{
              display: 'grid',
              gridTemplateColumns: heroImages.length === 1 ? '1fr' : heroImages.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: '6px', marginBottom: '12px',
            }}>
              {heroImages.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt="" style={{
                  width: '100%', height: '90px', objectFit: 'cover',
                  borderRadius: '6px', display: 'block',
                }} />
              ))}
            </div>
          )}

          {/* Unit-specific images — compacted row. */}
          {unit.images && unit.images.length > 0 && (
            <div className="print-section" style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '9px', fontWeight: 800, color: '#1B3A5C',
                letterSpacing: '0.15em', marginBottom: '4px',
              }}>
                UNIT PHOTOS {unit.unitNumber ? `· #${unit.unitNumber}` : ''}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: unit.images.length === 1
                  ? '1fr'
                  : unit.images.length === 2
                    ? '1fr 1fr'
                    : 'repeat(3, 1fr)',
                gap: '6px',
              }}>
                {unit.images.slice(0, 3).map((img, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={img} alt="" style={{
                    width: '100%', height: '68px', objectFit: 'cover',
                    borderRadius: '4px', display: 'block',
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Project description — short summary only. */}
          {shortDesc && (
            <div className="print-section" style={{
              fontSize: '10.5px', color: '#475569', lineHeight: 1.5,
              marginBottom: '12px', paddingBottom: '10px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <div style={{
                fontSize: '9px', fontWeight: 800, color: '#1B3A5C',
                letterSpacing: '0.15em', marginBottom: '4px',
              }}>
                ABOUT THE PROJECT
              </div>
              {shortDesc}
            </div>
          )}

          {/* Selected option — hero card */}
          <div className="print-section" style={{
            background: 'linear-gradient(135deg, #FDF8EF 0%, #FFFFFF 100%)',
            border: '2px solid #C49A2E', borderRadius: '10px',
            padding: '14px 18px', marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#C49A2E', letterSpacing: '0.15em', marginBottom: '2px' }}>
                  SELECTED FINISH OPTION
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#1B3A5C', lineHeight: 1.15 }}>
                  {option.name}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                  {unit.name}{unit.unitNumber ? ` · #${unit.unitNumber}` : ''} · {unit.bedrooms}bd / {unit.bathrooms}ba · {unit.area} m²{unit.floor != null ? ` · Floor ${unit.floor}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '8.5px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total Price</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#1B3A5C', lineHeight: 1 }}>{fmt(totalPrice)}</div>
                <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px' }}>{fmt(option.pricePerSqm)}/m²</div>
              </div>
            </div>

            {/* Includes bullets */}
            {bullets.length > 0 && (
              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5, paddingTop: '8px', borderTop: '1px solid #C49A2E44' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#1B3A5C', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  INCLUDES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: bullets.length > 4 ? '1fr 1fr' : '1fr', gap: '1px 16px' }}>
                  {bullets.map((b, i) => (
                    <div key={i}>✓ {b}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Payment plan */}
          {ppd?.milestones && ppd.milestones.length > 0 && (
            <div className="print-section" style={{
              border: '1px solid #e2e8f0', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '12px',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#1B3A5C', letterSpacing: '0.15em', marginBottom: '6px' }}>
                PAYMENT PLAN {ppd.summary && <span style={{ color: '#64748b', fontWeight: 500, letterSpacing: 0 }}>— {ppd.summary}</span>}
              </div>

              {/* Milestone bar */}
              <div style={{ display: 'flex', borderRadius: '999px', overflow: 'hidden', height: '5px', marginBottom: '8px', background: '#f1f5f9' }}>
                {ppd.milestones.map((m, i) => {
                  const colors = ['#1B3A5C', '#C49A2E', '#10b981', '#f59e0b', '#64748b']
                  return (
                    <div key={i} style={{ background: colors[i % colors.length], width: `${m.percentage}%` }} />
                  )
                })}
              </div>

              {/* Milestone rows */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {ppd.milestones.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '9.5px', padding: '3px 8px',
                    background: '#f8fafc', borderRadius: '4px',
                  }}>
                    <span style={{ color: '#475569' }}>{m.label}</span>
                    <span style={{ color: '#1B3A5C', fontWeight: 700 }}>
                      {m.percentage}% · {fmt(totalPrice * m.percentage / 100)}
                    </span>
                  </div>
                ))}
              </div>

              {monthly && (
                <div style={{
                  marginTop: '8px', padding: '6px 10px',
                  background: '#F1F5F9', borderRadius: '5px',
                  fontSize: '9.5px', color: '#475569', display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>Estimated monthly installment</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(monthly)}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Bottom pillars */}
        <div className="print-section" style={{
          background: '#1B3A5C', color: 'white', padding: '10px 24px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8.5px', fontWeight: 800, color: '#C49A2E', letterSpacing: '0.1em', marginBottom: '3px' }}>
                  {p.icon}
                </div>
                <div style={{ fontSize: '8.5px', color: 'white', lineHeight: 1.35 }}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ReportFooter propertyTitle={propertyTitle} />

      </div>
    </div>
  )

  return (
    <>
      <style>{PRINT_CSS}</style>
      {createPortal(
        <>
          <PrintPreparingToast onClose={onClose} />
          {sheet}
        </>,
        document.body,
      )}
    </>
  )
}

// ── Project-level Investment Proposal PDF ─────────────────────────────────────
// Lists all units at a glance with key commercials — suitable for sharing the
// whole project as one document. Multi-page by design.

interface ProjectSheetProps {
  propertyTitle: string
  propertyCountry: string
  propertyCity?: string | null
  propertyStatus: string
  propertyType: string
  propertyImages: string[]
  propertyDescription?: string | null
  units: Unit[]
  currency: string
  rentalYield?: number | null
  capitalGrowth?: number | null
  logoUrl?: string
  investmentMeta?: PdfInvestmentMeta | null
  onClose: () => void
}

function ProjectSheetPrint({
  propertyTitle, propertyCountry, propertyCity, propertyStatus, propertyType,
  propertyImages, propertyDescription,
  units, currency, rentalYield, capitalGrowth, logoUrl, investmentMeta, onClose,
}: ProjectSheetProps) {
  const [mounted, setMounted] = useState(false)
  const hasPrinted = useRef(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || hasPrinted.current) return
    hasPrinted.current = true
    const t = setTimeout(() => {
      window.print()
      const cleanup = () => { onClose(); window.removeEventListener('focus', cleanup) }
      window.addEventListener('focus', cleanup, { once: true })
      setTimeout(() => onClose(), 2500)
    }, 400)
    return () => clearTimeout(t)
  }, [mounted, onClose])

  if (!mounted || typeof window === 'undefined') return null

  const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)

  // Derive min/max price across the whole project
  const allPrices: number[] = []
  units.forEach(u => u.options.forEach(o => { if (u.area) allPrices.push(o.pricePerSqm * u.area) }))
  const minPrice = allPrices.length ? Math.min(...allPrices) : 0
  const maxPrice = allPrices.length ? Math.max(...allPrices) : 0

  const heroImages = propertyImages.slice(0, 3)
  const shortDesc = propertyDescription ? truncateAtWord(propertyDescription, 500) : null

  const locationLine = formatLocationLine(propertyCity, propertyCountry, propertyStatus, propertyType)

  const handoverLabel = buildHandoverLabel(
    investmentMeta?.handoverDate,
    investmentMeta?.completionDate,
    propertyStatus,
  )
  const isGoldenVisa = !!investmentMeta?.isGoldenVisaEligible

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
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1e293b',
    }}>
      <div className="propgroup-print-content propgroup-print-multipage" style={{
        maxWidth: '794px', margin: '0 auto', background: 'white',
        boxSizing: 'border-box',
      }}>

        {/* Unified header */}
        <ReportHeader
          logoUrl={logoUrl}
          propertyTitle={propertyTitle}
          scopeLine="PROJECT OVERVIEW"
          locationLine={locationLine}
          handoverLabel={handoverLabel}
          isGoldenVisa={isGoldenVisa}
        />

        <div style={{ padding: '20px 28px 24px' }}>

          {/* Hero strip */}
          {heroImages.length > 0 && (
            <div className="print-section" style={{
              display: 'grid',
              gridTemplateColumns: heroImages.length === 1 ? '1fr' : heroImages.length === 2 ? '1fr 1fr' : 'repeat(3, 1fr)',
              gap: '8px', marginBottom: '18px',
            }}>
              {heroImages.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={img} alt="" style={{
                  width: '100%', height: '140px', objectFit: 'cover',
                  borderRadius: '6px', display: 'block',
                }} />
              ))}
            </div>
          )}

          {/* KPI row */}
          <ReportKpiRow
            fmt={fmt}
            minPrice={minPrice}
            maxPrice={maxPrice}
            unitsCount={units.length}
            rentalYield={rentalYield}
            capitalGrowth={capitalGrowth}
          />

          {/* Insights row */}
          <ReportInsightsRow
            fmt={fmt}
            basePrice={minPrice}
            pricePerSqm={(() => {
              const ppsm = units.flatMap(u => u.options.map(o => o.pricePerSqm)).filter(n => n > 0)
              return ppsm.length ? Math.min(...ppsm) : null
            })()}
            rentalYield={rentalYield}
            capitalGrowth={capitalGrowth}
          />

          {/* Description */}
          {shortDesc && (
            <div className="print-section" style={{
              fontSize: '11px', color: '#475569', lineHeight: 1.55,
              marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1B3A5C', letterSpacing: '0.15em', marginBottom: '6px' }}>
                ABOUT THE PROJECT
              </div>
              {shortDesc}
            </div>
          )}

          {/* Units list */}
          <div style={{
            fontSize: '10px', fontWeight: 800, color: '#1B3A5C',
            letterSpacing: '0.15em', marginBottom: '10px',
          }}>
            AVAILABLE UNITS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {units.map(unit => {
              const prices = unit.options.map(o => o.pricePerSqm * unit.area).filter(n => n > 0)
              const uMin = prices.length ? Math.min(...prices) : 0
              const uMax = prices.length ? Math.max(...prices) : 0
              return (
                <div key={unit.id} className="print-section" style={{
                  border: '1px solid #e2e8f0', borderRadius: '8px',
                  padding: '12px 14px', background: '#FFFFFF',
                }}>
                  {/* Unit header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B3A5C' }}>{unit.name}</span>
                        {unit.unitNumber && (
                          <span style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, background: '#E0EDF7', color: '#1B3A5C', padding: '2px 6px', borderRadius: '3px' }}>
                            #{unit.unitNumber}
                          </span>
                        )}
                        <span style={{
                          fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          background: unit.availabilityStatus === 'AVAILABLE' ? '#D1FAE5' : unit.availabilityStatus === 'RESERVED' ? '#FEF3C7' : unit.availabilityStatus === 'SOLD' ? '#FEE2E2' : '#F1F5F9',
                          color: unit.availabilityStatus === 'AVAILABLE' ? '#047857' : unit.availabilityStatus === 'RESERVED' ? '#92400E' : unit.availabilityStatus === 'SOLD' ? '#991B1B' : '#475569',
                        }}>
                          {unit.availabilityStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {unit.bedrooms} bd · {unit.bathrooms} ba · {unit.area} m²
                        {unit.floor != null && <> · Floor {unit.floor}</>}
                        {unit.propertyType && <> · {unit.propertyType}</>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {uMin !== uMax ? 'From' : 'Price'}
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#1B3A5C' }}>
                        {uMin ? fmt(uMin) : '—'}
                      </div>
                      {uMin !== uMax && uMax > 0 && (
                        <div style={{ fontSize: '9px', color: '#94a3b8' }}>up to {fmt(uMax)}</div>
                      )}
                    </div>
                  </div>

                  {/* Options with payment plan — every available finish for
                      this unit shown with price + payment-plan milestones so
                      the PDF is a self-contained report. */}
                  {unit.options.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {unit.options.map(opt => {
                        const price = opt.pricePerSqm * unit.area
                        const ppd = opt.paymentPlanDetails as PaymentPlanDetails | null
                        const monthly = calcMonthlyPayment(price, ppd)
                        const installmentMonths = ppd?.installmentMonths ?? ppd?.totalInstallments
                        return (
                          <div key={opt.id} style={{
                            border: '1px solid #e2e8f0', borderRadius: '6px',
                            padding: '8px 10px', background: '#F8FAFC',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1B3A5C' }}>{opt.name}</span>
                                {opt.initialPayment != null && opt.initialPayment > 0 && (
                                  <span style={{ fontSize: '9px', color: '#D97706', fontWeight: 700 }}>
                                    Initial {fmt(opt.initialPayment)}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 900, color: '#C49A2E' }}>{fmt(price)}</span>
                            </div>

                            {/* Payment plan milestones */}
                            {ppd?.milestones && ppd.milestones.length > 0 && (
                              <div style={{ marginTop: '6px' }}>
                                {ppd.summary && (
                                  <div style={{ fontSize: '9px', color: '#64748b', fontStyle: 'italic', marginBottom: '4px' }}>
                                    {ppd.summary}
                                  </div>
                                )}
                                <div style={{ display: 'flex', borderRadius: '999px', overflow: 'hidden', height: '4px', marginBottom: '4px', background: '#e2e8f0' }}>
                                  {ppd.milestones.map((m, i) => {
                                    const colors = ['#1B3A5C', '#C49A2E', '#10b981', '#f59e0b', '#64748b']
                                    return <div key={i} style={{ background: colors[i % colors.length], width: `${m.percentage}%` }} />
                                  })}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
                                  {ppd.milestones.map((m, i) => (
                                    <div key={i} style={{
                                      fontSize: '9px', color: '#475569',
                                      display: 'flex', justifyContent: 'space-between', gap: '6px',
                                    }}>
                                      <span>{m.label}</span>
                                      <span style={{ color: '#1B3A5C', fontWeight: 700 }}>
                                        {m.percentage}% · {fmt(price * m.percentage / 100)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {(installmentMonths || monthly) && (
                                  <div style={{
                                    marginTop: '4px', fontSize: '9px', color: '#475569',
                                    borderTop: '1px dashed #cbd5e1', paddingTop: '3px',
                                    display: 'flex', justifyContent: 'space-between', gap: '8px',
                                  }}>
                                    {installmentMonths && <span>{installmentMonths} installments</span>}
                                    {monthly && <span style={{ color: '#10b981', fontWeight: 700 }}>~{fmt(monthly)}/mo</span>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>

        {/* Bottom pillars */}
        <div className="print-section" style={{
          background: '#1B3A5C', color: 'white', padding: '16px 24px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {pillars.map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#C49A2E', letterSpacing: '0.1em', marginBottom: '4px' }}>
                  {p.icon}
                </div>
                <div style={{ fontSize: '9px', color: 'white', lineHeight: 1.4 }}>
                  {p.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ReportFooter propertyTitle={propertyTitle} />

      </div>
    </div>
  )

  return (
    <>
      <style>{PRINT_CSS}</style>
      {createPortal(
        <>
          <PrintPreparingToast onClose={onClose} />
          {sheet}
        </>,
        document.body,
      )}
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
  propertyImages = [],
  propertyDescription,
  investmentMeta,
  onUnitImagesChange,
}: Props) {
  const { add, remove, has } = useComparator()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  // Share-link UI state. Key is `${unitId}:${optionId ?? ''}` so one copy
  // indicator per scope without clashing with others on the same page.
  const [sharing, setSharing] = useState<string | null>(null)
  const [sharedKey, setSharedKey] = useState<string | null>(null)

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    }
  }

  const handleShare = async (unitId: string | null, optionId: string | null) => {
    const key = `${unitId ?? ''}:${optionId ?? ''}`
    setSharing(key)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const res = await fetch(`${apiUrl}/api/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, unitId, unitOptionId: optionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || `Server error ${res.status}`)
      }
      const json = await res.json()
      const token = json.data?.token ?? json.token
      if (!token) throw new Error('No token returned')
      const shareUrl = `${window.location.origin}/share/${token}`
      const copied = await copyToClipboard(shareUrl)
      if (copied) {
        setSharedKey(key)
        setTimeout(() => setSharedKey(null), 2000)
      } else {
        window.prompt('Share link (copy it):', shareUrl)
      }
    } catch (error) {
      console.error('Failed to create share link:', error)
      alert(`Failed to generate share link: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSharing(null)
    }
  }

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
  // Print state for a single finish option (includes project context + images)
  const [printOption, setPrintOption] = useState<{ unit: Unit; option: UnitOption } | null>(null)
  // Print state for the full project report (all units)
  const [printProject, setPrintProject] = useState(false)

  // Collapsed/expanded state for per-unit sub-sections (ROI, Documents)
  const [roiOpen, setRoiOpen] = useState<Record<string, boolean>>({})
  const [docsOpen, setDocsOpen] = useState<Record<string, boolean>>({})
  const toggleRoi = (unitId: string) => setRoiOpen(p => ({ ...p, [unitId]: !p[unitId] }))
  const toggleDocs = (unitId: string) => setDocsOpen(p => ({ ...p, [unitId]: !p[unitId] }))

  // Logo URL from branding settings
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    const fetchLogo = async () => {
      try {
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-slate-900">Available Units</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{units.length} type{units.length !== 1 ? 's' : ''}</span>
            {units.length > 0 && (
              <button
                type="button"
                onClick={() => setPrintProject(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-[#1B3A5C] hover:bg-[#24507D] text-white transition-colors"
                title="Export a clean project-wide PDF listing every unit"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export Project PDF
              </button>
            )}
          </div>
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
                      {/* Share Unit — admin only */}
                      {isExpanded && isAdmin && (() => {
                        const key = `${unit.id}:`
                        const isCopied = sharedKey === key
                        const isLoading = sharing === key
                        return (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleShare(unit.id, null) }}
                            disabled={isLoading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white border-2 border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white'
                            } disabled:opacity-60`}
                            title={`Copy a share link scoped to ${unit.name}`}
                          >
                            {isCopied
                              ? <><Check className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copied!</span></>
                              : <><Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">{isLoading ? 'Generating…' : 'Share Unit'}</span></>
                            }
                          </button>
                        )
                      })()}
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

                            {/* Actions: compare + per-option PDF */}
                            <div className="mt-4 pt-3 border-t border-[#C49A2E]/20 flex items-center gap-2 flex-wrap">
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
                              <button
                                type="button"
                                onClick={() => setPrintOption({ unit, option: selOpt })}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-white border-2 border-[#C49A2E] text-[#C49A2E] hover:bg-[#C49A2E] hover:text-white transition-colors"
                                title={`Export ${selOpt.name} proposal PDF (includes project details)`}
                              >
                                <FileDown className="w-3.5 h-3.5" />
                                Export {selOpt.name} PDF
                              </button>
                              {/* Share this finish option — admin only */}
                              {isAdmin && (() => {
                                const key = `${unit.id}:${selOpt.id}`
                                const isCopied = sharedKey === key
                                const isLoading = sharing === key
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleShare(unit.id, selOpt.id)}
                                    disabled={isLoading}
                                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition-colors ${
                                      isCopied
                                        ? 'bg-emerald-600 text-white border-2 border-emerald-600'
                                        : 'bg-white border-2 border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white'
                                    } disabled:opacity-60`}
                                    title={`Copy a share link scoped to ${selOpt.name}`}
                                  >
                                    {isCopied
                                      ? <><Check className="w-3.5 h-3.5" />Copied!</>
                                      : <><Link2 className="w-3.5 h-3.5" />{isLoading ? 'Generating…' : `Share ${selOpt.name}`}</>
                                    }
                                  </button>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Collapsible: ROI & Payment Breakdown ── */}
                    {selOpt && totalPrice > 0 && (
                      <div className="border-t border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => toggleRoi(unit.id)}
                          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-[#1B3A5C]">
                            <Calculator className="w-4 h-4" />
                            ROI &amp; Payment Breakdown
                            <span className="text-xs text-slate-400 font-normal">(click to {roiOpen[unit.id] ? 'hide' : 'view'})</span>
                          </span>
                          {roiOpen[unit.id]
                            ? <ChevronUp className="w-4 h-4 text-slate-400" />
                            : <ChevronDown className="w-4 h-4 text-slate-400" />
                          }
                        </button>
                        {roiOpen[unit.id] && (
                          <div className="border-t border-slate-100">
                            <OptionRoiPanel
                              totalPrice={totalPrice}
                              currency={selOpt.currency || currency}
                              initialPayment={selOpt.initialPayment}
                              paymentPlanDetails={selOpt.paymentPlanDetails}
                              rentalYield={rentalYield}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Collapsible: Related Documents ── */}
                    {unitDocs.length > 0 && (
                      <div className="border-t border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => toggleDocs(unit.id)}
                          className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-[#1B3A5C]">
                            <FileText className="w-4 h-4" />
                            Related Documents
                            <span className="text-xs text-slate-400 font-normal">({unitDocs.length})</span>
                          </span>
                          {docsOpen[unit.id]
                            ? <ChevronUp className="w-4 h-4 text-slate-400" />
                            : <ChevronDown className="w-4 h-4 text-slate-400" />
                          }
                        </button>
                        {docsOpen[unit.id] && (
                          <div className="border-t border-slate-100 px-5 py-3">
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

      {/* ─── Unit Investment Proposal PDF Overlay (all finish options side-by-side) ────────── */}
      {printUnit && (
        <UnitSheetPrint
          propertyTitle={propertyTitle}
          propertyCountry={propertyCountry}
          propertyCity={propertyCity}
          propertyStatus={propertyStatus}
          propertyType={propertyType}
          propertyImages={propertyImages}
          unit={printUnit}
          currency={currency}
          rentalYield={rentalYield}
          capitalGrowth={capitalGrowth}
          logoUrl={logoUrl}
          investmentMeta={investmentMeta}
          onClose={() => setPrintUnit(null)}
        />
      )}

      {/* ─── Per-Finish-Option PDF Overlay (project details + pictures + single option) ────── */}
      {printOption && (
        <OptionSheetPrint
          propertyTitle={propertyTitle}
          propertyCountry={propertyCountry}
          propertyCity={propertyCity}
          propertyStatus={propertyStatus}
          propertyType={propertyType}
          propertyImages={propertyImages}
          propertyDescription={propertyDescription}
          unit={printOption.unit}
          option={printOption.option}
          currency={currency}
          rentalYield={rentalYield}
          capitalGrowth={capitalGrowth}
          logoUrl={logoUrl}
          investmentMeta={investmentMeta}
          onClose={() => setPrintOption(null)}
        />
      )}

      {/* ─── Project-wide PDF Overlay (lists every unit with clean details) ────── */}
      {printProject && (
        <ProjectSheetPrint
          propertyTitle={propertyTitle}
          propertyCountry={propertyCountry}
          propertyCity={propertyCity}
          propertyStatus={propertyStatus}
          propertyType={propertyType}
          propertyImages={propertyImages}
          propertyDescription={propertyDescription}
          units={units}
          currency={currency}
          rentalYield={rentalYield}
          capitalGrowth={capitalGrowth}
          logoUrl={logoUrl}
          investmentMeta={investmentMeta}
          onClose={() => setPrintProject(false)}
        />
      )}
    </div>
  )
}
