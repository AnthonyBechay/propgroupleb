/**
 * One definition of what a property can be, and which fields that implies.
 *
 * Before this existed the same list was hand-written in a dozen components and
 * they drifted — the admin form offered types the filters couldn't show, and
 * "does this have bedrooms?" was re-decided in four places. Everything that
 * needs a property type imports from here.
 */

export type PropertyKind =
  | 'APARTMENT' | 'STUDIO' | 'DUPLEX' | 'PENTHOUSE' | 'VILLA' | 'TOWNHOUSE'
  | 'SHOP' | 'OFFICE' | 'SHOWROOM' | 'WAREHOUSE' | 'RESTAURANT' | 'CLINIC'
  | 'WHOLE_BUILDING' | 'LAND_PARCEL' | 'STORAGE' | 'PARKING'

export type PropertyGroup = 'RESIDENTIAL' | 'COMMERCIAL' | 'OTHER'

interface PropertyTypeDef {
  label: string
  group: PropertyGroup
  /** Bedrooms are a meaningful attribute. */
  beds: boolean
  /** Bathrooms are a meaningful attribute. */
  baths: boolean
  /** Sits on a specific floor of a building. */
  floor: boolean
  /** Belongs inside a building — so building specs + amenities apply. */
  inBuilding: boolean
  /** Word used for its area, e.g. "Plot area" for land. */
  areaLabel: string
}

export const PROPERTY_TYPES: Record<PropertyKind, PropertyTypeDef> = {
  // ── Residential ──
  APARTMENT:  { label: 'Apartment',  group: 'RESIDENTIAL', beds: true,  baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  STUDIO:     { label: 'Studio',     group: 'RESIDENTIAL', beds: false, baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  DUPLEX:     { label: 'Duplex',     group: 'RESIDENTIAL', beds: true,  baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  PENTHOUSE:  { label: 'Penthouse',  group: 'RESIDENTIAL', beds: true,  baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  VILLA:      { label: 'Villa',      group: 'RESIDENTIAL', beds: true,  baths: true,  floor: false, inBuilding: false, areaLabel: 'Built area (m²)' },
  TOWNHOUSE:  { label: 'Townhouse',  group: 'RESIDENTIAL', beds: true,  baths: true,  floor: false, inBuilding: false, areaLabel: 'Built area (m²)' },

  // ── Commercial ──
  SHOP:       { label: 'Shop',       group: 'COMMERCIAL', beds: false, baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  OFFICE:     { label: 'Office',     group: 'COMMERCIAL', beds: false, baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  SHOWROOM:   { label: 'Showroom',   group: 'COMMERCIAL', beds: false, baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  WAREHOUSE:  { label: 'Warehouse',  group: 'COMMERCIAL', beds: false, baths: true,  floor: false, inBuilding: false, areaLabel: 'Area (m²)' },
  RESTAURANT: { label: 'Restaurant', group: 'COMMERCIAL', beds: false, baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  CLINIC:     { label: 'Clinic',     group: 'COMMERCIAL', beds: false, baths: true,  floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },

  // A whole building sold or rented as one — it IS the building.
  WHOLE_BUILDING: { label: 'Whole building', group: 'COMMERCIAL', beds: false, baths: false, floor: false, inBuilding: false, areaLabel: 'Total built area (m²)' },

  // ── Other ──
  LAND_PARCEL: { label: 'Land plot',    group: 'OTHER', beds: false, baths: false, floor: false, inBuilding: false, areaLabel: 'Plot area (m²)' },
  STORAGE:     { label: 'Storage',      group: 'OTHER', beds: false, baths: false, floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
  PARKING:     { label: 'Parking spot', group: 'OTHER', beds: false, baths: false, floor: true,  inBuilding: true,  areaLabel: 'Area (m²)' },
}

/** Types grouped for a nicely organised <select>. */
export const PROPERTY_TYPE_GROUPS: Array<{ group: PropertyGroup; label: string; kinds: PropertyKind[] }> = [
  { group: 'RESIDENTIAL', label: 'Residential', kinds: ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE'] },
  { group: 'COMMERCIAL',  label: 'Commercial',  kinds: ['SHOP', 'OFFICE', 'SHOWROOM', 'WAREHOUSE', 'RESTAURANT', 'CLINIC', 'WHOLE_BUILDING'] },
  { group: 'OTHER',       label: 'Land & other', kinds: ['LAND_PARCEL', 'STORAGE', 'PARKING'] },
]

export const ALL_PROPERTY_KINDS = Object.keys(PROPERTY_TYPES) as PropertyKind[]

/** Safe lookup — unknown values (older rows) fall back to a sensible default. */
export function typeDef(kind?: string | null): PropertyTypeDef {
  return PROPERTY_TYPES[(kind ?? '') as PropertyKind] ?? PROPERTY_TYPES.APARTMENT
}

export function typeLabel(kind?: string | null): string {
  if (!kind) return '—'
  return PROPERTY_TYPES[kind as PropertyKind]?.label
    // Unknown value: prettify rather than showing a raw enum.
    ?? kind.charAt(0) + kind.slice(1).toLowerCase().replace(/_/g, ' ')
}

/** Amenities only make sense for things inside/being a real building. */
export function showsBuildingSpecs(kind?: string | null): boolean {
  return typeDef(kind).inBuilding || kind === 'WHOLE_BUILDING'
}

/** Residential-only amenities are noise on a shop or a warehouse. */
export function isResidential(kind?: string | null): boolean {
  return typeDef(kind).group === 'RESIDENTIAL'
}
