// Note: The Prisma includes in this file are typed as 'const' objects without
// Prisma.XxxInclude annotations because the generated types depend on the new
// schema (Building, Unit, Listing, etc.) which requires `prisma generate` to be
// run first. Once regenerated the types will be correct. The `as const` on each
// object still provides full IDE inference via satisfies/const assertion.

// ── Building includes ─────────────────────────────────────────────────────────

/** Narrow include for building list views (public cards, admin tables). */
export const BUILDING_LIST_INCLUDE = {
  developer: true,
  investmentData: true,
  units: {
    select: { id: true, kind: true, lifecycle: true },
  },
  _count: {
    select: {
      units: true,
      listings: true,
      inquiries: true,
      favorites: true,
    },
  },
} as const;

/** Full include for single building detail page. */
export const BUILDING_DETAIL_INCLUDE = {
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
    orderBy: { createdAt: 'desc' as const },
  },
  units: {
    include: {
      options: true,
    },
    orderBy: { floor: 'asc' as const },
  },
  _count: {
    select: {
      favorites: true,
      inquiries: true,
    },
  },
} as const;

// ── Unit includes ─────────────────────────────────────────────────────────────

/** Narrow include for unit list views. */
export const UNIT_LIST_INCLUDE = {
  building: {
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      caza: true,
      mohafazat: true,
      images: true,
    },
  },
  _count: {
    select: {
      tenancies: true,
      tickets: true,
    },
  },
} as const;

/** Full include for single unit detail page. */
export const UNIT_DETAIL_INCLUDE = {
  building: {
    include: {
      developer: true,
      locationGuide: true,
      investmentData: true,
    },
  },
  options: true,
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
      createdAt: true,
    },
  },
  tenancies: {
    where: { status: 'ACTIVE' as const },
  },
  meters: {
    include: {
      readings: {
        orderBy: { readingAt: 'desc' as const },
        take: 1,
      },
    },
  },
  _count: {
    select: {
      tenancies: true,
      tickets: true,
    },
  },
} as const;

// ── Listing includes ──────────────────────────────────────────────────────────

/** Include for listing cards (search results, public portal). */
export const LISTING_CARD_INCLUDE = {
  building: {
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      caza: true,
      images: true,
      kind: true,
      status: true,
    },
  },
  unit: {
    select: {
      id: true,
      kind: true,
      unitNumber: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      floor: true,
      images: true,
      lifecycle: true,
    },
  },
  _count: {
    select: {
      favorites: true,
      inquiries: true,
    },
  },
} as const;

// ── User selects ──────────────────────────────────────────────────────────────

/** Standard user select (excludes password). */
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
} as const;

/** User select for auth responses. */
export const USER_AUTH_SELECT = {
  ...USER_SELECT,
  bannedAt: true,
} as const;

/** User select for admin user listing. */
export const USER_ADMIN_SELECT = {
  ...USER_AUTH_SELECT,
  bannedReason: true,
  lastLoginAt: true,
  _count: {
    select: {
      favoriteProperties: true,
      propertyInquiries: true,
      managedBuildings: true,
    },
  },
} as const;

// ── Legacy aliases (kept for routes that still reference property names) ──────

/** @deprecated Use BUILDING_LIST_INCLUDE. Kept for legacy /api/properties route. */
export const PROPERTY_LIST_INCLUDE = BUILDING_LIST_INCLUDE;

/** @deprecated Use BUILDING_DETAIL_INCLUDE. Kept for legacy /api/properties route. */
export const PROPERTY_DETAIL_INCLUDE = BUILDING_DETAIL_INCLUDE;

/** @deprecated No replacement needed. Kept for legacy portfolio route. */
export const PROPERTY_WITH_STATS_INCLUDE = {
  developer: true,
  locationGuide: true,
  investmentData: true,
  _count: {
    select: {
      favorites: true,
      inquiries: true,
    },
  },
} as const;
