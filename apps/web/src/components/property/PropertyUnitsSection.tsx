'use client'

import { useState, useCallback } from 'react'
import {
  Bed, Bath, Maximize, ChevronDown, ChevronUp,
  FileText, Download, CreditCard, Calculator,
  GitCompare, Check, X, Image as ImageIcon,
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
              <div key={unit.id}>
                {/* ── Unit header ── */}
                <div
                  className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleUnitExpanded(unit)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleUnitExpanded(unit)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="font-semibold text-slate-900">{unit.name}</span>
                      {unit.unitNumber && (
                        <span className="text-xs bg-[#E0EDF7] text-[#1B3A5C] px-2 py-0.5 rounded font-mono">{unit.unitNumber}</span>
                      )}
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{unit.bedrooms} bed</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{unit.bathrooms} bath</span>
                        <span className="flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{unit.area} m²</span>
                        {unit.floor != null && <span className="hidden sm:inline">Floor {unit.floor}</span>}
                      </div>
                      {unit.images.length > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />{unit.images.length} photos
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAILABILITY_STYLE[unit.availabilityStatus] || 'bg-gray-100 text-gray-600'}`}>
                        {unit.availabilityStatus.replace('_', ' ')}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* ── Expanded content ── */}
                {isExpanded && (
                  <div>
                    {/* Unit-specific images */}
                    {unit.images.length > 0 && (
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
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
                      <div className="border-t border-slate-100">
                        {/* Option tab picker */}
                        <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
                          {unit.options.map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => selectOption(unit.id, opt.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                selOptId === opt.id
                                  ? 'bg-[#1B3A5C] text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {opt.name}
                            </button>
                          ))}
                        </div>

                        {/* Selected option details */}
                        {selOpt && (
                          <div className="px-4 py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 min-w-0">
                                <div className="font-semibold text-slate-900">{selOpt.name}</div>
                                {selOpt.description && (
                                  <p className="text-xs text-slate-500">{selOpt.description}</p>
                                )}
                                <div className="text-xs text-slate-500">
                                  {fmt(selOpt.pricePerSqm)}/m²
                                  {selOpt.initialPayment != null && selOpt.initialPayment > 0 && (
                                    <> · Initial: <span className="text-[#D97706] font-medium">{fmt(selOpt.initialPayment)}</span></>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-2xl font-bold text-[#1B3A5C]">{fmt(totalPrice)}</div>
                                <div className="text-xs text-slate-500">{unit.area} m²</div>
                              </div>
                            </div>

                            {/* Add to Comparator */}
                            <div className="mt-3 flex items-center gap-2">
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
                                  ? <><Check className="w-3.5 h-3.5 mr-1.5" />Added</>
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
    </div>
  )
}
