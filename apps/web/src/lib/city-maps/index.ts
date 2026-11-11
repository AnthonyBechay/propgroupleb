import { BATUMI } from './batumi'
import type { CityMap, LatLng } from './types'

export * from './types'

/**
 * Every city the team has a map for. To add one: copy `batumi.ts`, fill it in,
 * add it here. The menu entry and the screen appear by themselves.
 */
export const CITY_MAPS: CityMap[] = [BATUMI]

export function cityMap(slug: string): CityMap | null {
  return CITY_MAPS.find((c) => c.slug === slug) ?? null
}

/** Is this point inside this outline? (Ray casting; outlines are small and flat enough.) */
export function inside(point: LatLng, outline: LatLng[]): boolean {
  const [y, x] = point
  let hit = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [yi, xi] = outline[i]
    const [yj, xj] = outline[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export interface OurProject {
  id: string
  title: string
  ref?: string | null
  city?: string | null
  neighborhood?: string | null
  country?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  visibility?: string | null
}

/**
 * Which region one of our own projects is in: by its coordinates when it has
 * them, otherwise by the district name typed on the property.
 */
export function regionOf(city: CityMap, project: OurProject): string | null {
  const lat = Number(project.latitude)
  const lng = Number(project.longitude)
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
    const hit = city.regions.find((r) => inside([lat, lng], r.outline))
    if (hit) return hit.id
  }
  const named = (project.neighborhood ?? '').trim().toLowerCase()
  if (!named) return null
  return city.regions.find((r) => r.matches.some((m) => named === m || named.includes(m)))?.id ?? null
}

/** Our projects that belong to this city at all. */
export function projectsIn(city: CityMap, projects: OurProject[]): OurProject[] {
  return projects.filter((p) => {
    if ((p.country ?? '').toUpperCase() !== city.countryCode) return false
    const where = `${p.city ?? ''} ${p.neighborhood ?? ''}`.toLowerCase()
    return city.cityMatches.some((m) => where.includes(m)) || regionOf(city, p) !== null
  })
}
