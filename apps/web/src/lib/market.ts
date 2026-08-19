/**
 * Markets, for admin screens that now cover both websites.
 *
 * One back office, two public sites: propgrouplb.com sells Lebanon,
 * propgrp.com sells everything else. A record belongs to a site by its
 * `country`, so admin lists mix both and need a consistent way to label and
 * filter them.
 */

export type MarketScope = 'all' | 'LEBANON' | 'INTERNATIONAL'

export const MARKET_OPTIONS: Array<{ value: MarketScope; label: string }> = [
  { value: 'all', label: 'All markets' },
  { value: 'LEBANON', label: '🇱🇧 Lebanon' },
  { value: 'INTERNATIONAL', label: '🌍 International' },
]

/** Flag for a country, for inline labelling in dense tables. */
export function countryFlag(country?: string | null): string {
  switch (country) {
    case 'GEORGIA': return '🇬🇪'
    case 'CYPRUS': return '🇨🇾'
    case 'GREECE': return '🇬🇷'
    case 'LEBANON': return '🇱🇧'
    default: return '🌍'
  }
}

/**
 * Does this record belong in the selected scope?
 *
 * "International" is defined as everything that isn't Lebanon rather than a
 * fixed list, so adding a country never means touching this.
 */
export function inMarket(country: string | null | undefined, scope: MarketScope): boolean {
  if (scope === 'all') return true
  const c = country ?? 'LEBANON'
  return scope === 'LEBANON' ? c === 'LEBANON' : c !== 'LEBANON'
}

/** Which site a record appears on — the answer admins actually want. */
export function siteFor(country?: string | null): string {
  return (country ?? 'LEBANON') === 'LEBANON' ? 'propgrouplb.com' : 'propgrp.com'
}
