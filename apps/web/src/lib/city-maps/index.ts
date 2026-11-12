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
  /** The Google Maps link pasted on the property. */
  locationUrl?: string | null
  visibility?: string | null
}

/**
 * Where a Google Maps link points.
 *
 * Almost no project has latitude/longitude typed in — what the team pastes is
 * a Google Maps link, and that is what the public page draws its map from. So
 * the pin is read out of the same link. `!3d…!4d…` is the place itself and is
 * preferred; `@lat,lng` is only where the camera was, usually a street away.
 */
export function coordsFromMapsUrl(url?: string | null): LatLng | null {
  if (!url) return null
  const text = (() => { try { return decodeURIComponent(url) } catch { return url } })()
  const pins = [...text.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)]
  const hit =
    pins[pins.length - 1] ??
    text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ??
    text.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ??
    text.match(/\/(-?\d+\.\d{3,}),(-?\d+\.\d{3,})/)
  if (!hit) return null
  const lat = Number(hit[1])
  const lng = Number(hit[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0) ? [lat, lng] : null
}

/** Where a project is: its typed coordinates, else its Google Maps link. */
export function coordsOf(project: OurProject): LatLng | null {
  const lat = Number(project.latitude)
  const lng = Number(project.longitude)
  if (project.latitude != null && project.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return [lat, lng]
  }
  return coordsFromMapsUrl(project.locationUrl)
}

/** Rough distance in km — enough to say "is this in or around the city". */
function km(a: LatLng, b: LatLng): number {
  const dy = (a[0] - b[0]) * 111
  const dx = (a[1] - b[1]) * 111 * Math.cos((a[0] * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

/**
 * Which region one of our own projects is in: by where its pin falls, otherwise
 * by the district name typed on the property.
 */
export function regionOf(city: CityMap, project: OurProject): string | null {
  const at = coordsOf(project)
  if (at) {
    const hit = city.regions.find((r) => inside(at, r.outline))
    if (hit) return hit.id
  }
  const named = `${project.neighborhood ?? ''} ${project.city ?? ''}`.trim().toLowerCase()
  if (!named) return null
  return city.regions.find((r) => r.matches.some((m) => named.includes(m)))?.id ?? null
}

/**
 * Our projects that belong on this city's map: anything pinned within reach of
 * it, and anything unpinned that names the city.
 */
export function projectsIn(city: CityMap, projects: OurProject[]): OurProject[] {
  return projects.filter((p) => {
    if ((p.country ?? '').toUpperCase() !== city.countryCode) return false
    const at = coordsOf(p)
    if (at) return km(at, city.centre) <= city.reachKm
    const where = `${p.city ?? ''} ${p.neighborhood ?? ''}`.toLowerCase()
    return city.cityMatches.some((m) => where.includes(m))
  })
}
