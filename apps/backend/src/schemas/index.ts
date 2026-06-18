import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  investmentGoals: z.array(z.enum(['HIGH_ROI', 'CAPITAL_GROWTH', 'PASSIVE_INCOME', 'LIFESTYLE'])).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  investmentGoals: z.array(z.enum(['HIGH_ROI', 'CAPITAL_GROWTH', 'PASSIVE_INCOME', 'LIFESTYLE'])).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ─── Building ─────────────────────────────────────────────────────────────────

const buildingInvestmentFields = {
  expectedROI: z.number().nullish(),
  rentalYield: z.number().nullish(),
  capitalGrowth: z.number().nullish(),
  annualAppreciation: z.number().nullish(),
  minInvestment: z.number().nullish(),
  maxInvestment: z.number().nullish(),
  downPaymentPercentage: z.number().nullish(),
  paymentPlan: z.string().nullish(),
  paymentPlanDetails: z.any().nullish(),
  installmentYears: z.number().nullish(),
  completionDate: z.string().nullish(),
  handoverDate: z.string().nullish(),
  expectedRentalStart: z.string().nullish(),
  averageRentPerMonth: z.number().nullish(),
  mortgageAvailable: z.boolean().nullish(),
  serviceFee: z.number().nullish(),
  propertyTax: z.number().nullish(),
};

export const INVESTMENT_FIELD_KEYS = Object.keys(buildingInvestmentFields) as (keyof typeof buildingInvestmentFields)[];

export const buildingSchema = z.object({
  kind: z.enum(['STANDALONE', 'PROJECT', 'COMMUNITY', 'MIXED_USE']).default('STANDALONE'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),

  mohafazat: z.string().optional().nullable(),
  caza: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationUrl: z.string().optional().nullable(),

  builtYear: z.number().optional().nullable(),
  totalFloors: z.number().optional().nullable(),
  parkingSpaces: z.number().optional().nullable(),
  hasConcierge: z.boolean().optional(),
  hasGenerator: z.boolean().optional(),
  hasSolarPower: z.boolean().optional(),
  hasElevator: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasSecurity: z.boolean().optional(),
  hasRooftop: z.boolean().optional(),

  status: z.enum(['OFF_PLAN', 'NEW_BUILD', 'RESALE']).default('RESALE'),
  visibility: z.enum(['PUBLIC', 'ELITE_ONLY', 'HIDDEN']).default('PUBLIC'),
  featured: z.boolean().optional(),
  featuredUntil: z.string().optional().nullable(),

  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional().nullable(),
  youtubeUrls: z.array(z.string()).optional(),
  virtualTourUrl: z.string().optional().nullable(),

  slug: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  highlightedFeatures: z.array(z.string()).optional(),

  developerId: z.string().optional().nullable(),
  locationGuideId: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),

  ...buildingInvestmentFields,
});

export const buildingQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 12),
  kind: z.string().optional(),
  mohafazat: z.string().optional(),
  caza: z.string().optional(),
  city: z.string().optional(),
  status: z.string().optional(),
  featured: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ─── Unit ─────────────────────────────────────────────────────────────────────

export const unitSchema = z.object({
  name: z.string().optional().nullable(),
  unitNumber: z.string().optional().nullable(),
  kind: z.enum(['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL', 'STORAGE', 'PARKING']).default('APARTMENT'),
  bedrooms: z.number().optional().nullable(),
  bathrooms: z.number().optional().nullable(),
  areaSqm: z.number().optional().nullable(),
  floor: z.number().optional().nullable(),
  parkingSpaces: z.number().optional().nullable(),
  furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).optional().nullable(),
  ownership: z.enum(['FREEHOLD', 'LEASEHOLD']).optional().nullable(),
  views: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  lifecycle: z.enum(['DRAFT', 'FOR_SALE', 'RESERVED', 'SOLD', 'OWNER_OCCUPIED', 'FOR_RENT', 'RENTED', 'VACANT', 'OFF_MARKET']).optional(),
  ownershipSource: z.enum(['PLATFORM_SOLD', 'EXTERNAL']).optional(),
  ownerName: z.string().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  managedByUserId: z.string().optional().nullable(),
  managementNote: z.string().optional().nullable(),
  askingPrice: z.number().optional().nullable(),
  askingCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  rentAmount: z.number().optional().nullable(),
  rentCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional().nullable(),
  generatorAmpere: z.number().optional().nullable(),
  images: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
});

export const unitOptionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  pricePerSqm: z.number().min(0),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  initialPayment: z.number().optional().nullable(),
  paymentPlanDetails: z.any().optional().nullable(),
  description: z.string().optional().nullable(),
});

// ─── Listing ──────────────────────────────────────────────────────────────────

export const listingSchema = z.object({
  subjectType: z.enum(['BUILDING', 'UNIT']),
  buildingId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  intent: z.enum(['FOR_SALE', 'FOR_RENT']),
  status: z.enum(['DRAFT', 'ACTIVE', 'UNDER_OFFER', 'CLOSED', 'ARCHIVED']).default('DRAFT'),
  visibility: z.enum(['PUBLIC', 'ELITE_ONLY', 'HIDDEN']).default('PUBLIC'),
  price: z.number().min(0),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional().nullable(),
  negotiable: z.boolean().optional(),
  slug: z.string().optional(),
  headline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  highlights: z.array(z.string()).optional(),
});

export const listingQuerySchema = z.object({
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 12),
  intent: z.string().optional(),
  subjectType: z.string().optional(),
  mohafazat: z.string().optional(),
  caza: z.string().optional(),
  city: z.string().optional(),
  kind: z.string().optional(),
  minPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  maxPrice: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  currency: z.string().optional(),
  minBeds: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  maxBeds: z.string().optional().transform(v => v ? parseInt(v) : undefined),
  minArea: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  maxArea: z.string().optional().transform(v => v ? parseFloat(v) : undefined),
  status: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ─── Tenancy ──────────────────────────────────────────────────────────────────

export const tenancySchema = z.object({
  unitId: z.string().min(1),
  tenantName: z.string().min(1),
  tenantPhone: z.string().optional().nullable(),
  tenantEmail: z.string().email().optional().nullable(),
  tenantWhatsapp: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  rentAmount: z.number().min(0),
  rentCurrency: z.enum(['USD', 'LBP']).default('USD'),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  depositAmount: z.number().optional().nullable(),
  depositCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  contractFileKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const rentPaymentSchema = z.object({
  dueDate: z.string().min(1),
  paidDate: z.string().optional().nullable(),
  amount: z.number().min(0),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'OMT', 'WHISH', 'FRESH_USD', 'LOLLAR', 'OTHER']).optional().nullable(),
  status: z.enum(['DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED']).default('DUE'),
  receiptFileKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── Maintenance Ticket ───────────────────────────────────────────────────────

export const ticketSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  scope: z.enum(['UNIT', 'BUILDING_COMMON']).default('UNIT'),
  category: z.enum(['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'CLEANING', 'PEST', 'KEYS_LOCKS', 'INTERNET', 'GENERATOR', 'ELEVATOR', 'WATER_TANK', 'OTHER']).default('OTHER'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).default('NORMAL'),
  title: z.string().min(1),
  description: z.string().min(1),
  reporterName: z.string().optional().nullable(),
  reporterPhone: z.string().optional().nullable(),
  reporterWhatsapp: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  costEstimate: z.number().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
});

export const ticketUpdateSchema = z.object({
  body: z.string().min(1),
  statusTo: z.enum(['OPEN', 'TRIAGED', 'SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']).optional(),
});

// ─── Vendor ───────────────────────────────────────────────────────────────────

export const vendorSchema = z.object({
  name: z.string().min(1),
  trades: z.array(z.string()).default([]),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
});

// ─── Utility ──────────────────────────────────────────────────────────────────

export const meterSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().optional().nullable(),
  kind: z.enum(['ELECTRICITY_EDL', 'ELECTRICITY_GENERATOR', 'WATER', 'INTERNET', 'GAS', 'OTHER']),
  identifier: z.string().optional().nullable(),
  unitOfMeasure: z.string().default('kWh'),
  notes: z.string().optional().nullable(),
});

export const meterReadingSchema = z.object({
  readingAt: z.string().min(1),
  value: z.number(),
  photoKey: z.string().optional().nullable(),
});

export const utilityBillSchema = z.object({
  buildingId: z.string().min(1),
  kind: z.enum(['ELECTRICITY_EDL', 'ELECTRICITY_GENERATOR', 'WATER', 'INTERNET', 'GAS', 'OTHER']),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  totalAmount: z.number().min(0),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  totalConsumed: z.number().optional().nullable(),
  invoiceFileKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const billAllocationSchema = z.object({
  method: z.enum(['METERED', 'AREA_PROPORTIONAL', 'FIXED_SHARE', 'OCCUPANT_COUNT']),
  unitShares: z.array(z.object({ unitId: z.string(), share: z.number() })).optional(),
});

// ─── Service Charge ───────────────────────────────────────────────────────────

export const serviceChargeSchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().min(0),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  cadence: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  splitMethod: z.enum(['METERED', 'AREA_PROPORTIONAL', 'FIXED_SHARE', 'OCCUPANT_COUNT']).default('AREA_PROPORTIONAL'),
});

// ─── FX Rate ──────────────────────────────────────────────────────────────────

export const fxRateSchema = z.object({
  date: z.string().min(1),
  usdToLbp: z.number().min(0),
  source: z.string().optional().nullable(),
});

// ─── Shared ───────────────────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(['USER', 'AGENT', 'PROPERTY_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
});

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required'),
});

export const inviteAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['AGENT', 'PROPERTY_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
});

export const inquirySchema = z.object({
  buildingId: z.string().optional().nullable(),
  listingId: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  message: z.string().optional(),
});

export const ownedPropertySchema = z.object({
  customName: z.string().min(1, 'Property name is required'),
  purchasePrice: z.number().min(0, 'Purchase price must be positive'),
  purchaseCurrency: z.enum(['USD', 'LBP']).default('USD'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  initialMortgage: z.number().optional().nullable(),
  currentRent: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  buildingId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
});

export const aiSearchSchema = z.object({
  query: z.string().min(1).max(500),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  previousFilters: z.record(z.unknown()).optional(),
  previousPropertyIds: z.array(z.string()).optional(),
  context: z.object({
    userId: z.string().optional(),
    previousSearches: z.array(z.string()).optional(),
  }).optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractInvestmentData(
  data: Record<string, unknown>
): { investmentData: Record<string, unknown>; buildingData: Record<string, unknown> } {
  const investmentData: Record<string, unknown> = {};
  const buildingData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (INVESTMENT_FIELD_KEYS.includes(key as keyof typeof buildingInvestmentFields)) {
      investmentData[key] = value;
    } else {
      buildingData[key] = value;
    }
  }

  return { investmentData, buildingData };
}

export function buildInvestmentDataPayload(fields: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const dateFields = ['completionDate', 'handoverDate', 'expectedRentalStart'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    result[key] = dateFields.includes(key) ? (value ? new Date(value as string) : null) : (value ?? null);
  }
  return result;
}
