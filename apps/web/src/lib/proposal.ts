/**
 * A property, turned into the document you hand a client.
 *
 * Two markets, two different documents — because the two buyers are asking
 * different questions and a single template flatters neither:
 *
 *   **Lebanon** is a home. The buyer wants to know where it is, how big it is,
 *   what the building has, and what it costs. It is a brochure.
 *
 *   **Georgia and the rest** is an investment. The buyer wants the return, the
 *   entry price, the payment schedule, when it hands over and whether it buys
 *   residency. The apartment matters, but it is the second question. It is a memo.
 *
 * So `profile` decides the order and emphasis of the sections, not just the
 * wording. Everything is derived here, in one place, so the on-screen preview,
 * the printed PDF and the shared link cannot disagree about what a property is.
 */

import { deriveDisplayPrice, formatMoney, type PriceSource } from './derive-price'
import { typeDef, typeLabel } from './property-types'
import { prettyAttr } from './unit-attributes'

export type ProposalProfile = 'investment' | 'residential'

/** Which document a property gets. International stock is sold on returns. */
export function profileFor(country?: string | null): ProposalProfile {
  return (country ?? 'LEBANON') === 'LEBANON' ? 'residential' : 'investment'
}

const MOHAFAZAT_LABELS: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}

const COUNTRY_LABELS: Record<string, string> = {
  LEBANON: 'Lebanon', GEORGIA: 'Georgia', CYPRUS: 'Cyprus', GREECE: 'Greece',
}

/** Amenities, in the order a brochure would list them. */
const AMENITIES: Array<[string, string]> = [
  ['hasPool', 'Swimming pool'],
  ['hasGym', 'Gym'],
  ['hasConcierge', 'Concierge'],
  ['hasSecurity', '24/7 security'],
  ['hasElevator', 'Elevator'],
  ['hasGarden', 'Garden'],
  ['hasRooftop', 'Rooftop terrace'],
  ['hasCentralAC', 'Central air conditioning'],
  ['hasGenerator', 'Backup generator'],
  ['hasSolarPower', 'Solar power'],
]

const RENT_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: 'per month', QUARTERLY: 'per quarter', YEARLY: 'per year',
}

const STATUS_LABELS: Record<string, string> = {
  OFF_PLAN: 'Off-plan', NEW_BUILD: 'New build', RESALE: 'Resale',
}

export interface ProposalFact { label: string; value: string }

export interface ProposalUnitOption {
  name: string
  pricePerSqm: number | null
  total: number | null
  currency: string
  downPayment: number | null
  description: string | null
}

export interface ProposalUnit {
  id: string
  ref: string | null
  label: string
  kind: string
  kindLabel: string
  bedrooms: number | null
  bathrooms: number | null
  areaSqm: number | null
  floor: number | null
  parkingSpaces: number | null
  furnishing: string | null
  ownership: string | null
  views: string[]
  features: string[]
  lifecycle: string | null
  /** The asking figure for this unit, however it is expressed. */
  price: { amount: number; currency: string; note: string | null } | null
  options: ProposalUnitOption[]
  images: string[]
}

export interface ProposalInvestment {
  expectedROI: number | null
  rentalYield: number | null
  capitalGrowth: number | null
  annualAppreciation: number | null
  minInvestment: number | null
  downPaymentPercentage: number | null
  installmentYears: number | null
  averageRentPerMonth: number | null
  serviceFee: number | null
  propertyTax: number | null
  mortgageAvailable: boolean
  isGoldenVisaEligible: boolean
  goldenVisaMinAmount: number | null
  completionDate: string | null
  handoverDate: string | null
  /** Anything at all to show? */
  hasAny: boolean
}

export interface ProposalPaymentPlan {
  name: string
  kind: string
  downPaymentPct: number | null
  months: number | null
  description: string | null
}

export interface ProposalDocumentFile {
  id: string
  title: string
  type: string
  fileUrl: string
}

export interface Proposal {
  profile: ProposalProfile
  /** Title of the document itself, e.g. "Investment Proposal". */
  documentTitle: string
  reference: string | null
  title: string
  subtitle: string | null
  location: string
  country: string
  countryLabel: string
  buildStatus: string | null
  /** The headline figure, derived the same way the public site derives it. */
  price: { amount: number; currency: string; formatted: string; source: PriceSource; prefix: string } | null
  coverImage: string | null
  gallery: string[]
  description: string | null
  highlights: string[]
  facts: ProposalFact[]
  amenities: string[]
  units: ProposalUnit[]
  investment: ProposalInvestment
  paymentPlans: ProposalPaymentPlan[]
  documents: ProposalDocumentFile[]
  mapUrl: string | null
  virtualTourUrl: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null
  // Prisma Decimal arrives as a string over JSON.
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

const isoDate = (v: unknown): string | null =>
  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null

export function formatProposalDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/**
 * Build the document model.
 *
 * `unitId` narrows it to one unit — what a share link scoped to a unit does,
 * and what you want when a client is looking at one specific apartment rather
 * than the whole project.
 */
export function buildProposal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  building: any,
  opts: { unitId?: string | null } = {},
): Proposal {
  const country = building?.country ?? 'LEBANON'
  const profile = profileFor(country)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allUnits: any[] = Array.isArray(building?.units) ? building.units : []
  const scopedUnits = opts.unitId ? allUnits.filter((u) => u.id === opts.unitId) : allUnits

  const units: ProposalUnit[] = scopedUnits.map((u) => {
    const def = typeDef(u.kind)
    const areaSqm = num(u.areaSqm)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: ProposalUnitOption[] = (u.options ?? []).map((o: any) => {
      const perSqm = num(o.pricePerSqm)
      return {
        name: o.name ?? 'Standard',
        pricePerSqm: perSqm,
        // The total is what a buyer actually pays; the rate is how it's quoted.
        total: perSqm != null && areaSqm != null ? Math.round(perSqm * areaSqm) : null,
        currency: o.currency ?? 'USD',
        downPayment: num(o.initialPayment),
        description: o.description ?? null,
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const live = (u.listings ?? []).find((l: any) => ['ACTIVE', 'UNDER_OFFER'].includes(l.status))
    const askingPrice = num(u.askingPrice)
    const price = live
      ? {
          amount: num(live.price) ?? 0,
          currency: live.currency ?? 'USD',
          note: live.intent === 'FOR_RENT'
            ? (RENT_PERIOD_LABELS[live.rentPeriod ?? 'MONTHLY'] ?? 'per month')
            : (live.negotiable ? 'negotiable' : null),
        }
      : askingPrice != null
        ? { amount: askingPrice, currency: u.askingCurrency ?? 'USD', note: null }
        : options.length > 0 && options[0].total != null
          ? { amount: options[0].total, currency: options[0].currency, note: `from the ${options[0].name} finish` }
          : null

    return {
      id: u.id,
      ref: u.ref ?? null,
      label: u.name || (u.unitNumber ? `Unit ${u.unitNumber}` : typeLabel(u.kind)),
      kind: u.kind,
      kindLabel: typeLabel(u.kind),
      bedrooms: def.beds ? num(u.bedrooms) : null,
      bathrooms: def.baths ? num(u.bathrooms) : null,
      areaSqm,
      floor: def.floor ? num(u.floor) : null,
      parkingSpaces: num(u.parkingSpaces),
      furnishing: u.furnishing ? prettyAttr(u.furnishing) : null,
      ownership: u.ownership ? prettyAttr(u.ownership) : null,
      views: (u.views ?? []).map(prettyAttr),
      features: (u.features ?? []).map(prettyAttr),
      lifecycle: u.lifecycle ?? null,
      price,
      options,
      images: u.images ?? [],
    }
  })

  // The headline price is derived exactly as the public site derives it, so a
  // proposal can never quote a figure the website doesn't show.
  const derived = deriveDisplayPrice(scopedUnits, building?.listings ?? [])
  const price = derived.source === 'none'
    ? null
    : {
        amount: derived.price,
        currency: derived.currency,
        formatted: formatMoney(derived.price, derived.currency),
        source: derived.source,
        // "From" only when there is genuinely more than one thing to choose between.
        prefix: units.length > 1 || (units[0]?.options.length ?? 0) > 1 ? 'From' : '',
      }

  const inv = building?.investmentData ?? {}
  const investment: ProposalInvestment = {
    expectedROI: num(inv.expectedROI),
    rentalYield: num(inv.rentalYield),
    capitalGrowth: num(inv.capitalGrowth),
    annualAppreciation: num(inv.annualAppreciation),
    minInvestment: num(inv.minInvestment),
    downPaymentPercentage: num(inv.downPaymentPercentage),
    installmentYears: num(inv.installmentYears),
    averageRentPerMonth: num(inv.averageRentPerMonth),
    serviceFee: num(inv.serviceFee),
    propertyTax: num(inv.propertyTax),
    mortgageAvailable: !!inv.mortgageAvailable,
    isGoldenVisaEligible: !!inv.isGoldenVisaEligible,
    goldenVisaMinAmount: num(inv.goldenVisaMinAmount),
    completionDate: isoDate(inv.completionDate),
    handoverDate: isoDate(inv.handoverDate),
    hasAny: false,
  }
  investment.hasAny = [
    investment.expectedROI, investment.rentalYield, investment.capitalGrowth,
    investment.annualAppreciation, investment.minInvestment, investment.averageRentPerMonth,
    investment.downPaymentPercentage, investment.installmentYears,
    investment.serviceFee, investment.propertyTax,
    investment.completionDate, investment.handoverDate,
  ].some((v) => v !== null) || investment.isGoldenVisaEligible || investment.mortgageAvailable

  const locationParts = [
    building?.neighborhood,
    building?.city,
    building?.caza,
    building?.mohafazat ? (MOHAFAZAT_LABELS[building.mohafazat] ?? building.mohafazat) : null,
  ].filter(Boolean)
  const countryLabel = COUNTRY_LABELS[country] ?? prettyAttr(String(country))
  const location = locationParts.length
    ? `${locationParts.join(', ')}, ${countryLabel}`
    : countryLabel

  // One unit means the proposal *is* that unit — its specs belong on the cover.
  const sole = units.length === 1 ? units[0] : null
  const facts: ProposalFact[] = []
  if (sole) {
    facts.push({ label: 'Type', value: sole.kindLabel })
    if (sole.bedrooms != null) facts.push({ label: 'Bedrooms', value: String(sole.bedrooms) })
    if (sole.bathrooms != null) facts.push({ label: 'Bathrooms', value: String(sole.bathrooms) })
    if (sole.areaSqm != null) facts.push({ label: typeDef(sole.kind).areaLabel.replace(' (m²)', ''), value: `${sole.areaSqm} m²` })
    if (sole.floor != null) facts.push({ label: 'Floor', value: sole.floor === 0 ? 'Ground' : String(sole.floor) })
    if (sole.parkingSpaces) facts.push({ label: 'Parking', value: `${sole.parkingSpaces} space${sole.parkingSpaces === 1 ? '' : 's'}` })
    if (sole.furnishing) facts.push({ label: 'Furnishing', value: sole.furnishing })
    if (sole.ownership) facts.push({ label: 'Ownership', value: sole.ownership })
    if (sole.views.length) facts.push({ label: 'View', value: sole.views.join(' / ') })
  } else {
    facts.push({ label: 'Units', value: String(units.length) })
    const kinds = Array.from(new Set(units.map((u) => u.kindLabel)))
    if (kinds.length) facts.push({ label: 'Type', value: kinds.join(', ') })
    const areas = units.map((u) => u.areaSqm).filter((a): a is number => a != null)
    if (areas.length) {
      const lo = Math.min(...areas)
      const hi = Math.max(...areas)
      facts.push({ label: 'Sizes', value: lo === hi ? `${lo} m²` : `${lo}–${hi} m²` })
    }
    const beds = units.map((u) => u.bedrooms).filter((b): b is number => b != null)
    if (beds.length) {
      const lo = Math.min(...beds)
      const hi = Math.max(...beds)
      facts.push({ label: 'Bedrooms', value: lo === hi ? String(lo) : `${lo}–${hi}` })
    }
  }
  if (building?.builtYear) facts.push({ label: 'Built', value: String(building.builtYear) })
  if (building?.totalFloors) facts.push({ label: 'Floors', value: String(building.totalFloors) })
  if (building?.status) facts.push({ label: 'Status', value: STATUS_LABELS[building.status] ?? prettyAttr(building.status) })

  const gallery: string[] = [
    ...(building?.images ?? []),
    // A unit's own photos only when the proposal is about that unit.
    ...(sole ? sole.images : []),
  ].filter(Boolean)

  return {
    profile,
    documentTitle: profile === 'investment' ? 'Investment Proposal' : 'Property Proposal',
    reference: sole?.ref ?? building?.ref ?? null,
    title: sole && units.length === 1 && building?.units?.length > 1
      ? `${sole.label} — ${building?.title ?? ''}`.trim()
      : (building?.title ?? 'Property'),
    subtitle: building?.shortDescription ?? null,
    location,
    country,
    countryLabel,
    buildStatus: building?.status ? (STATUS_LABELS[building.status] ?? null) : null,
    price,
    coverImage: gallery[0] ?? null,
    // The cover uses the first; the gallery shows the next few. Six is what
    // fits a page without the document becoming a photo album.
    gallery: gallery.slice(1, 7),
    description: building?.description ?? building?.shortDescription ?? null,
    highlights: (building?.highlightedFeatures ?? []).filter(Boolean),
    facts,
    amenities: AMENITIES.filter(([key]) => building?.[key]).map(([, label]) => label),
    units,
    investment,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentPlans: (building?.paymentPlans ?? []).map((p: any) => ({
      name: p.name ?? 'Plan',
      kind: p.kind ?? 'CUSTOM',
      downPaymentPct: num(p.downPaymentPct),
      months: num(p.months),
      description: p.description ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documents: (building?.documents ?? []).map((d: any) => ({
      id: d.id,
      title: d.title ?? 'Document',
      type: prettyAttr(d.type ?? 'OTHER'),
      fileUrl: d.fileUrl,
    })),
    mapUrl: building?.locationUrl ?? null,
    virtualTourUrl: building?.virtualTourUrl ?? null,
  }
}

/**
 * The instalment maths, spelled out.
 *
 * An off-plan buyer's real question is "what do I pay now and what do I pay a
 * month", and nobody wants to work that out from a percentage and a year count
 * while sitting in a meeting.
 */
export function instalmentSchedule(
  total: number,
  downPct: number | null,
  years: number | null,
): { down: number; downPct: number; balance: number; months: number; monthly: number } | null {
  if (!total || total <= 0) return null
  const pct = downPct ?? 0
  const months = years != null ? Math.round(years * 12) : 0
  if (pct <= 0 && months <= 0) return null
  const down = Math.round((total * pct) / 100)
  const balance = Math.max(total - down, 0)
  return {
    down,
    downPct: pct,
    balance,
    months,
    monthly: months > 0 ? Math.round(balance / months) : 0,
  }
}

export { formatMoney }
