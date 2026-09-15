/**
 * What price the public websites will show for a property — computed here, in
 * the back office, so it can be shown to the person entering the data.
 *
 * This mirrors `derivePrice` in `apps/backend/src/utils/property-mapper.ts` and
 * its twin in the Georgia storefront. Three copies is not ideal, but the
 * alternative was what actually happened: a Georgia project was created with a
 * price, the storefront derived £0 from it, and nothing anywhere in the admin
 * could have told you. The admin never displayed the derived figure, so a
 * property that would render with no price looked identical to one that
 * wouldn't.
 *
 * The rule, in order:
 *   1. the lowest live listing price, when the property has listings
 *   2. the cheapest unit option — `pricePerSqm × area` — which is how off-plan
 *      Georgian stock is quoted and the only path it has
 *   3. a unit's direct asking price
 *   4. nothing, and the site shows no price at all
 */

export type PriceSource = 'listing' | 'option' | 'asking' | 'none'

export interface DerivedPrice {
  price: number
  currency: string
  source: PriceSource
  /** Plain-language account of where the figure came from. */
  explanation: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  // Prisma `Decimal` serialises to a string over JSON, so this sees both.
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** A listing state that is actually on the website. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isLive(listing: any): boolean {
  return ['ACTIVE', 'UNDER_OFFER'].includes(listing?.status)
    && listing?.visibility !== 'HIDDEN'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deriveDisplayPrice(units: any[], buildingListings: any[] = []): DerivedPrice {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listings: any[] = [
    ...buildingListings,
    ...units.flatMap((u) => u?.listings ?? []),
  ].filter(isLive)

  const listingPrices = listings
    .map((l) => ({ price: toNumber(l.price), currency: l.currency ?? 'USD' }))
    .filter((l): l is { price: number; currency: string } => l.price !== undefined && l.price > 0)

  if (listingPrices.length > 0) {
    const cheapest = listingPrices.reduce((a, b) => (b.price < a.price ? b : a))
    return {
      price: cheapest.price,
      currency: cheapest.currency,
      source: 'listing',
      explanation: listingPrices.length > 1
        ? `The lowest of ${listingPrices.length} live listings.`
        : 'From this property’s live listing.',
    }
  }

  let best: { price: number; currency: string; source: PriceSource; explanation: string } | null = null

  for (const unit of units) {
    const area = toNumber(unit?.areaSqm) ?? 0
    for (const option of unit?.options ?? []) {
      const perSqm = toNumber(option?.pricePerSqm) ?? 0
      if (perSqm <= 0 || area <= 0) continue
      const total = Math.round(perSqm * area)
      if (!best || total < best.price) {
        best = {
          price: total,
          currency: option.currency ?? 'USD',
          source: 'option',
          explanation: `${area} m² × ${option.currency === 'LBP' ? '' : '$'}${perSqm.toLocaleString()}/m² on the “${option.name ?? 'Standard'}” finish.`,
        }
      }
    }

    const asking = toNumber(unit?.askingPrice) ?? 0
    if (asking > 0 && (!best || asking < best.price)) {
      best = {
        price: asking,
        currency: unit.askingCurrency ?? 'USD',
        source: 'asking',
        explanation: 'From the unit’s asking price.',
      }
    }
  }

  if (best) return best

  return {
    price: 0,
    currency: 'USD',
    source: 'none',
    explanation: 'Nothing here carries a price, so the website will show this property without one.',
  }
}

export function formatMoney(price: number, currency: string): string {
  if (currency === 'LBP') return `${(price / 1_000_000).toFixed(1)}M LBP`
  return `$${price.toLocaleString()}`
}
