import { z } from 'zod';

// ─── Auth Schemas ───────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  investmentGoals: z.array(z.enum(['HIGH_ROI', 'CAPITAL_GROWTH', 'GOLDEN_VISA'])).optional(),
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
  investmentGoals: z.array(z.enum(['HIGH_ROI', 'CAPITAL_GROWTH', 'GOLDEN_VISA'])).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// ─── Property Schemas ───────────────────────────────────────────────────────

const investmentFields = {
  expectedROI: z.number().optional(),
  rentalYield: z.number().optional(),
  capitalGrowth: z.number().optional(),
  annualAppreciation: z.number().optional(),
  minInvestment: z.number().optional(),
  maxInvestment: z.number().optional(),
  downPaymentPercentage: z.number().optional(),
  paymentPlan: z.string().optional(),
  installmentYears: z.number().optional(),
  completionDate: z.string().optional(),
  handoverDate: z.string().optional(),
  expectedRentalStart: z.string().optional(),
  averageRentPerMonth: z.number().optional(),
  mortgageAvailable: z.boolean().optional(),
  serviceFee: z.number().optional(),
  propertyTax: z.number().optional(),
  goldenVisaMinAmount: z.number().optional(),
};

export const INVESTMENT_FIELD_KEYS = Object.keys(investmentFields) as (keyof typeof investmentFields)[];

export const propertySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  shortDescription: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().min(3, 'Currency is required'),

  propertyType: z.enum(['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO', 'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE']),
  bedrooms: z.number().min(0, 'Bedrooms must be non-negative'),
  bathrooms: z.number().min(0, 'Bathrooms must be non-negative'),
  area: z.number().min(0, 'Area must be positive'),
  builtYear: z.number().optional(),
  floors: z.number().optional(),
  floor: z.number().optional(),
  parkingSpaces: z.number().optional(),

  country: z.enum(['GEORGIA', 'CYPRUS', 'GREECE', 'LEBANON']),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  status: z.enum(['OFF_PLAN', 'NEW_BUILD', 'RESALE']),
  availabilityStatus: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'OFF_MARKET']).optional(),
  visibility: z.enum(['PUBLIC', 'ELITE_ONLY', 'HIDDEN']).optional(),

  furnishingStatus: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).optional(),
  ownershipType: z.enum(['FREEHOLD', 'LEASEHOLD']).optional(),
  isGoldenVisaEligible: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasBalcony: z.boolean().optional(),
  hasSecurity: z.boolean().optional(),
  hasElevator: z.boolean().optional(),
  hasCentralAC: z.boolean().optional(),

  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  virtualTourUrl: z.string().optional(),

  slug: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  featured: z.boolean().optional(),
  featuredUntil: z.string().optional(),

  highlightedFeatures: z.array(z.string()).optional(),

  developerId: z.string().optional(),
  locationGuideId: z.string().optional(),
  agentId: z.string().optional(),

  // Investment data (flattened into property for API convenience)
  ...investmentFields,
});

export const propertyQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  country: z.string().optional(),
  city: z.string().optional(),
  propertyType: z.string().optional(),
  status: z.string().optional(),
  availabilityStatus: z.string().optional(),
  visibility: z.string().optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  bedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  minBedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  maxBedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  isGoldenVisaEligible: z.string().optional().transform(val => val === 'true'),
  featured: z.string().optional().transform(val => val === 'true'),
  hasPool: z.string().optional().transform(val => val === 'true'),
  furnishingStatus: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ─── User Schemas ───────────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(['USER', 'AGENT', 'ADMIN', 'SUPER_ADMIN']),
});

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required'),
});

export const inviteAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['AGENT', 'ADMIN', 'SUPER_ADMIN']),
});

// ─── Inquiry Schemas ────────────────────────────────────────────────────────

export const inquirySchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  message: z.string().optional(),
});

// ─── Portfolio Schemas ──────────────────────────────────────────────────────

export const ownedPropertySchema = z.object({
  customName: z.string().min(1, 'Property name is required'),
  purchasePrice: z.number().min(0, 'Purchase price must be positive'),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  initialMortgage: z.number().optional().nullable(),
  currentRent: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
});

// ─── AI Search Schemas ──────────────────────────────────────────────────────

export const aiSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  context: z.object({
    userId: z.string().optional(),
    previousSearches: z.array(z.string()).optional(),
  }).optional(),
});

// ─── Utility: Extract investment data from validated property data ───────────

export function extractInvestmentData(
  data: Record<string, unknown>
): { investmentData: Record<string, unknown>; propertyData: Record<string, unknown> } {
  const investmentData: Record<string, unknown> = {};
  const propertyData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (INVESTMENT_FIELD_KEYS.includes(key as keyof typeof investmentFields)) {
      investmentData[key] = value;
    } else {
      propertyData[key] = value;
    }
  }

  return { investmentData, propertyData };
}

/**
 * Build investment data create/update object from extracted fields.
 * Handles date conversion for completionDate, handoverDate, expectedRentalStart.
 */
export function buildInvestmentDataPayload(
  fields: Record<string, unknown>,
  isGoldenVisaEligible?: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const dateFields = ['completionDate', 'handoverDate', 'expectedRentalStart'];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    if (dateFields.includes(key)) {
      result[key] = value ? new Date(value as string) : null;
    } else {
      result[key] = value ?? null;
    }
  }

  if (isGoldenVisaEligible !== undefined) {
    result.isGoldenVisaEligible = isGoldenVisaEligible;
  }

  return result;
}
