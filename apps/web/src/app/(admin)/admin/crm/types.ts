import { ALL_PROPERTY_KINDS, typeLabel } from '@/lib/property-types'

export type LeadMarket = 'LEBANON' | 'GEORGIA'
export type LeadType = 'BUYER' | 'SELLER' | 'RENTER' | 'LANDLORD' | 'INVESTOR'
export type LeadStatus = 'NEW' | 'ACTIVE' | 'VIEWING' | 'NEGOTIATING' | 'WON' | 'LOST' | 'ARCHIVED'
export type LeadSource = 'MANUAL' | 'INQUIRY' | 'FAVORITE' | 'SUBMISSION' | 'REFERRAL' | 'WHATSAPP' | 'PHONE' | 'WALK_IN' | 'FACEBOOK_AD'

/** Why an open client is still open. Answers "he's Active — waiting on what?". */
export type LeadSubStatus =
  | 'SEARCHING' | 'AWAITING_REPLY' | 'NEEDS_OPTIONS' | 'BUDGET_MISMATCH'
  | 'FINANCING' | 'PAUSED' | 'DOCS_PENDING' | 'PRICE_REVIEW'
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
  | 'INTERESTED' | 'OFFER_MADE' | 'RESERVED' | 'WON' | 'REJECTED'

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
  leadPropertyId: string | null
  /** Off-platform property (a Batumi studio on propgrp.com, a private sale). */
  externalTitle: string | null
  externalUrl: string | null
  matchScore: number | null
  viewingAt: string | null
  viewedAt: string | null
  rejectionReason: RejectionReason | null
  feedback: string | null
  /** Which apartment it turned out to be — "Studio 1204, 12th floor". */
  soldUnitRef: string | null
  soldPrice: number | null
  soldCurrency: 'USD' | 'LBP'
  commissionUsd: number | null
  closedAt: string | null
  updatedAt: string
  /** Resolved by the API so ruled-out items still show their real name. */
  subject?: {
    kind: 'LISTING' | 'CLIENT' | 'SELLER_PROPERTY' | 'EXTERNAL' | 'UNKNOWN'
    title: string
    subtitle: string | null
    /** Reference code, present for LISTING subjects. */
    ref?: string | null
    slug?: string | null
    url?: string | null
    /** Asking price, so a deal can be valued before it closes. */
    price?: number | null
    currency?: 'USD' | 'LBP' | null
    country?: string | null
    id?: string | null
  }
}

export type LeadPropertyStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'WITHDRAWN'

/**
 * One thing a seller has on the market. A seller's own fields describe a single
 * asset, which stops working the moment he lists a second — and most do.
 */
export interface LeadProperty {
  id: string
  leadId: string
  kind: string
  title: string | null
  areas: string[]
  region: string | null
  askingPrice: number | null
  currency: 'USD' | 'LBP'
  bedrooms: number | null
  areaSqm: number | null
  status: LeadPropertyStatus
  listingId: string | null
  externalUrl: string | null
  notes: string | null
  soldPrice: number | null
  commissionUsd: number | null
  soldAt: string | null
}

export const PROPERTY_STATUS_META: Record<LeadPropertyStatus, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RESERVED:  { label: 'Reserved',  cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  SOLD:      { label: 'Sold',      cls: 'bg-slate-800 text-white border-slate-800' },
  WITHDRAWN: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

/**
 * Score above which a match is worth surfacing unprompted. Mirrors the server's
 * STRONG_MATCH_SCORE — the board badge and the drawer's strong/near split have
 * to agree or the badge promises matches the list doesn't show.
 */
export const STRONG_MATCH_SCORE = 70

/** The server caps the badge here; anything at the cap is shown as "9+". */
export const UNTAPPED_CAP = 9

export const OPPORTUNITY_META: Record<OpportunityStage, { label: string; cls: string; dot: string }> = {
  SUGGESTED:      { label: 'Enquiry',       cls: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  SHARED:         { label: 'Details sent',  cls: 'bg-sky-100 text-sky-700',       dot: 'bg-sky-500' },
  VIEWING_BOOKED: { label: 'Viewing booked',cls: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  VIEWED:         { label: 'Viewed',        cls: 'bg-amber-100 text-amber-800',   dot: 'bg-amber-500' },
  INTERESTED:     { label: 'Interested',    cls: 'bg-emerald-100 text-emerald-700',dot: 'bg-emerald-500' },
  OFFER_MADE:     { label: 'Offer made',    cls: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  RESERVED:       { label: 'Reserved / paying', cls: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
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
export const LIVE_STAGES: OpportunityStage[] = [
  'SHARED', 'VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'RESERVED',
]

export interface Lead {
  id: string
  market: LeadMarket
  type: LeadType
  status: LeadStatus
  subStatus: LeadSubStatus | null
  /** A buyer chasing yield rather than a home. */
  isInvestor?: boolean
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
  nextContactNote: string | null
  notes: string | null
  updatedAt?: string
  /** Set when the relationship reached WON/LOST. */
  closedAt?: string | null
  createdAt: string
  contacts?: LeadContact[]
  opportunities?: Opportunity[]
  properties?: LeadProperty[]
  /** Closed purchases, summarised by the list endpoint for the directory. */
  deals?: Array<{
    id: string
    ref: string | null
    title: string
    country: string | null
    unitRef: string | null
    soldPrice: number | null
    soldCurrency: 'USD' | 'LBP'
    commissionUsd: number | null
    closedAt: string | null
  }>
  /** A seller's own stock that has sold. */
  soldProperties?: Array<{
    id: string
    title: string | null
    kind: string
    soldPrice: number | null
    commissionUsd: number | null
    soldAt: string | null
  }>
  insights?: Array<{ reason: string; count: number; advice: string }>
  needsNewOptions?: boolean
  _count?: { contacts: number }

  /** Catalogue stock this client owns — the real Building link. */
  ownedBuildings?: Array<{
    id: string
    ref?: string | null
    title: string
    slug?: string | null
    country?: string | null
    city?: string | null
    caza?: string | null
    status?: string | null
    visibility?: string | null
    images?: string[]
  }>
}

/**
 * Client is waiting on us for fresh options: everything shown is ruled out.
 * The server owns this — it sets `subStatus` when it syncs the pipeline — so
 * trust that first and only fall back to recomputing for older payloads.
 */
export function isWaitingOnUs(lead: Lead): boolean {
  if (lead.subStatus === 'NEEDS_OPTIONS') return true
  if (lead.needsNewOptions !== undefined) return lead.needsNewOptions
  const ops = lead.opportunities ?? []
  if (['WON', 'LOST', 'ARCHIVED'].includes(lead.status) || ops.length === 0) return false
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

/** How far back the Won column looks, so closed deals don't pile up forever. */
export const WON_WINDOW_MONTHS = 6

/** True when a won deal is recent enough to still show on the board. */
export function isRecentWin(lead: Lead): boolean {
  if (lead.status !== 'WON') return true
  const closed = lead.closedAt ?? lead.createdAt
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - WON_WINDOW_MONTHS)
  return new Date(closed) >= cutoff
}

/**
 * Board columns.
 *
 * The two sides of the business need separate columns, not one "Active" pile:
 * a seller with a flat to move and a buyer looking for one are different work,
 * and mixing them is how a broker loses track of which side is short. Statuses
 * further down the pipeline (Viewing, Negotiating) are already about a specific
 * deal, so both sides share those.
 *
 * `NEW` is folded into the active columns — a client nobody has called yet is
 * simply an active client nobody has called yet, not a separate stage.
 */
export interface BoardColumn {
  key: string
  label: string
  hint: string
  accent: string
  /** Status written when a card is dropped here. */
  status: LeadStatus
  /** Which side of the deal this column holds; undefined = both. */
  side?: 'supply' | 'demand'
}

export const BOARD_COLUMNS: BoardColumn[] = [
  {
    key: 'ACTIVE_SUPPLY', label: 'Active Sellers', side: 'supply', status: 'ACTIVE',
    hint: 'Have a property to move', accent: 'bg-amber-500',
  },
  {
    key: 'ACTIVE_DEMAND', label: 'Active Buyers', side: 'demand', status: 'ACTIVE',
    hint: 'Looking for a property', accent: 'bg-sky-500',
  },
  { key: 'VIEWING', label: 'Viewing', status: 'VIEWING', hint: 'Viewing booked', accent: 'bg-violet-500' },
  { key: 'NEGOTIATING', label: 'Negotiating', status: 'NEGOTIATING', hint: 'Offer on the table', accent: 'bg-amber-600' },
  {
    key: 'WON', label: 'Bought / sold', status: 'WON',
    hint: `Closed in the last ${WON_WINDOW_MONTHS} months — then they move to Past clients`,
    accent: 'bg-slate-800',
  },
]

/** Which column a lead belongs in. */
export function columnOf(lead: Lead): string {
  // An untouched lead still needs working, so it sits with the active ones —
  // and so does a past client who's looking again.
  if (lead.status === 'ACTIVE' || lead.status === 'NEW') {
    return isSupplyType(lead.type) ? 'ACTIVE_SUPPLY' : 'ACTIVE_DEMAND'
  }
  return lead.status
}

/** True when this client may be dropped into this column. */
export function acceptsDrop(column: BoardColumn, lead: Lead): boolean {
  if (!column.side) return true
  return column.side === (isSupplyType(lead.type) ? 'supply' : 'demand')
}

/**
 * How a client reads on screen.
 *
 * The labels describe a *relationship*, not a deal. "Won" is what you say
 * about a transaction; about a person you say they're a client — someone who
 * bought or sold with you and is worth keeping in touch with. Viewing and
 * Negotiating describe where one specific deal has got to, which is why they
 * live on the deal and only surface on the board.
 */
export const STATUS_META: Record<LeadStatus, { label: string; cls: string }> = {
  NEW:         { label: 'Active',       cls: 'bg-emerald-100 text-emerald-700' },
  ACTIVE:      { label: 'Active',       cls: 'bg-emerald-100 text-emerald-700' },
  VIEWING:     { label: 'Viewing',      cls: 'bg-violet-100 text-violet-700' },
  NEGOTIATING: { label: 'Negotiating',  cls: 'bg-amber-100 text-amber-800' },
  WON:         { label: 'Past client',  cls: 'bg-slate-800 text-white' },
  LOST:        { label: 'Went elsewhere', cls: 'bg-red-50 text-red-600' },
  ARCHIVED:    { label: 'Parked',       cls: 'bg-slate-100 text-slate-500' },
}

/** Has this client bought or sold with us at some point? */
export function hasClosedBefore(lead: Lead): boolean {
  return lead.status === 'WON'
    || (lead.deals?.length ?? 0) > 0
    || (lead.soldProperties?.length ?? 0) > 0
}

/** Is something in motion for them right now? */
export function hasLiveDeal(lead: Lead): boolean {
  return (lead.opportunities ?? []).some((o) => LIVE_STAGES.includes(o.stage))
}

/**
 * A past client is someone who bought or sold and isn't looking right now.
 *
 * The moment you shortlist something new for them they belong back in
 * "working with" — filing a live deal under "past" is how it gets forgotten.
 */
export function isPastClient(lead: Lead): boolean {
  return hasClosedBefore(lead) && !hasLiveDeal(lead)
}

/** Bought before and looking again — worth flagging, they're the easy ones. */
export function isReturningClient(lead: Lead): boolean {
  return hasClosedBefore(lead) && hasLiveDeal(lead)
}

/**
 * The four things a client can be here to do. Anything else is detail about
 * them, not a category beside these — an investor is a buyer with a motive.
 */
export const TYPE_LABELS: Record<LeadType, string> = {
  BUYER: 'Buying',
  SELLER: 'Selling',
  RENTER: 'Looking to rent',
  LANDLORD: 'Renting out',
  // Legacy: existing rows were migrated to BUYER + isInvestor.
  INVESTOR: 'Buying',
}

/** The four intents offered in forms and filters. */
export const INTENT_TYPES: LeadType[] = ['BUYER', 'SELLER', 'RENTER', 'LANDLORD']

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

// Clients can be looking for anything we sell — including commercial — so this
// mirrors the shared property registry rather than keeping its own short list.
export const UNIT_KINDS = ALL_PROPERTY_KINDS
export const UNIT_KIND_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PROPERTY_KINDS.map((k) => [k, typeLabel(k)])
)

/** Whole days between a date and today. Negative = in the past. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

/**
 * How long since we last spoke to them. This replaced a countdown to an
 * invented due date: a cadence the team never agreed to made every card red,
 * so the colour stopped meaning anything. A plain fact — "last spoke 9 days
 * ago" — lets the broker judge for themselves.
 */
export function formatLastContact(iso: string | null): { text: string; stale: boolean } {
  const d = daysUntil(iso)
  if (d === null) return { text: 'Never contacted', stale: true }
  const ago = Math.abs(d)
  if (ago === 0) return { text: 'Spoke today', stale: false }
  if (ago === 1) return { text: 'Spoke yesterday', stale: false }
  if (ago < 7) return { text: `${ago}d ago`, stale: false }
  if (ago < 30) return { text: `${Math.floor(ago / 7)}w ago`, stale: ago >= 21 }
  return { text: `${Math.floor(ago / 30)}mo ago`, stale: true }
}

/** A follow-up the team actually planned, e.g. "call him Monday". */
export function formatPlanned(iso: string | null): { text: string; due: boolean } | null {
  const d = daysUntil(iso)
  if (d === null) return null
  if (d < 0) return { text: 'Follow-up due', due: true }
  if (d === 0) return { text: 'Follow-up today', due: true }
  if (d === 1) return { text: 'Follow-up tomorrow', due: false }
  if (d <= 6) return { text: new Date(iso as string).toLocaleDateString(undefined, { weekday: 'long' }), due: false }
  return { text: new Date(iso as string).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), due: false }
}

/**
 * Why an active client hasn't closed yet.
 *
 * Deliberately short. Eight options meant nobody set one; the four that
 * actually change what you do next are kept, and the rest belong in a note.
 */
export const SUB_STATUS_META: Record<LeadSubStatus, { label: string; cls: string; forSide?: 'supply' | 'demand' }> = {
  SEARCHING:       { label: 'Still looking',     cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  AWAITING_REPLY:  { label: 'Waiting on them',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  NEEDS_OPTIONS:   { label: 'Needs new options', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PAUSED:          { label: 'Paused',            cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  // Kept so existing rows still render, but no longer offered.
  BUDGET_MISMATCH: { label: 'Budget too low',    cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  FINANCING:       { label: 'Arranging finance', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  DOCS_PENDING:    { label: 'Waiting on papers', cls: 'bg-amber-50 text-amber-800 border-amber-200', forSide: 'supply' },
  PRICE_REVIEW:    { label: 'Price needs review',cls: 'bg-orange-50 text-orange-800 border-orange-200', forSide: 'supply' },
}

/**
 * Sub-statuses a person may pick. NEEDS_OPTIONS is missing on purpose — it
 * means "everything we showed him is ruled out", which only his shortlist can
 * establish, so the server sets and clears it.
 */
export const MANUAL_SUB_STATUSES: LeadSubStatus[] = ['SEARCHING', 'AWAITING_REPLY', 'PAUSED']

/** Sub-statuses worth offering for this client's side of the deal. */
export function subStatusesFor(type: LeadType): LeadSubStatus[] {
  const side = isSupplyType(type) ? 'supply' : 'demand'
  return MANUAL_SUB_STATUSES.filter((k) => {
    const only = SUB_STATUS_META[k].forSide
    return !only || only === side
  })
}

/**
 * When something last happened on this client — created, edited, contacted or
 * had their shortlist changed. The board sorts on this.
 */
export function lastActivityAt(lead: Lead): number {
  const stamps = [lead.updatedAt, lead.lastContactAt, lead.createdAt]
    .filter(Boolean)
    .map((d) => new Date(d as string).getTime())
  return stamps.length ? Math.max(...stamps) : 0
}

/* ── The deal pipeline ────────────────────────────────────────────────────────
 *
 * The board is a pipeline of DEALS, not of people. One client can be viewing an
 * apartment in Achrafieh and negotiating a studio in Batumi on the same day —
 * a board keyed on the client collapses that into one card in one column and
 * makes the CRM lie about where the business actually is.
 *
 * INTERESTED and OFFER_MADE are one column. The distinction matters on the deal
 * itself, but as columns they split the same conversation in two and left both
 * looking empty.
 */

export interface Deal extends Opportunity {
  lead: {
    id: string
    name: string
    type: LeadType
    isInvestor?: boolean
    market?: LeadMarket
    phone?: string | null
    whatsapp?: string | null
    email?: string | null
    status?: LeadStatus
    nextContactAt?: string | null
    lastContactAt?: string | null
  }
}

export interface DealColumn {
  key: string
  label: string
  /** The stage a card takes when dropped here. */
  stage: OpportunityStage
  /** Every stage this column displays. */
  stages: OpportunityStage[]
  hint: string
  accent: string
}

export const DEAL_COLUMNS: DealColumn[] = [
  {
    key: 'SUGGESTED', label: 'Enquiry', stage: 'SUGGESTED', stages: ['SUGGESTED'],
    hint: 'They asked about it, or we picked it for them', accent: 'bg-slate-400',
  },
  {
    key: 'SHARED', label: 'Details sent', stage: 'SHARED', stages: ['SHARED'],
    hint: 'Photos, price and plans are with them', accent: 'bg-sky-500',
  },
  {
    key: 'VIEWING_BOOKED', label: 'Viewing booked', stage: 'VIEWING_BOOKED', stages: ['VIEWING_BOOKED'],
    hint: 'A date is in the diary', accent: 'bg-violet-500',
  },
  {
    key: 'VIEWED', label: 'Viewed', stage: 'VIEWED', stages: ['VIEWED'],
    hint: 'Been to see it — waiting on a verdict', accent: 'bg-indigo-500',
  },
  {
    key: 'NEGOTIATING', label: 'Negotiating', stage: 'INTERESTED',
    stages: ['INTERESTED', 'OFFER_MADE'],
    hint: 'They want it — price is still moving', accent: 'bg-amber-500',
  },
  {
    key: 'RESERVED', label: 'Reserved / paying', stage: 'RESERVED', stages: ['RESERVED'],
    hint: 'Agreed. Working through the payments.', accent: 'bg-teal-500',
  },
  {
    key: 'WON', label: 'Closed', stage: 'WON', stages: ['WON'],
    hint: 'Paid in full. Record what we made.', accent: 'bg-emerald-600',
  },
]

/** Which column a deal sits in. */
export function dealColumnOf(deal: Deal): string {
  const col = DEAL_COLUMNS.find((c) => c.stages.includes(deal.stage))
  return col?.key ?? 'SUGGESTED'
}

/** How a stage reads on a card. */
export const STAGE_LABELS: Record<OpportunityStage, string> = {
  SUGGESTED: 'Enquiry',
  SHARED: 'Details sent',
  VIEWING_BOOKED: 'Viewing booked',
  VIEWED: 'Viewed',
  INTERESTED: 'Interested',
  OFFER_MADE: 'Offer made',
  RESERVED: 'Reserved / paying',
  WON: 'Closed',
  REJECTED: 'Ruled out',
}

/** A deal still in play. */
export function isLiveDeal(d: Deal | Opportunity): boolean {
  return d.stage !== 'WON' && d.stage !== 'REJECTED'
}

/**
 * What this deal is worth to us if it lands.
 *
 * Once closed, commission is the real figure. Before that we have the asking
 * price and a house rate — a forecast, clearly labelled as one, beats showing
 * nothing and beats asking the team to type a number they don't have yet.
 */
export const DEFAULT_COMMISSION_RATE = 0.025

export function dealCommission(d: Deal | Opportunity): { usd: number; forecast: boolean } | null {
  if (d.commissionUsd != null) return { usd: d.commissionUsd, forecast: false }
  const price = d.soldPrice ?? d.subject?.price ?? null
  if (price == null) return null
  // LBP asking prices aren't converted here — a wrong number is worse than none.
  const currency = d.soldPrice != null ? d.soldCurrency : d.subject?.currency
  if (currency && currency !== 'USD') return null
  return { usd: Math.round(price * DEFAULT_COMMISSION_RATE), forecast: true }
}

/** Something that needs doing on this deal, or null when it's simply waiting. */
export function dealAlert(d: Deal): { text: string; tone: 'red' | 'amber' } | null {
  const now = Date.now()
  if (d.stage === 'VIEWING_BOOKED') {
    if (!d.viewingAt) return { text: 'No date set', tone: 'red' }
    const at = new Date(d.viewingAt).getTime()
    if (at < now) return { text: 'Viewing passed — how did it go?', tone: 'red' }
    if (at - now < 36e5 * 24) return { text: 'Viewing today', tone: 'amber' }
  }
  if (d.stage === 'VIEWED' && !d.feedback) return { text: 'No feedback yet', tone: 'amber' }
  if (d.stage === 'RESERVED' && !d.soldPrice) return { text: 'Agreed price not recorded', tone: 'amber' }
  if (d.stage === 'WON' && d.commissionUsd == null) return { text: 'Commission not recorded', tone: 'amber' }
  // A deal nobody has touched in three weeks is quietly dying.
  const idle = (now - new Date(d.updatedAt).getTime()) / 864e5
  if (isLiveDeal(d) && idle > 21) return { text: `Untouched ${Math.round(idle)} days`, tone: 'amber' }
  return null
}
