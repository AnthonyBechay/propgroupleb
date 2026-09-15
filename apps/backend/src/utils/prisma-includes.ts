// Note: The Prisma includes in this file are typed as 'const' objects without
// Prisma.XxxInclude annotations because the generated types depend on the new
// schema (Building, Unit, Listing, etc.) which requires `prisma generate` to be
// run first. Once regenerated the types will be correct. The `as const` on each
// object still provides full IDE inference via satisfies/const assertion.

/**
 * The listing states a visitor may be shown.
 *
 * Hoisted and explicitly typed rather than written inline: the includes below
 * end in `as const`, which would make an inline array `readonly` and Prisma's
 * generated `in` filter only accepts a mutable one.
 */
const LIVE_LISTING_STATUSES: Array<'ACTIVE' | 'UNDER_OFFER'> = ['ACTIVE', 'UNDER_OFFER'];

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
  // Whose property this is. Narrow on purpose — the admin only needs to show
  // and link the client, not carry their whole pipeline on every property.
  ownerLead: {
    select: { id: true, name: true, phone: true, whatsapp: true, email: true, type: true },
  },
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
  // Listings, on the building and nested on each unit.
  //
  // These were absent, and the omission was silent and expensive. The Georgia
  // storefront hydrates every project through this include and derives its
  // price with `derivePrice(listings, units)`, which prefers an explicit
  // listing price and only falls back to `pricePerSqm x area`. With no
  // listings in the payload the first branch could never fire, so a property
  // priced the way the back office prices things — a Listing on a unit —
  // derived **0** and the storefront showed no price at all.
  //
  // It went unnoticed because the imported Georgian stock is priced by unit
  // option (per m²), which takes the second branch and works. Only a newly
  // created project hits it.
  //
  // Narrowed to what may actually be shown: a DRAFT or HIDDEN listing is a
  // price the admin has not published, and quoting it as the project's "from"
  // price would publish it.
  listings: {
    where: {
      status: { in: LIVE_LISTING_STATUSES },
      visibility: { not: 'HIDDEN' as const },
    },
    select: {
      id: true, slug: true, intent: true, status: true, visibility: true,
      price: true, currency: true, rentPeriod: true, negotiable: true,
      headline: true, unitId: true,
    },
  },
  units: {
    include: {
      options: true,
      listings: {
        where: {
          status: { in: LIVE_LISTING_STATUSES },
          visibility: { not: 'HIDDEN' as const },
        },
        select: {
          id: true, slug: true, intent: true, status: true,
          price: true, currency: true, rentPeriod: true, negotiable: true,
        },
      },
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
      ref: true,
      country: true,
      city: true,
      caza: true,
      mohafazat: true,
      images: true,
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
} as const;

// ── Listing includes ──────────────────────────────────────────────────────────

/** Include for listing cards (search results, public portal). */
export const LISTING_CARD_INCLUDE = {
  building: {
    select: {
      id: true,
      title: true,
      slug: true,
      ref: true, // clients quote this back to us
      country: true, // decides which of the two websites shows it
      city: true,
      caza: true,
      mohafazat: true, // card location fallback when city/caza are empty
      images: true,
      kind: true,
      status: true,
      _count: { select: { units: true } }, // unit count shown on BUILDING-subject cards
    },
  },
  unit: {
    select: {
      id: true,
      ref: true, // "PG-1042-2" — the code a client quotes for this unit
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
      // The admin table shows this one; without it the cell read
      // "undefined properties" for every row.
      ownedProperties: true,
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
