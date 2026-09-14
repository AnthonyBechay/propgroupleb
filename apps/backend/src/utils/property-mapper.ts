/**
 * Building -> legacy `Property` shape.
 *
 * The catalogue is modelled as Building + Unit + Listing + UnitOption +
 * BuildingInvestmentData. The Georgia storefront (propgrp.com, a separate repo)
 * renders the older flat `Property` shape, so `GET /api/properties` folds the
 * model back down using this mapper. `/api/buildings` continues to serve the
 * native shape, which the back office uses.
 *
 * This mapper used to live in the storefront repo and run over HTTP responses,
 * which forced an N+1: its list endpoint truncated units, so every building had
 * to be re-fetched to get areas and options. Here it runs on Prisma results, so
 * one query carries everything.
 *
 * It stays deliberately defensive about field names and types — it is the
 * contract boundary for another repo, and a rename here is a cross-repo break.
 *
 * Realities that drive the mapping:
 *   - The reference code field is `ref` ("PG-1059"), not `referenceCode`.
 *   - Building `kind` is STANDALONE/PROJECT — a building classification, NOT a
 *     property type. Property type comes from the UNIT's `kind` (APARTMENT,
 *     STUDIO), which aligns with the legacy PropertyType enum.
 *   - `status` is OFF_PLAN/NEW_BUILD/RESALE, matching legacy PropertyStatus.
 *   - Prices are Prisma `Decimal`, and serialise to strings over JSON.
 *     Everything numeric goes through toNumber().
 *   - Georgian stock has NO listings; price is derived from
 *     pricePerSqm x areaSqm. Verified: Tonino 45m2 x $4000 = $180,000.
 *   - Amenities are direct boolean columns on the building, not a name list.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** First non-nullish value among the given keys. */
function pick<T = any>(source: any, ...keys: string[]): T | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
}

/**
 * Coerce to a number.
 *
 * Prisma returns `Decimal` objects in-process and strings once serialised, so
 * this handles both plus plain numbers. `Decimal.toNumber()` is preferred when
 * present — `Number(decimal)` works via valueOf but is easy to break.
 */
function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'object' && typeof (value as any).toNumber === 'function') {
    const d = (value as any).toNumber();
    return Number.isFinite(d) ? d : undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Normalise an enum-ish string to the UPPER_SNAKE the frontend switches on. */
function normaliseEnum(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/** Property types the legacy schema accepts; anything else is dropped so the
 *  frontend's colour/label lookups never receive an unknown key. */
const VALID_PROPERTY_TYPES = new Set([
  'APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO',
  'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE',
]);

function toPropertyType(value: unknown): string | null {
  const normalised = normaliseEnum(value);
  return normalised && VALID_PROPERTY_TYPES.has(normalised) ? normalised : null;
}

/** Map a shared UnitOption onto the legacy `UnitOption` shape. */
export function mapUnitOption(option: any, unitId: string): Record<string, unknown> {
  return {
    id: pick<string>(option, 'id') ?? '',
    unitId,
    name: pick<string>(option, 'name', 'title', 'label') ?? 'Standard',
    pricePerSqm: toNumber(pick(option, 'pricePerSqm', 'price_per_sqm')) ?? 0,
    currency: pick<string>(option, 'currency') ?? 'USD',
    initialPayment: toNumber(pick(option, 'initialPayment', 'downPayment')) ?? null,
    paymentPlanDetails: pick(option, 'paymentPlanDetails', 'paymentPlan') ?? null,
    description: pick<string>(option, 'description', 'notes') ?? null,
    createdAt: pick(option, 'createdAt') ?? null,
    updatedAt: pick(option, 'updatedAt') ?? null,
    referenceCode: pick<string>(option, 'ref', 'referenceCode', 'code') ?? null,
  };
}

/**
 * Map a shared Unit (+ its options) onto the legacy `Unit` shape.
 * `areaSqm` becomes `area`; `kind` becomes `propertyType`.
 */
export function mapUnit(unit: any, propertyId: string): Record<string, unknown> {
  const id = pick<string>(unit, 'id') ?? '';

  return {
    id,
    propertyId,
    name: pick<string>(unit, 'name', 'title', 'label') ?? buildUnitName(unit),
    unitNumber: pick<string>(unit, 'unitNumber', 'number') ?? null,
    propertyType: toPropertyType(pick(unit, 'kind', 'propertyType', 'type')),
    bedrooms: toNumber(pick(unit, 'bedrooms', 'beds')) ?? 0,
    bathrooms: toNumber(pick(unit, 'bathrooms', 'baths')) ?? 0,
    area: toNumber(pick(unit, 'areaSqm', 'area')) ?? 0,
    floor: toNumber(pick(unit, 'floor')) ?? null,
    parkingSpaces: toNumber(pick(unit, 'parkingSpaces')) ?? 0,
    notes: pick<string>(unit, 'notes', 'description') ?? null,
    images: toArray<string>(pick(unit, 'images', 'photos')),
    // `lifecycle` (DRAFT/…) is an editorial state on the shared side, not a
    // sales state — mapping it onto availabilityStatus would mark every unit
    // unavailable and hide the whole catalogue behind the default
    // `availabilityStatus=AVAILABLE` filter. Only an explicit sale marks a
    // unit as sold.
    availabilityStatus: pick(unit, 'soldAt') ? 'SOLD' : 'AVAILABLE',
    furnishingStatus: normaliseEnum(pick(unit, 'furnishing')),
    ownershipType: normaliseEnum(pick(unit, 'ownership')),
    createdAt: pick(unit, 'createdAt') ?? null,
    updatedAt: pick(unit, 'updatedAt') ?? null,
    /** Human reference code, e.g. "PG-1059-2" — clients quote these. */
    referenceCode: pick<string>(unit, 'ref', 'referenceCode', 'code') ?? null,
    options: toArray(pick(unit, 'options', 'unitOptions')).map((o) => mapUnitOption(o, id)),
  };
}

/** Fallback display name when the shared unit has no explicit label. */
function buildUnitName(unit: any): string {
  const kind = toPropertyType(pick(unit, 'kind', 'propertyType', 'type'));
  if (kind === 'STUDIO') return 'Studio';
  const beds = toNumber(pick(unit, 'bedrooms', 'beds'));
  if (beds) return `${beds}BR${kind ? ` ${kind.toLowerCase()}` : ''}`;
  return kind ? kind.charAt(0) + kind.slice(1).toLowerCase() : 'Unit';
}

/**
 * Lowest price for a building — the "from $X" figure on cards and detail.
 *
 * Preference order:
 *   1. an explicit listing price, when listings exist
 *   2. cheapest unit option, computed as pricePerSqm x unit area — this is the
 *      ONLY path for Georgian off-plan stock, which has no listings at all
 */
export function derivePrice(
  listings: any[],
  units: Array<Record<string, unknown>>,
): { price: number; currency: string } {
  const listingPrices = listings
    .map((l) => toNumber(pick(l, 'price', 'amount', 'askingPrice')))
    .filter((n): n is number => n !== undefined && n > 0);

  if (listingPrices.length > 0) {
    const currency = listings.map((l) => pick<string>(l, 'currency')).find(Boolean) ?? 'USD';
    return { price: Math.min(...listingPrices), currency };
  }

  let cheapest: number | undefined;
  let currency = 'USD';

  for (const unit of units) {
    const area = toNumber(unit.area) ?? 0;
    // A unit may also carry a direct asking price instead of options.
    const asking = toNumber((unit as any).askingPrice);
    if (asking && asking > 0 && (cheapest === undefined || asking < cheapest)) {
      cheapest = asking;
    }
    for (const option of toArray<any>(unit.options)) {
      const perSqm = toNumber(option.pricePerSqm) ?? 0;
      if (perSqm <= 0 || area <= 0) continue;
      const total = Math.round(perSqm * area);
      if (cheapest === undefined || total < cheapest) {
        cheapest = total;
        currency = option.currency || currency;
      }
    }
  }

  return { price: cheapest ?? 0, currency };
}

/** Map shared BuildingInvestmentData onto the legacy `investmentData` relation. */
export function mapInvestmentData(building: any, propertyId: string): Record<string, unknown> | null {
  const source = pick(building, 'investmentData', 'buildingInvestmentData', 'investment') ?? null;
  if (!source) return null;

  return {
    id: pick<string>(source, 'id') ?? `${propertyId}-investment`,
    propertyId,
    expectedROI: toNumber(pick(source, 'expectedROI', 'roi')) ?? null,
    rentalYield: toNumber(pick(source, 'rentalYield')) ?? null,
    capitalGrowth: toNumber(pick(source, 'capitalGrowth')) ?? null,
    annualAppreciation: toNumber(pick(source, 'annualAppreciation')) ?? null,
    minInvestment: toNumber(pick(source, 'minInvestment')) ?? null,
    maxInvestment: toNumber(pick(source, 'maxInvestment')) ?? null,
    downPaymentPercentage: toNumber(pick(source, 'downPaymentPercentage')) ?? null,
    paymentPlan: pick<string>(source, 'paymentPlan') ?? null,
    paymentPlanDetails: pick(source, 'paymentPlanDetails') ?? null,
    installmentYears: toNumber(pick(source, 'installmentYears')) ?? null,
    isGoldenVisaEligible: Boolean(pick(source, 'isGoldenVisaEligible')),
    goldenVisaMinAmount: toNumber(pick(source, 'goldenVisaMinAmount')) ?? null,
    completionDate: pick(source, 'completionDate') ?? null,
    handoverDate: pick(source, 'handoverDate') ?? null,
    expectedRentalStart: pick(source, 'expectedRentalStart') ?? null,
    averageRentPerMonth: toNumber(pick(source, 'averageRentPerMonth')) ?? null,
    propertyAppreciationHistory: toArray(pick(source, 'propertyAppreciationHistory')),
    comparableProperties: toArray(pick(source, 'comparableProperties')),
  };
}

/**
 * Project-level property type.
 *
 * Building `kind` is STANDALONE/PROJECT — a building classification, not a
 * property type — so it is deliberately ignored. The type shown on a card is
 * the most common unit kind, which is what the project actually offers.
 */
function deriveProjectType(units: Array<Record<string, unknown>>): string {
  const counts = new Map<string, number>();
  for (const unit of units) {
    const type = unit.propertyType as string | null;
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  if (counts.size === 0) return 'APARTMENT';
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Unit-derived stats hoisted onto the project.
 *
 * The legacy `Property` row carried bedrooms / bathrooms / area directly, and
 * PropertyCard plus the listing filters still read them. In the new model those
 * live on the units, so the smallest unit's figures are hoisted to give the
 * card its "from" values, with the full span exposed alongside for range
 * filters and "1–3 bed" style labels.
 *
 * Without this every card renders blank beds/baths/area and every bedroom or
 * area filter matches nothing.
 */
function deriveUnitStats(units: Array<Record<string, unknown>>) {
  const beds = units.map((u) => toNumber(u.bedrooms)).filter((n): n is number => n !== undefined);
  const baths = units.map((u) => toNumber(u.bathrooms)).filter((n): n is number => n !== undefined);
  const areas = units.map((u) => toNumber(u.area)).filter((n): n is number => n !== undefined && n > 0);

  return {
    bedrooms: beds.length ? Math.min(...beds) : null,
    bathrooms: baths.length ? Math.min(...baths) : null,
    area: areas.length ? Math.min(...areas) : null,
    minBedrooms: beds.length ? Math.min(...beds) : null,
    maxBedrooms: beds.length ? Math.max(...beds) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    unitCount: units.length,
  };
}

/**
 * Fold a Building (+ its units and investment data) back into the flat
 * `Property` object the frontend expects.
 *
 * `detail` controls payload weight: list views get units slimmed to `{ id }`,
 * matching the old PROPERTY_LIST_INCLUDE vs PROPERTY_DETAIL_INCLUDE split.
 */
export function mapBuildingToProperty(
  building: any,
  { detail = false }: { detail?: boolean } = {},
): Record<string, unknown> {
  const id = pick<string>(building, 'id') ?? '';

  const units = toArray(pick(building, 'units')).map((u) => mapUnit(u, id));

  // Listings may hang off the building or its units. Georgian stock has none;
  // this keeps the path open for markets that do.
  const listings = [
    ...toArray(pick(building, 'listings')),
    ...(pick(building, 'listing') ? [pick(building, 'listing')] : []),
    ...toArray(pick(building, 'units')).flatMap((u: any) => [
      ...toArray(pick(u, 'listings')),
      ...(pick(u, 'listing') ? [pick(u, 'listing')] : []),
    ]),
  ].filter(Boolean);

  const { price, currency } = derivePrice(listings, units);
  const investmentData = mapInvestmentData(building, id);
  const stats = deriveUnitStats(units);

  const property: Record<string, unknown> = {
    id,
    title: pick<string>(building, 'title', 'name') ?? '',
    description: pick<string>(building, 'description') ?? '',
    shortDescription: pick<string>(building, 'shortDescription', 'summary') ?? null,
    price,
    currency,

    propertyType: deriveProjectType(units),
    // Hoisted from the units — see deriveUnitStats.
    ...stats,
    builtYear: toNumber(pick(building, 'builtYear', 'yearBuilt')) ?? null,
    floors: toNumber(pick(building, 'totalFloors', 'floors')) ?? null,
    parkingSpaces: toNumber(pick(building, 'parkingSpaces')) ?? 0,

    country: normaliseEnum(pick(building, 'country')) ?? 'GEORGIA',
    city: pick<string>(building, 'city') ?? null,
    district: pick<string>(building, 'neighborhood', 'neighbourhood', 'district') ?? null,
    address: pick<string>(building, 'address') ?? null,
    zipCode: pick<string>(building, 'zipCode') ?? null,
    latitude: toNumber(pick(building, 'latitude', 'lat')) ?? null,
    longitude: toNumber(pick(building, 'longitude', 'lng')) ?? null,
    locationUrl: pick<string>(building, 'locationUrl', 'mapUrl') ?? null,

    // OFF_PLAN / NEW_BUILD / RESALE — identical vocabulary either side.
    status: normaliseEnum(pick(building, 'status')) ?? 'OFF_PLAN',
    // The shared building has no sales-availability column; infer from the
    // explicit sale/reservation markers rather than inventing one.
    availabilityStatus: pick(building, 'soldAt')
      ? 'SOLD'
      : pick(building, 'reservedUntil')
        ? 'RESERVED'
        : 'AVAILABLE',
    visibility: normaliseEnum(pick(building, 'visibility')) ?? 'PUBLIC',

    furnishingStatus: normaliseEnum(pick(building, 'furnishingStatus')),
    ownershipType: normaliseEnum(pick(building, 'ownershipType')),
    isGoldenVisaEligible: Boolean(
      pick(building, 'isGoldenVisaEligible') ?? investmentData?.isGoldenVisaEligible,
    ),

    // Direct boolean columns on the shared building — no name matching needed.
    hasPool: Boolean(pick(building, 'hasPool')),
    hasGym: Boolean(pick(building, 'hasGym')),
    hasGarden: Boolean(pick(building, 'hasGarden')),
    hasBalcony: Boolean(pick(building, 'hasBalcony', 'hasRooftop')),
    hasSecurity: Boolean(pick(building, 'hasSecurity') ?? pick(building, 'hasConcierge')),
    hasElevator: Boolean(pick(building, 'hasElevator')),
    hasCentralAC: Boolean(pick(building, 'hasCentralAC')),

    // Absolute URLs on assets.propgrp.com — no migration, no rewriting.
    images: toArray<string>(pick(building, 'images', 'photos')),
    videoUrl: pick<string>(building, 'videoUrl') ?? null,
    youtubeUrls: toArray<string>(pick(building, 'youtubeUrls', 'videoUrls')),
    virtualTourUrl: pick<string>(building, 'virtualTourUrl') ?? null,

    slug: pick<string>(building, 'slug') ?? null,
    metaTitle: pick<string>(building, 'metaTitle') ?? null,
    metaDescription: pick<string>(building, 'metaDescription') ?? null,
    featured: Boolean(pick(building, 'featured')),
    featuredUntil: pick(building, 'featuredUntil') ?? null,
    views: toNumber(pick(building, 'views')) ?? 0,

    shareToken: pick<string>(building, 'shareToken') ?? null,

    availableFrom: pick(building, 'availableFrom') ?? null,
    reservedUntil: pick(building, 'reservedUntil') ?? null,
    soldAt: pick(building, 'soldAt') ?? null,

    highlightedFeatures: toArray<string>(pick(building, 'highlightedFeatures', 'highlights')),

    createdAt: pick(building, 'createdAt') ?? null,
    updatedAt: pick(building, 'updatedAt') ?? null,
    publishedAt: pick(building, 'publishedAt') ?? null,

    /** Human reference code, e.g. "PG-1059". Clients quote these, so it is
     *  exposed on the payload ready to surface in UI. */
    referenceCode: pick<string>(building, 'ref', 'referenceCode', 'code') ?? null,

    developerId: pick<string>(building, 'developerId') ?? null,
    locationGuideId: pick<string>(building, 'locationGuideId') ?? null,
    agentId: pick<string>(building, 'agentId') ?? null,

    developer: pick(building, 'developer') ?? null,
    locationGuide: pick(building, 'locationGuide') ?? null,
    investmentData,

    _count: pick(building, '_count') ?? { favoriteProperties: 0, propertyInquiries: 0 },
  };

  if (detail) {
    property.units = units;
    property.agent = pick(building, 'agent') ?? null;
    property.amenities = toArray(pick(building, 'amenities'));
    property.tags = toArray(pick(building, 'tags'));
    property.documents = toArray(pick(building, 'documents'));
  } else {
    // Mirrors PROPERTY_LIST_INCLUDE: cards only read `units.length`.
    property.units = units.map((u) => ({ id: u.id }));
  }

  return property;
}
