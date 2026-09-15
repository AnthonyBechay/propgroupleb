'use client'

/**
 * "This is the price the public site will show."
 *
 * It exists because of a bug that reached production: a Georgia project was
 * created with a price, and the storefront showed none. The price a visitor
 * sees is *derived* — from a listing, or from `pricePerSqm × area`, or from an
 * asking price — and the back office never displayed the result, so a property
 * that would render priceless looked exactly like one that wouldn't.
 *
 * Stating it plainly, next to the fields that feed it, turns an invisible
 * failure into an obvious one.
 */

import { AlertTriangle, ArrowRight, Tag } from 'lucide-react'
import { deriveDisplayPrice, formatMoney } from '@/lib/derive-price'
import { cn } from '@/lib/utils'

export function PriceSummary({
  units, buildingListings = [], className,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  units: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildingListings?: any[]
  className?: string
}) {
  const derived = deriveDisplayPrice(units, buildingListings)
  const missing = derived.source === 'none'

  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3.5',
        missing ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50',
        className,
      )}
    >
      <span className={cn('mt-0.5 shrink-0', missing ? 'text-amber-600' : 'text-emerald-600')}>
        {missing ? <AlertTriangle className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        {missing ? (
          <>
            <p className="text-sm font-semibold text-amber-900">The website will show no price</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              A price comes from a live listing on a unit, or from a finish option priced per m².
              Add one below and this will say what visitors see.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-emerald-900">
              The website will show{' '}
              <strong className="font-bold">{formatMoney(derived.price, derived.currency)}</strong>
              {units.length > 1 && <span className="font-normal"> — the lowest, as &ldquo;from&rdquo;</span>}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-800">
              <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
              {derived.explanation}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
