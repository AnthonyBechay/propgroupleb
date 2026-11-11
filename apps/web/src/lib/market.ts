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

/**
 * A country as stored: upper-case, words joined by underscores — "LEBANON",
 * "GEORGIA", "UNITED_ARAB_EMIRATES". Mirrors `normaliseCountry` in the
 * backend's utils/market.ts.
 *
 * There is no fixed list of countries: a project can be in any of them. The
 * only one the code treats differently is LEBANON; everything else is
 * international and appears on propgrp.com.
 */
export function normaliseCountry(input?: string | null): string {
  return (input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

/** "UNITED_ARAB_EMIRATES" → "United Arab Emirates". */
export function countryLabel(country?: string | null): string {
  return normaliseCountry(country)
    .split('_')
    .filter(Boolean)
    .map((w) => (['OF', 'AND', 'THE'].includes(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ')
}

/**
 * Flags for the places we are likely to list in. Only decoration: a market
 * missing from here works everywhere and shows a globe. The list of markets
 * itself is kept by the office (Settings → Markets), not here.
 */
const FLAG: Record<string, string> = {
  LEBANON: 'LB', GEORGIA: 'GE', BULGARIA: 'BG', CYPRUS: 'CY', GREECE: 'GR', TURKEY: 'TR',
  UNITED_ARAB_EMIRATES: 'AE', UAE: 'AE', DUBAI: 'AE', ABU_DHABI: 'AE', SAUDI_ARABIA: 'SA',
  QATAR: 'QA', OMAN: 'OM', EGYPT: 'EG', SPAIN: 'ES', PORTUGAL: 'PT', ITALY: 'IT', FRANCE: 'FR',
  MONTENEGRO: 'ME', ALBANIA: 'AL', ROMANIA: 'RO', HUNGARY: 'HU', SERBIA: 'RS', ARMENIA: 'AM',
  AZERBAIJAN: 'AZ', UNITED_KINGDOM: 'GB', UNITED_STATES: 'US', CANADA: 'CA', THAILAND: 'TH',
}

/** Flag for a country, for inline labelling in dense tables. */
export function countryFlag(country?: string | null): string {
  const iso = FLAG[normaliseCountry(country)]
  if (!iso) return '🌍'
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** "🇧🇬 Bulgaria". */
export function countryWithFlag(country?: string | null): string {
  return `${countryFlag(country)} ${countryLabel(country)}`.trim()
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
