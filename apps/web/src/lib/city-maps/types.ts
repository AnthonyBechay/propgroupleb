/**
 * A city, explained on a map — for the people who sell it.
 *
 * One file per city in this folder, registered in `index.ts`. Nothing else in
 * the app knows which cities exist: the menu, the page and the map all read the
 * registry, so a new market (Tbilisi, Limassol, Dubai) is one data file and one
 * line, with no screen to write.
 *
 * Coordinates are [latitude, longitude], the order Leaflet uses.
 */

export type LatLng = [number, number]

/** What kind of place a region is. Drives the colour in "By type". */
export type ZoneType =
  | 'historic'
  | 'seafront'
  | 'highrise'
  | 'residential'
  | 'emerging'
  | 'resort'
  | 'industrial'

/** Our call on buying there. Drives the colour in "By verdict". */
export type Verdict = 'strong' | 'selective' | 'caution' | 'avoid'

export interface CityRegion {
  id: string
  name: string
  /** Other names a client or a developer brochure may use for it. */
  alsoCalled?: string[]
  type: ZoneType
  verdict: Verdict
  /** One line: what this place is. */
  summary: string
  /** The paragraph a broker should be able to say out loud. */
  about: string
  /** Who buys here and what for. */
  bestFor: string[]
  strengths: string[]
  watchOuts: string[]
  /** What is actually for sale there. */
  stock: string
  /** How it lets: who rents, and when. */
  rental: string
  /** Rough outline. Drawn by hand over the street map, not a legal boundary. */
  outline: LatLng[]
  /**
   * `Building.neighborhood` values that belong here, lower-case. Used to count
   * our own stock in the region when a project has no coordinates.
   */
  matches: string[]
}

export type PointKind = 'airport' | 'transport' | 'landmark' | 'opportunity' | 'risk'

export interface CityPoint {
  id: string
  kind: PointKind
  name: string
  at: LatLng
  note: string
}

export interface CityMap {
  slug: string
  city: string
  country: string
  /** Matches `Building.country`, so our own projects can be laid over it. */
  countryCode: string
  /** Matches `Building.city`, lower-case. */
  cityMatches: string[]
  centre: LatLng
  zoom: number
  /** Two or three sentences: the city as an investment, before any detail. */
  intro: string
  /** How to read the city in one go — the mental model. */
  howItWorks: string[]
  regions: CityRegion[]
  points: CityPoint[]
  /** When this was last reviewed by someone who knows the city. */
  reviewed: string
}

export const ZONE_LABEL: Record<ZoneType, string> = {
  historic: 'Historic centre',
  seafront: 'Established seafront',
  highrise: 'High-rise seafront',
  residential: 'Local residential',
  emerging: 'Emerging / edge of town',
  resort: 'Resort coast',
  industrial: 'Port and industry',
}

export const ZONE_COLOUR: Record<ZoneType, string> = {
  historic: '#b45309',
  seafront: '#0369a1',
  highrise: '#7c3aed',
  residential: '#475569',
  emerging: '#ca8a04',
  resort: '#0f766e',
  industrial: '#b91c1c',
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  strong: 'Good — recommend',
  selective: 'Good if you pick well',
  caution: 'Only for the right buyer',
  avoid: 'Do not recommend',
}

export const VERDICT_COLOUR: Record<Verdict, string> = {
  strong: '#15803d',
  selective: '#0369a1',
  caution: '#d97706',
  avoid: '#b91c1c',
}

export const POINT_LABEL: Record<PointKind, string> = {
  airport: 'Airport',
  transport: 'Transport',
  landmark: 'Landmarks',
  opportunity: 'Business opportunities',
  risk: 'Bad points to invest',
}

export const POINT_COLOUR: Record<PointKind, string> = {
  airport: '#1d4ed8',
  transport: '#334155',
  landmark: '#0f172a',
  opportunity: '#15803d',
  risk: '#b91c1c',
}
