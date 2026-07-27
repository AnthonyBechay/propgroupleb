// Market-aware location catalogue for the CRM.
//
// The CRM works two markets — Lebanon (this site's inventory) and Georgia
// (the sister site propgrp.com). Property creation must NEVER offer Georgian
// areas, so Georgia lives here and not in `lebanon-locations.ts`; the property
// forms import that module directly and are structurally unable to see these.

import { LEBANON_LOCATIONS, MOHAFAZAT_LABEL } from './lebanon-locations'

export type Market = 'LEBANON' | 'GEORGIA'

export interface AreaOption {
  /** Value stored on the lead (`areas[]`). */
  name: string
  /** District/municipality the area belongs to. */
  caza: string
  /** Region enum value — matches Lead.mohafazat. */
  region: string
  /** Parent town when the entry is a sub-area (e.g. Sassine → Achrafieh). */
  city?: string
}

// ── Georgia ──────────────────────────────────────────────────────────────────
// Region keys are prefixed `GE_` so they can never collide with a Lebanese
// mohafazat value.
export const GEORGIA_REGION_LABEL: Record<string, string> = {
  GE_ADJARA: 'Adjara (Batumi)',
  GE_TBILISI: 'Tbilisi',
  GE_IMERETI: 'Imereti (Kutaisi)',
  GE_KAKHETI: 'Kakheti',
  GE_SAMEGRELO: 'Samegrelo',
  GE_GURIA: 'Guria',
  GE_MTSKHETA: 'Mtskheta-Mtianeti',
}

const ge = (names: string[], caza: string, region: string): AreaOption[] =>
  names.map((name) => ({ name, caza, region }))

export const GEORGIA_AREAS: AreaOption[] = [
  // Adjara — Batumi and the Black Sea coast (the main investment market)
  ...ge([
    'Batumi Old Town', 'Batumi Boulevard', 'New Boulevard', 'Batumi Seafront', 'Gonio', 'Kvariati',
    'Sarpi', 'Makhinjauri', 'Chakvi', 'Kobuleti', 'Bagrationi', 'Khimshiashvili', 'Tamar District',
    'Rustaveli Batumi', 'Aghmashenebeli Batumi', 'Javakhishvili', 'Sherif Khimshiashvili',
    'Batumi Airport Area', 'Green Cape', 'Mtsvane Kontskhi', 'Angisa', 'Boni Gorodok',
  ], 'Batumi', 'GE_ADJARA'),

  // Tbilisi — capital
  ...ge([
    'Vake', 'Saburtalo', 'Vera', 'Sololaki', 'Mtatsminda', 'Old Tbilisi', 'Chugureti', 'Avlabari',
    'Didube', 'Gldani', 'Isani', 'Samgori', 'Nadzaladevi', 'Krtsanisi', 'Digomi', 'Dighomi Massive',
    'Lisi Lake', 'Tbilisi Sea', 'Ortachala', 'Varketili', 'Temka', 'Bagebi', 'Nutsubidze Plateau',
  ], 'Tbilisi', 'GE_TBILISI'),

  ...ge(['Kutaisi Centre', 'Kutaisi Old Town', 'Tskaltubo', 'Zestafoni', 'Samtredia'], 'Kutaisi', 'GE_IMERETI'),
  ...ge(['Telavi', 'Sighnaghi', 'Kvareli', 'Gurjaani', 'Lagodekhi'], 'Telavi', 'GE_KAKHETI'),
  ...ge(['Zugdidi', 'Poti', 'Anaklia', 'Senaki'], 'Zugdidi', 'GE_SAMEGRELO'),
  ...ge(['Ureki', 'Shekvetili', 'Ozurgeti', 'Grigoleti'], 'Ozurgeti', 'GE_GURIA'),
  ...ge(['Mtskheta', 'Gudauri', 'Stepantsminda (Kazbegi)', 'Bakuriani'], 'Mtskheta', 'GE_MTSKHETA'),
]

// ── Lebanon (derived from the property gazetteer, so the two never drift) ────
export const LEBANON_AREAS: AreaOption[] = LEBANON_LOCATIONS.map((l) => ({
  name: l.name,
  caza: l.caza,
  region: l.mohafazat,
  city: l.city,
}))

/** Every area option for a market, de-duplicated by name and sorted. */
export function areasFor(market: Market): AreaOption[] {
  const src = market === 'GEORGIA' ? GEORGIA_AREAS : LEBANON_AREAS
  const seen = new Set<string>()
  return src
    .filter((a) => {
      const key = a.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Region options (value + label) for a market. */
export function regionsFor(market: Market): Array<{ value: string; label: string }> {
  const labels = market === 'GEORGIA' ? GEORGIA_REGION_LABEL : MOHAFAZAT_LABEL
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

/** Human label for any region value, whichever market it belongs to. */
export function regionLabel(value?: string | null): string {
  if (!value) return ''
  return GEORGIA_REGION_LABEL[value] ?? MOHAFAZAT_LABEL[value] ?? value
}

/** Districts (cazas) available in a market, optionally narrowed to regions. */
export function cazasFor(market: Market, regions: string[] = []): string[] {
  const src = market === 'GEORGIA' ? GEORGIA_AREAS : LEBANON_AREAS
  const pool = regions.length ? src.filter((a) => regions.includes(a.region)) : src
  return Array.from(new Set(pool.map((a) => a.caza))).sort()
}

/** Areas filtered by chosen regions (all when none chosen) + a text query. */
export function searchAreas(market: Market, query: string, regions: string[] = [], limit = 60): AreaOption[] {
  const q = query.trim().toLowerCase()
  let pool = areasFor(market)
  if (regions.length) pool = pool.filter((a) => regions.includes(a.region))
  if (q) {
    pool = pool.filter(
      (a) => a.name.toLowerCase().includes(q) || a.caza.toLowerCase().includes(q) || (a.city ?? '').toLowerCase().includes(q)
    )
  }
  return pool.slice(0, limit)
}

/** The region an area belongs to (used to auto-fill region from a picked area). */
export function regionOfArea(market: Market, areaName: string): string | undefined {
  const src = market === 'GEORGIA' ? GEORGIA_AREAS : LEBANON_AREAS
  return src.find((a) => a.name.toLowerCase() === areaName.toLowerCase())?.region
}
