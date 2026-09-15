/**
 * One shape for the property form, shared by create and edit.
 *
 * There were two forms — a create wizard and an edit screen — each with its own
 * state object, its own payload builder and its own opinion about which fields
 * a property has. They had drifted badly:
 *
 *  - Create offered a "Generator" and "Solar power" checkbox for a Georgian
 *    property; edit correctly hid both (they are a Lebanese concern).
 *  - Create had `negotiable` and a price-per-m² mode; edit had neither.
 *  - Edit carried `latitude` / `longitude` in state and posted them on every
 *    save, but rendered no input for either — dead state that could only ever
 *    write back what it was given.
 *
 * They are one screen now (`PropertyForm`), built from `emptyBuildingForm` and
 * submitted through `buildingPayload`, so a field added here can only appear
 * and be saved one way.
 */

import type { PaymentPlan } from '@/components/admin/PaymentPlansEditor'

// ── Investment data ───────────────────────────────────────────────────────────

/**
 * `BuildingInvestmentData`, which had no editor anywhere in the back office.
 *
 * The public site has always rendered it: `PropertyCard` shows an ROI badge,
 * the listing page prints Expected ROI and Rental Yield, the share page leads
 * with them, and the AI search both filters and sorts on them. The only way to
 * populate any of it was the legacy `/api/properties` route the admin stopped
 * calling — so in practice every property showed nothing.
 */
export interface InvestmentFormState {
  expectedROI: string
  rentalYield: string
  capitalGrowth: string
  annualAppreciation: string
  minInvestment: string
  downPaymentPercentage: string
  installmentYears: string
  isGoldenVisaEligible: boolean
  goldenVisaMinAmount: string
  completionDate: string
  handoverDate: string
  averageRentPerMonth: string
  mortgageAvailable: boolean
  serviceFee: string
  propertyTax: string
}

export const EMPTY_INVESTMENT: InvestmentFormState = {
  expectedROI: '', rentalYield: '', capitalGrowth: '', annualAppreciation: '',
  minInvestment: '', downPaymentPercentage: '', installmentYears: '',
  isGoldenVisaEligible: false, goldenVisaMinAmount: '',
  completionDate: '', handoverDate: '', averageRentPerMonth: '',
  mortgageAvailable: false, serviceFee: '', propertyTax: '',
}

// ── Form state ────────────────────────────────────────────────────────────────

export interface BuildingFormState {
  // Identity
  title: string
  kind: string
  status: string
  source: string
  visibility: string
  featured: boolean
  shortDescription: string
  description: string

  // Location
  country: string
  mohafazat: string
  caza: string
  city: string
  neighborhood: string
  address: string
  zipCode: string
  latitude: string
  longitude: string
  locationUrl: string

  // Building specs
  builtYear: string
  totalFloors: string
  parkingSpaces: string

  // Amenities
  hasGenerator: boolean
  hasSolarPower: boolean
  hasElevator: boolean
  hasSecurity: boolean
  hasPool: boolean
  hasGym: boolean
  hasConcierge: boolean
  hasGarden: boolean
  hasRooftop: boolean
  hasCentralAC: boolean

  // Media & marketing
  images: string[]
  videoUrl: string
  youtubeUrls: string[]
  virtualTourUrl: string
  highlightedFeatures: string[]
  availableFrom: string

  // SEO
  metaTitle: string
  metaDescription: string

  paymentPlans: PaymentPlan[]
  investment: InvestmentFormState

  /**
   * The property type. It lives on the unit, not the building — a property with
   * one unit *is* that unit's type. Developments set it per unit instead.
   */
  unitKind: string
}

export const AMENITY_KEYS = [
  'hasGenerator', 'hasSolarPower', 'hasElevator', 'hasSecurity',
  'hasPool', 'hasGym', 'hasConcierge', 'hasGarden', 'hasRooftop', 'hasCentralAC',
] as const

export type AmenityKey = (typeof AMENITY_KEYS)[number]

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
/** An ISO timestamp from the API rendered for `<input type="date">`. */
const dateInput = (v: unknown): string => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function emptyBuildingForm(initial?: any): BuildingFormState {
  const units: any[] = Array.isArray(initial?.units) ? initial.units : [] // eslint-disable-line @typescript-eslint/no-explicit-any
  const inv = initial?.investmentData ?? {}

  return {
    title: initial?.title ?? '',
    kind: initial?.kind ?? 'STANDALONE',
    status: initial?.status ?? 'NEW_BUILD',
    source: initial?.source ?? 'ADMIN',
    visibility: initial?.visibility ?? 'PUBLIC',
    featured: initial?.featured ?? false,
    shortDescription: initial?.shortDescription ?? '',
    description: initial?.description ?? '',

    country: initial?.country ?? 'LEBANON',
    mohafazat: initial?.mohafazat ?? '',
    caza: initial?.caza ?? '',
    city: initial?.city ?? '',
    neighborhood: initial?.neighborhood ?? '',
    address: initial?.address ?? '',
    zipCode: initial?.zipCode ?? '',
    latitude: str(initial?.latitude),
    longitude: str(initial?.longitude),
    locationUrl: initial?.locationUrl ?? '',

    builtYear: str(initial?.builtYear),
    totalFloors: str(initial?.totalFloors),
    parkingSpaces: str(initial?.parkingSpaces),

    hasGenerator: initial?.hasGenerator ?? false,
    hasSolarPower: initial?.hasSolarPower ?? false,
    hasElevator: initial?.hasElevator ?? false,
    hasSecurity: initial?.hasSecurity ?? false,
    hasPool: initial?.hasPool ?? false,
    hasGym: initial?.hasGym ?? false,
    hasConcierge: initial?.hasConcierge ?? false,
    hasGarden: initial?.hasGarden ?? false,
    hasRooftop: initial?.hasRooftop ?? false,
    hasCentralAC: initial?.hasCentralAC ?? false,

    images: initial?.images ?? [],
    videoUrl: initial?.videoUrl ?? '',
    youtubeUrls: initial?.youtubeUrls ?? [],
    virtualTourUrl: initial?.virtualTourUrl ?? '',
    highlightedFeatures: initial?.highlightedFeatures ?? [],
    availableFrom: dateInput(initial?.availableFrom),

    metaTitle: initial?.metaTitle ?? '',
    metaDescription: initial?.metaDescription ?? '',

    paymentPlans: (initial?.paymentPlans ?? []) as PaymentPlan[],

    investment: {
      expectedROI: str(inv.expectedROI),
      rentalYield: str(inv.rentalYield),
      capitalGrowth: str(inv.capitalGrowth),
      annualAppreciation: str(inv.annualAppreciation),
      minInvestment: str(inv.minInvestment),
      downPaymentPercentage: str(inv.downPaymentPercentage),
      installmentYears: str(inv.installmentYears),
      isGoldenVisaEligible: inv.isGoldenVisaEligible ?? false,
      goldenVisaMinAmount: str(inv.goldenVisaMinAmount),
      completionDate: dateInput(inv.completionDate),
      handoverDate: dateInput(inv.handoverDate),
      averageRentPerMonth: str(inv.averageRentPerMonth),
      mortgageAvailable: inv.mortgageAvailable ?? false,
      serviceFee: str(inv.serviceFee),
      propertyTax: str(inv.propertyTax),
    },

    unitKind: units[0]?.kind ?? 'APARTMENT',
  }
}

// ── Payload ───────────────────────────────────────────────────────────────────

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v))
const int = (v: string): number | null => (v.trim() === '' ? null : parseInt(v, 10))

/** Has the admin entered any investment figure at all? */
export function hasInvestmentData(inv: InvestmentFormState): boolean {
  return Object.entries(inv).some(([, v]) => (typeof v === 'boolean' ? v : String(v).trim() !== ''))
}

/**
 * Turn the form into the `POST`/`PUT /api/buildings` body.
 *
 * `investmentData` is only sent when something was actually filled in — an
 * all-null object would otherwise create an empty row for every property and
 * make "has investment data" untestable downstream.
 */
export function buildingPayload(
  f: BuildingFormState,
  opts: { showBuildingSpecs: boolean },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  const specs = opts.showBuildingSpecs
  const inv = f.investment

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    title: f.title.trim(),
    kind: f.kind,
    status: f.status,
    source: f.source,
    visibility: f.visibility,
    featured: f.featured,
    description: f.description || null,
    shortDescription: f.shortDescription || null,

    country: f.country,
    mohafazat: f.mohafazat || null,
    caza: f.caza || null,
    city: f.city || null,
    neighborhood: f.neighborhood || null,
    address: f.address || null,
    zipCode: f.zipCode || null,
    latitude: num(f.latitude),
    longitude: num(f.longitude),
    locationUrl: f.locationUrl || null,

    // A land plot has no built year, floors or lifts; sending the numbers a
    // previous type left behind would quietly resurrect them on the public page.
    builtYear: specs ? int(f.builtYear) : null,
    totalFloors: specs ? int(f.totalFloors) : null,
    parkingSpaces: specs ? int(f.parkingSpaces) : null,
    hasGenerator: specs && f.hasGenerator,
    hasSolarPower: specs && f.hasSolarPower,
    hasElevator: specs && f.hasElevator,
    hasSecurity: specs && f.hasSecurity,
    hasPool: specs && f.hasPool,
    hasGym: specs && f.hasGym,
    hasConcierge: specs && f.hasConcierge,
    hasGarden: specs && f.hasGarden,
    hasRooftop: specs && f.hasRooftop,
    hasCentralAC: specs && f.hasCentralAC,

    images: f.images,
    videoUrl: f.videoUrl || null,
    youtubeUrls: f.youtubeUrls,
    virtualTourUrl: f.virtualTourUrl || null,
    highlightedFeatures: f.highlightedFeatures,
    availableFrom: f.availableFrom || null,

    metaTitle: f.metaTitle || null,
    metaDescription: f.metaDescription || null,

    paymentPlans: f.paymentPlans?.length ? f.paymentPlans : null,
  }

  if (hasInvestmentData(inv)) {
    payload.investmentData = {
      expectedROI: num(inv.expectedROI),
      rentalYield: num(inv.rentalYield),
      capitalGrowth: num(inv.capitalGrowth),
      annualAppreciation: num(inv.annualAppreciation),
      minInvestment: num(inv.minInvestment),
      downPaymentPercentage: num(inv.downPaymentPercentage),
      installmentYears: int(inv.installmentYears),
      isGoldenVisaEligible: inv.isGoldenVisaEligible,
      goldenVisaMinAmount: num(inv.goldenVisaMinAmount),
      completionDate: inv.completionDate || null,
      handoverDate: inv.handoverDate || null,
      averageRentPerMonth: num(inv.averageRentPerMonth),
      mortgageAvailable: inv.mortgageAvailable,
      serviceFee: num(inv.serviceFee),
      propertyTax: num(inv.propertyTax),
    }
  }

  return payload
}

// ── Google Maps coordinates ───────────────────────────────────────────────────

/**
 * Pull `lat,lng` out of whatever the admin pasted.
 *
 * `latitude`/`longitude` are real columns that nothing in the admin ever wrote,
 * and asking someone to read two decimal numbers off a map and retype them is
 * how they stay empty. What people actually have is a Maps link, in one of
 * several shapes: `@33.88,35.50,17z` from the address bar, `!3d33.88!4d35.50`
 * from a share link, `?q=33.88,35.50` from a pin. A bare "33.88, 35.50" pasted
 * from anywhere works too.
 *
 * Returns null rather than guessing — a shortened `maps.app.goo.gl` link
 * carries no coordinates at all until it is followed.
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const s = input.trim()
  if (!s) return null

  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,        // /@33.8886,35.4955,17z
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,     // !3d33.8886!4d35.4955
    /[?&]q=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=33.8886,35.4955
    /[?&]ll=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,  // pasted pair
  ]

  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  }
  return null
}
