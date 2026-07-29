/**
 * Reference codes shown to clients.
 *
 *   PG-1042      the property
 *   PG-1042-2    a specific unit inside it
 *
 * One prefix for everything, deliberately. A code has to survive being written
 * on a client's notepad for six months, so it must never change — and property
 * type does change (a shop is re-typed as a showroom, a "studio" turns out to
 * be a 1-bedroom). Encoding type would force the code to either lie or break.
 * The type is already shown as a badge beside the ref anyway.
 *
 * A listing has no code of its own — it shows the code of whatever it sells.
 */

interface RefBuilding {
  ref?: string | null
  _count?: { units?: number } | null
}

interface RefSubject {
  building?: RefBuilding | null
  unit?: { ref?: string | null; building?: RefBuilding | null } | null
}

/**
 * The code to display for a listing.
 *
 * A property with a single unit is one thing in the client's mind, so it gets
 * one code (PG-1042) rather than a property code plus a pointless "-1". The
 * suffix only appears where it earns its place: a project where several units
 * have to be told apart. If a second unit is later added, unit 1 starts showing
 * PG-1042-1 — anyone still quoting PG-1042 lands on the property and finds it,
 * because a property code matches everything beneath it.
 */
export function listingRef(listing: RefSubject | null | undefined): string | null {
  if (!listing) return null
  const building = listing.building ?? listing.unit?.building ?? null
  const unitRef = listing.unit?.ref ?? null
  if (!unitRef) return building?.ref ?? null

  const units = building?._count?.units
  // Fall back to the unit code when the count is unknown — better a redundant
  // suffix than a code that points at the wrong thing.
  return units != null && units <= 1 ? building?.ref ?? unitRef : unitRef
}

/** The property-level code inside any ref: "PG-1042-2" → "PG-1042". */
export function buildingRefOf(ref: string): string {
  return ref.match(/^(PG-\d+)/i)?.[1]?.toUpperCase() ?? ref
}

/**
 * The code to display for one unit among many, given how many the property has.
 * Same single-unit rule as `listingRef`, for screens that render units directly.
 */
export function unitRef(
  unit: { ref?: string | null } | null | undefined,
  unitCount: number,
  buildingRef?: string | null
): string | null {
  if (!unit?.ref) return buildingRef ?? null
  return unitCount <= 1 ? buildingRef ?? unit.ref : unit.ref
}

/**
 * True when `query` looks like someone quoting `ref` — tolerant of the ways
 * people retype a code ("pg 1042", "PG1042", "1042").
 */
export function refMatches(ref: string | null | undefined, query: string): boolean {
  if (!ref) return false
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return norm(ref).includes(norm(query))
}
