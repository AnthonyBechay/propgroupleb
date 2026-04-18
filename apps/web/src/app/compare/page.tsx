'use client'

import { useComparator } from '@/contexts/ComparatorContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  GitCompare, ArrowLeft, Trash2, Bed, Bath, Maximize, MapPin,
  CreditCard, TrendingUp, Check, Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComparatorItem, PaymentPlanDetails } from '@/lib/types/api'

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function calcMonthlyPayment(totalPrice: number, ppd: PaymentPlanDetails | null | undefined): number | null {
  if (!ppd?.installmentMonths || !ppd.milestones) return null
  const installmentPct = ppd.milestones.find(m => m.type === 'installment')?.percentage
    ?? (100 - (ppd.milestones.find(m => m.type === 'upfront')?.percentage ?? 0))
  return (totalPrice * installmentPct / 100) / ppd.installmentMonths
}

interface RowProps {
  label: string
  values: (string | number | null | undefined)[]
  highlight?: boolean
  isCurrency?: boolean
  currency?: string
}

function Row({ label, values, highlight, isCurrency, currency }: RowProps) {
  return (
    <tr className={highlight ? 'bg-[#E0EDF7]/30' : 'bg-white'}>
      <td className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-32 border-r border-slate-100 whitespace-nowrap">
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-4 py-3 text-sm text-slate-800 text-center border-r border-slate-100 last:border-r-0">
          {v == null ? (
            <Minus className="w-4 h-4 text-slate-300 mx-auto" />
          ) : isCurrency && typeof v === 'number' ? (
            <span className="font-semibold text-[#1B3A5C]">{fmt(v, currency!)}</span>
          ) : (
            <span>{v}</span>
          )}
        </td>
      ))}
      {/* Fill empty columns */}
      {Array.from({ length: 4 - values.length }).map((_, i) => (
        <td key={`empty-${i}`} className="px-4 py-3 border-r border-slate-100 last:border-r-0" />
      ))}
    </tr>
  )
}

export default function ComparePage() {
  const { items, remove, clear } = useComparator()
  const router = useRouter()

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        <GitCompare className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Nothing to compare yet</h1>
        <p className="text-slate-500 mb-6 text-center">
          Visit a project page and click &quot;Add to Compare&quot; on a unit &amp; finish option.
        </p>
        <Button onClick={() => router.push('/properties')} className="bg-[#1B3A5C] hover:bg-[#24507D] text-white">
          Browse Projects
        </Button>
      </div>
    )
  }

  const colItems = [...items, ...Array(4 - items.length).fill(null)] as (ComparatorItem | null)[]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500">
              <ArrowLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <GitCompare className="w-6 h-6 text-[#1B3A5C]" />
                Comparison
              </h1>
              <p className="text-sm text-slate-500">{items.length} option{items.length !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={clear} className="text-slate-500 hover:text-red-600">
            <Trash2 className="w-4 h-4 mr-1.5" />Clear All
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">

              {/* Column headers — property cards */}
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="px-4 py-4 w-32 border-r border-slate-200" />
                  {colItems.map((item, i) => (
                    <th key={i} className="px-4 py-4 border-r border-slate-200 last:border-r-0 text-left min-w-[180px]">
                      {item ? (
                        <div className="space-y-1">
                          <Link
                            href={`/property/${item.propertySlug}`}
                            className="font-bold text-[#1B3A5C] hover:underline text-sm leading-tight block"
                          >
                            {item.propertyTitle}
                          </Link>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[item.propertyCity, item.propertyCountry].filter(Boolean).join(', ')}
                          </p>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs bg-[#E0EDF7] text-[#1B3A5C] px-2 py-0.5 rounded font-medium">
                              {item.unitName}
                            </span>
                            <span className="text-xs bg-[#FEF3C7] text-[#D97706] px-2 py-0.5 rounded font-medium">
                              {item.optionName}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(item.unitId, item.optionId)}
                            className="text-slate-400 hover:text-red-500 h-6 px-1 mt-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-300 text-xs">
                          + Add option
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {/* Price */}
                <tr className="bg-[#1B3A5C] text-white">
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide border-r border-white/10">
                    Total Price
                  </td>
                  {colItems.map((item, i) => (
                    <td key={i} className="px-4 py-3 text-center border-r border-white/10 last:border-r-0">
                      {item ? (
                        <span className="text-xl font-bold text-[#C49A2E]">
                          {fmt(item.totalPrice, item.currency)}
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>

                {/* Price / m² */}
                <Row
                  label="Price / m²"
                  values={colItems.map(i => i?.totalPrice && i?.area ? i.totalPrice / i.area : null)}
                  isCurrency
                  currency={colItems.find(i => i)?.currency ?? 'USD'}
                />

                {/* Initial Payment */}
                <Row
                  label="Initial Payment"
                  highlight
                  values={colItems.map(i => i?.initialPayment ?? null)}
                  isCurrency
                  currency={colItems.find(i => i)?.currency ?? 'USD'}
                />

                {/* Monthly */}
                <Row
                  label="Monthly"
                  values={colItems.map(i => i ? calcMonthlyPayment(i.totalPrice, i.paymentPlanDetails) : null)}
                  isCurrency
                  currency={colItems.find(i => i)?.currency ?? 'USD'}
                />

                {/* Section: Unit specs */}
                <tr className="bg-slate-700 text-white">
                  <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-widest">Unit Specs</td>
                </tr>

                <Row label="Bedrooms" values={colItems.map(i => i?.bedrooms ?? null)} />
                <Row label="Bathrooms" highlight values={colItems.map(i => i?.bathrooms ?? null)} />
                <Row label="Area" values={colItems.map(i => i ? `${i.area} m²` : null)} />
                <Row label="Floor" highlight values={colItems.map(i => i?.floor != null ? `Floor ${i.floor}` : null)} />

                {/* Section: Project */}
                <tr className="bg-slate-700 text-white">
                  <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-widest">Project</td>
                </tr>

                <Row label="Type" values={colItems.map(i => i?.propertyType?.replace('_', ' ') ?? null)} />
                <Row label="Status" highlight values={colItems.map(i => i?.propertyStatus?.replace('_', ' ') ?? null)} />
                <Row label="Country" values={colItems.map(i => i?.propertyCountry ?? null)} />

                {/* Section: Payment Plan */}
                <tr className="bg-slate-700 text-white">
                  <td colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-widest">Payment Plan</td>
                </tr>

                <Row
                  label="Summary"
                  values={colItems.map(i => (i?.paymentPlanDetails as PaymentPlanDetails)?.summary ?? null)}
                />
                <Row
                  label="Installments"
                  highlight
                  values={colItems.map(i => {
                    const months = (i?.paymentPlanDetails as PaymentPlanDetails)?.installmentMonths
                    return months ? `${months} months` : null
                  })}
                />

                {/* Milestone breakdown */}
                {colItems.some(i => (i?.paymentPlanDetails as PaymentPlanDetails)?.milestones?.length) && (
                  <>
                    {Array.from({ length: Math.max(...colItems.map(i => (i?.paymentPlanDetails as PaymentPlanDetails)?.milestones?.length ?? 0)) }).map((_, mi) => (
                      <Row
                        key={`milestone-${mi}`}
                        label={`Step ${mi + 1}`}
                        values={colItems.map(i => {
                          const m = (i?.paymentPlanDetails as PaymentPlanDetails)?.milestones?.[mi]
                          return m ? `${m.label} (${m.percentage}%)` : null
                        })}
                      />
                    ))}
                  </>
                )}

              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Button onClick={() => router.push('/properties')} variant="outline">
            <GitCompare className="w-4 h-4 mr-2" />Add More Options
          </Button>
        </div>

      </div>
    </div>
  )
}
