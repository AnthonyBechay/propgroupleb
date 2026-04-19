import type { Prisma } from '@propgroup/db';

/** Standard include for property list views.
 *
 * Kept deliberately narrow: list consumers (public PropertyCard, admin
 * PropertyTable) need basic property fields + developer name + investmentData
 * + units count + engagement counts. They never read `agent`, never iterate
 * `units[].options`, and never read `paymentPlanDetails`. Those heavy fields
 * are included only by PROPERTY_DETAIL_INCLUDE on the single-property route.
 *
 * Units are selected (not included) with just { id } so `units.length`
 * still works on the client without shipping a paymentPlanDetails JSON blob
 * per option per unit per row. */
export const PROPERTY_LIST_INCLUDE = {
  developer: true,
  locationGuide: true,
  investmentData: true,
  units: {
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      favoriteProperties: true,
      propertyInquiries: true,
    },
  },
} as const satisfies Prisma.PropertyInclude;

/** Extended include for single property detail view */
export const PROPERTY_DETAIL_INCLUDE = {
  developer: true,
  locationGuide: true,
  investmentData: true,
  agent: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      agentCompany: true,
      agentBio: true,
    },
  },
  amenities: true,
  tags: {
    include: {
      tag: true,
    },
  },
  documents: {
    where: { isPublic: true },
    select: {
      id: true,
      title: true,
      description: true,
      fileUrl: true,
      fileSize: true,
      mimeType: true,
      type: true,
      unitId: true,
      unitOptionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
  units: {
    include: {
      options: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  _count: {
    select: {
      favoriteProperties: true,
      propertyInquiries: true,
    },
  },
} as const satisfies Prisma.PropertyInclude;

/** Property include for favorites/portfolio (with nested property) */
export const PROPERTY_WITH_STATS_INCLUDE = {
  developer: true,
  locationGuide: true,
  investmentData: true,
  _count: {
    select: {
      favoriteProperties: true,
      propertyInquiries: true,
    },
  },
} as const satisfies Prisma.PropertyInclude;

/** Standard user select (excludes password) */
export const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  country: true,
  role: true,
  investmentGoals: true,
  membershipTier: true,
  membershipStartDate: true,
  membershipEndDate: true,
  isActive: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

/** User select for auth responses */
export const USER_AUTH_SELECT = {
  ...USER_SELECT,
  bannedAt: true,
} as const satisfies Prisma.UserSelect;

/** User select for admin user listing */
export const USER_ADMIN_SELECT = {
  ...USER_AUTH_SELECT,
  bannedReason: true,
  lastLoginAt: true,
  _count: {
    select: {
      favoriteProperties: true,
      propertyInquiries: true,
      ownedProperties: true,
    },
  },
} as const satisfies Prisma.UserSelect;
