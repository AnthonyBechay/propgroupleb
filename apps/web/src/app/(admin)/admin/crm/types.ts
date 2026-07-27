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
  mohafazat: string | null
  caza: string | null
  city: string | null
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
  _count?: { contacts: number }
}

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
