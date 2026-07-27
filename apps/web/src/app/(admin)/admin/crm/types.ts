export type LeadMarket = 'LEBANON' | 'GEORGIA'
export type LeadType = 'BUYER' | 'SELLER' | 'RENTER' | 'LANDLORD' | 'INVESTOR'
export type LeadStatus = 'NEW' | 'ACTIVE' | 'VIEWING' | 'NEGOTIATING' | 'WON' | 'LOST' | 'ARCHIVED'
export type LeadSource = 'MANUAL' | 'INQUIRY' | 'FAVORITE' | 'SUBMISSION' | 'REFERRAL' | 'WHATSAPP' | 'PHONE' | 'WALK_IN'
export type ContactChannel = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'MEETING' | 'VIEWING' | 'NOTE'

export interface LeadContact {
  id: string
  channel: ContactChannel
  body: string
  outcome: string | null
  contactedAt: string
}

export type OpportunityStage =
  | 'SUGGESTED' | 'SHARED' | 'VIEWING_BOOKED' | 'VIEWED'
  | 'INTERESTED' | 'OFFER_MADE' | 'WON' | 'REJECTED'

export type RejectionReason =
  | 'PRICE_TOO_HIGH' | 'TOO_SMALL' | 'TOO_BIG' | 'LOCATION' | 'CONDITION' | 'LAYOUT'
  | 'FLOOR_LEVEL' | 'NO_PARKING' | 'NOISE' | 'NO_VIEW' | 'NO_ELEVATOR'
  | 'BUILDING_QUALITY' | 'CHANGED_MIND' | 'BOUGHT_ELSEWHERE' | 'UNAVAILABLE' | 'OTHER'

export interface Opportunity {
  id: string
  leadId: string
  stage: OpportunityStage
  listingId: string | null
  counterpartLeadId: string | null
  matchScore: number | null
  viewingAt: string | null
  viewedAt: string | null
  rejectionReason: RejectionReason | null
  feedback: string | null
  updatedAt: string
  /** Resolved by the API so ruled-out items still show their real name. */
  subject?: {
    kind: 'LISTING' | 'CLIENT' | 'UNKNOWN'
    title: string
    subtitle: string | null
    slug?: string | null
    id?: string
  }
}

export const OPPORTUNITY_META: Record<OpportunityStage, { label: string; cls: string; dot: string }> = {
  SUGGESTED:      { label: 'Shortlisted',   cls: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  SHARED:         { label: 'Sent to client',cls: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500' },
  VIEWING_BOOKED: { label: 'Viewing booked',cls: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  VIEWED:         { label: 'Viewed',        cls: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-500' },
  INTERESTED:     { label: 'Interested',    cls: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
  OFFER_MADE:     { label: 'Offer made',    cls: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  WON:            { label: 'Closed',        cls: 'bg-green-600 text-white',       dot: 'bg-green-600' },
  REJECTED:       { label: 'Ruled out',     cls: 'bg-red-50 text-red-600',        dot: 'bg-red-400' },
}

export const REJECTION_LABELS: Record<RejectionReason, string> = {
  PRICE_TOO_HIGH: 'Too expensive',
  TOO_SMALL: 'Too small',
  TOO_BIG: 'Too big',
  LOCATION: 'Wrong location',
  CONDITION: 'Poor condition',
  LAYOUT: 'Layout',
  FLOOR_LEVEL: 'Floor level',
  NO_PARKING: 'No parking',
  NOISE: 'Too noisy',
  NO_VIEW: 'No view',
  NO_ELEVATOR: 'No elevator',
  BUILDING_QUALITY: 'Building quality',
  CHANGED_MIND: 'Changed their mind',
  BOUGHT_ELSEWHERE: 'Bought elsewhere',
  UNAVAILABLE: 'No longer available',
  OTHER: 'Other',
}

/** Stages where the deal is still in play. */
export const LIVE_STAGES: OpportunityStage[] = ['SHARED', 'VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE']

export interface Lead {
  id: string
  market: LeadMarket
  type: LeadType
  status: LeadStatus
  source: LeadSource
  name: string
  phone: string | null
  email: string | null
  whatsapp: string | null
  askingFor: string | null
  unitKinds: string[]
  areas: string[]
  regions: string[]
  minBeds: number | null
  budgetMin: number | null
  budgetMax: number | null
  currency: 'USD' | 'LBP'
  lastContactAt: string | null
  contactIntervalDays: number
  nextContactAt: string | null
  notes: string | null
  createdAt: string
  contacts?: LeadContact[]
  opportunities?: Opportunity[]
  insights?: Array<{ reason: string; count: number; advice: string }>
  needsNewOptions?: boolean
  _count?: { contacts: number }
}

/** Client is waiting on us for fresh options: everything shown is ruled out. */
export function isWaitingOnUs(lead: Lead): boolean {
  if (lead.needsNewOptions !== undefined) return lead.needsNewOptions
  const ops = lead.opportunities ?? []
  if (['NEW', 'WON', 'LOST', 'ARCHIVED'].includes(lead.status) || ops.length === 0) return false
  return !ops.some((o) => LIVE_STAGES.includes(o.stage)) && ops.some((o) => o.stage === 'REJECTED')
}

/** A viewing happened but no feedback was recorded. */
export function hasAwaitingFeedback(lead: Lead): boolean {
  return (lead.opportunities ?? []).some((o) => o.stage === 'VIEWED')
}

/** The soonest booked viewing, if any. */
export function nextViewing(lead: Lead): string | null {
  const booked = (lead.opportunities ?? [])
    .filter((o) => o.stage === 'VIEWING_BOOKED' && o.viewingAt)
    .map((o) => o.viewingAt as string)
    .sort()
  return booked[0] ?? null
}

/** Board columns, in pipeline order. WON/LOST/ARCHIVED live off-board. */
export const BOARD_STAGES: LeadStatus[] = ['NEW', 'ACTIVE', 'VIEWING', 'NEGOTIATING', 'WON']

export const STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  NEW:         { label: 'New',         cls: 'bg-sky-100 text-sky-700' },
  ACTIVE:      { label: 'Active',      cls: 'bg-emerald-100 text-emerald-700' },
  VIEWING:     { label: 'Viewing',     cls: 'bg-violet-100 text-violet-700' },
  NEGOTIATING: { label: 'Negotiating', cls: 'bg-amber-100 text-amber-800' },
  WON:         { label: 'Won',         cls: 'bg-green-600 text-white' },
  LOST:        { label: 'Lost',        cls: 'bg-red-100 text-red-600' },
  ARCHIVED:    { label: 'Archived',    cls: 'bg-slate-100 text-slate-500' },
}

export const TYPE_LABELS: Record<LeadType, string> = {
  BUYER: 'Buyer', SELLER: 'Seller', RENTER: 'Renter', LANDLORD: 'Landlord', INVESTOR: 'Investor',
}

/** Clients who HAVE a property to offer (supply side). */
export const SUPPLY_TYPES: LeadType[] = ['SELLER', 'LANDLORD']
/** Clients who are LOOKING for a property (demand side). */
export const DEMAND_TYPES: LeadType[] = ['BUYER', 'RENTER', 'INVESTOR']

export const isSupplyType = (t: LeadType) => SUPPLY_TYPES.includes(t)

/**
 * Colour identity per client type so a glance at the board tells you which side
 * of the deal someone is on. Demand = blue/violet family, supply = amber/orange.
 */
export const TYPE_META: Record<LeadType, {
  solid: string   // selected state (form buttons)
  chip: string    // small badge
  accent: string  // card left border
  bar: string     // card top strip
}> = {
  BUYER:    { solid: 'bg-sky-600 text-white',     chip: 'bg-sky-100 text-sky-800',         accent: 'border-l-sky-500',     bar: 'bg-sky-500' },
  RENTER:   { solid: 'bg-cyan-600 text-white',    chip: 'bg-cyan-100 text-cyan-800',       accent: 'border-l-cyan-500',    bar: 'bg-cyan-500' },
  INVESTOR: { solid: 'bg-indigo-600 text-white',  chip: 'bg-indigo-100 text-indigo-800',   accent: 'border-l-indigo-500',  bar: 'bg-indigo-500' },
  SELLER:   { solid: 'bg-amber-600 text-white',   chip: 'bg-amber-100 text-amber-900',     accent: 'border-l-amber-500',   bar: 'bg-amber-500' },
  LANDLORD: { solid: 'bg-orange-600 text-white',  chip: 'bg-orange-100 text-orange-900',   accent: 'border-l-orange-500',  bar: 'bg-orange-500' },
}

export const MARKET_META: Record<LeadMarket, { label: string; cls: string }> = {
  LEBANON: { label: '🇱🇧 Lebanon', cls: 'bg-slate-100 text-slate-700' },
  GEORGIA: { label: '🇬🇪 Georgia', cls: 'bg-teal-100 text-teal-800' },
}

export const UNIT_KINDS = [
  'APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE',
  'SHOP', 'OFFICE', 'LAND_PARCEL',
] as const

export const UNIT_KIND_LABELS: Record<string, string> = {
  APARTMENT: 'Apartment', STUDIO: 'Studio', DUPLEX: 'Duplex', PENTHOUSE: 'Penthouse',
  VILLA: 'Villa', TOWNHOUSE: 'Townhouse', SHOP: 'Shop', OFFICE: 'Office',
  LAND_PARCEL: 'Land', STORAGE: 'Storage', PARKING: 'Parking',
}

/** Days until the next follow-up. Negative = overdue. Null when unscheduled. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

export function formatDue(iso: string | null): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' | 'none' } {
  const d = daysUntil(iso)
  if (d === null) return { text: 'Not scheduled', tone: 'none' }
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, tone: 'overdue' }
  if (d === 0) return { text: 'Due today', tone: 'today' }
  if (d <= 3) return { text: `In ${d}d`, tone: 'soon' }
  return { text: new Date(iso as string).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), tone: 'later' }
}
