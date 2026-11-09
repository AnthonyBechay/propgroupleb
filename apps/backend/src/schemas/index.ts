import { z } from 'zod';

/**
 * One definition of "strong enough", shared by signup, the self-service change,
 * and an admin setting someone's password. Three copies of the rule existed and
 * the admin-side one was the weakest of them.
 */
export const passwordRule = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordRule,
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
  newPassword: passwordRule,
});

// ─── Building ─────────────────────────────────────────────────────────────────
// Building, unit and option bodies are validated by the schemas local to
// routes/buildings.ts and routes/units.ts. Shared copies used to live here too
// and silently shadowed them; they were removed with the dead /api/properties
// write routes.

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

// ─── FX Rate ──────────────────────────────────────────────────────────────────

export const fxRateSchema = z.object({
  date: z.string().min(1),
  usdToLbp: z.number().min(0),
  source: z.string().optional().nullable(),
});

// ─── Shared ───────────────────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(['USER', 'AGENT', 'CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN']),
});

export const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required'),
});

// ─── Admin-side user management ──────────────────────────────────────────────

/** Every role an admin may assign. Same list the frontend picker renders. */
export const ASSIGNABLE_ROLES = ['USER', 'AGENT', 'CRM_MANAGER', 'ADMIN', 'SUPER_ADMIN'] as const;

/**
 * Create a working account outright — email, password, role.
 *
 * Replaces an invite flow that wrote a null password (which no login can match)
 * and promised a setup email nothing sent. Setting the password up front is
 * what makes the account real.
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address').max(160),
  password: passwordRule,
  role: z.enum(ASSIGNABLE_ROLES).default('USER'),
  firstName: z.string().max(80).optional().nullable(),
  lastName: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
  agentCommissionRate: z.number().min(0).max(100).optional().nullable(),
});

/** Edit an existing account. Every field optional — this is a PATCH in spirit. */
export const adminUpdateUserSchema = z.object({
  firstName: z.string().max(80).optional().nullable(),
  lastName: z.string().max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  isActive: z.boolean().optional(),
  agentCommissionRate: z.number().min(0).max(100).optional().nullable(),
});

export const setPasswordSchema = z.object({
  password: passwordRule,
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


