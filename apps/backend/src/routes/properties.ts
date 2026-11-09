import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
import { shouldCountView } from '../utils/view-counting.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendPaginated, sendNotFound } from '../utils/response.js';
import { buildPaginationResponse } from '../utils/pagination.js';
import { buildingQuerySchema } from '../schemas/index.js';
import { publicCountryFilter } from '../utils/market.js';
import { mapBuildingToProperty } from '../utils/property-mapper.js';

const router: Router = express.Router();

// ── PUBLIC READ: the legacy flat `Property` contract ─────────────────────────
//
// These three handlers exist for the Georgia storefront (propgrp.com, separate
// repo), which renders the pre-merge flat `Property` shape. They fold
// Building + Unit + UnitOption + Listing + BuildingInvestmentData down via
// utils/property-mapper.ts.
//
// `/api/buildings` remains the native shape and is what this back office uses —
// nothing in this repo consumes these handlers.
//
// The mapping used to live in the storefront repo and run over HTTP, which
// forced an N+1 (its list response truncated units, so each building had to be
// re-fetched for areas and options). Here units and options come back in the
// same query.

/** The listing states a visitor may be shown. See the note below. */
const LIVE_LISTING_STATUSES: Array<'ACTIVE' | 'UNDER_OFFER'> = ['ACTIVE', 'UNDER_OFFER'];

/** Everything the flat shape needs, in one query. */
export const FLAT_PROPERTY_INCLUDE = {
  developer: true,
  locationGuide: true,
  investmentData: true,
  // Narrowed from `listings: true`. `derivePrice` takes the lowest listing
  // price in preference to anything else, so an unfiltered include let a DRAFT
  // or HIDDEN listing — a price the admin has deliberately not published —
  // become the "from $X" figure on a public card.
  listings: {
    where: {
      status: { in: LIVE_LISTING_STATUSES },
      visibility: { not: 'HIDDEN' as const },
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
      },
    },
    orderBy: { floor: 'asc' as const },
  },
} as const;

/** Filters that can only be applied after mapping, because the values they
 *  test are derived rather than stored (price comes from pricePerSqm x area,
 *  propertyType from the units' kind). */
function applyDerivedFilters(
  properties: Record<string, unknown>[],
  query: Record<string, unknown>,
): Record<string, unknown>[] {
  let out = properties;
  const num = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));

  const minPrice = num(query.minPrice);
  const maxPrice = num(query.maxPrice);
  const bedrooms = num(query.bedrooms);
  const propertyType = typeof query.propertyType === 'string' ? query.propertyType : undefined;

  if (minPrice !== undefined) out = out.filter((p) => Number(p.price ?? 0) >= minPrice);
  if (maxPrice !== undefined) out = out.filter((p) => Number(p.price ?? 0) <= maxPrice);
  if (propertyType) out = out.filter((p) => p.propertyType === propertyType);
  if (bedrooms !== undefined) {
    out = out.filter((p) => Number((p.maxBedrooms ?? p.bedrooms) ?? 0) >= bedrooms);
  }
  return out;
}

// Get all properties — flat shape (public)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = buildingQuerySchema.parse(req.query);
    const { page, limit } = query;

    const where: Record<string, unknown> = { visibility: 'PUBLIC' };

    // One database, two websites. This legacy alias route previously applied NO
    // market scope at all, so a public caller got Lebanese and Georgian stock
    // mixed together — the one public endpoint that leaked across markets.
    // Admins still see everything (publicCountryFilter returns null for them).
    const country = publicCountryFilter(req);
    if (country) where.country = country;

    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.mohafazat) where.mohafazat = query.mohafazat;
    if (query.caza) where.caza = query.caza;
    if (query.status) where.status = query.status;
    if (query.featured) where.featured = true;

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { neighborhood: { contains: query.search, mode: 'insensitive' } },
        { ref: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Price and property type are derived, so they cannot be filtered or sorted
    // in SQL. The scoped catalogue is small (tens of rows), so the whole match
    // set is mapped and then narrowed — which also keeps `total` honest, since
    // a post-filter count is the only correct one.
    const buildings = await prisma.building.findMany({
      where,
      include: FLAT_PROPERTY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    let properties = buildings.map((b) => mapBuildingToProperty(b, { detail: false }));
    properties = applyDerivedFilters(properties, query as unknown as Record<string, unknown>);

    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const byCreated = (a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime();

    switch (query.sortBy) {
      case 'price':
        properties.sort((a, b) => (Number(a.price ?? 0) - Number(b.price ?? 0)) * sortOrder);
        break;
      case 'views':
        properties.sort((a, b) => (Number(a.views ?? 0) - Number(b.views ?? 0)) * sortOrder);
        break;
      case 'title':
        properties.sort((a, b) => String(a.title).localeCompare(String(b.title)) * sortOrder);
        break;
      default:
        // Featured first, then newest — the storefront's default ordering.
        properties.sort((a, b) => {
          if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
          return byCreated(a, b);
        });
    }

    const total = properties.length;
    const start = (page - 1) * limit;

    sendPaginated(
      res,
      properties.slice(start, start + limit),
      buildPaginationResponse(page, limit, total),
    );
  })
);

// Get property by slug — flat shape (public)
router.get(
  '/slug/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const building =
      (await prisma.building.findUnique({ where: { slug: req.params.slug }, include: FLAT_PROPERTY_INCLUDE })) ??
      // An address from before a rename (see Building.previousSlugs).
      (await prisma.building.findFirst({ where: { previousSlugs: { has: req.params.slug } }, include: FLAT_PROPERTY_INCLUDE }));

    if (!building || building.visibility === 'HIDDEN') {
      sendNotFound(res, 'Property');
      return;
    }

    sendSuccess(res, mapBuildingToProperty(building, { detail: true }));
  })
);

// Get single property by id OR slug — flat shape (public)
//
// Accepts both because the storefront links to `/property/{id}` from cards and
// `/property/{slug}` from the compare page.
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const idOrSlug = req.params.id;

    const building =
      (await prisma.building.findUnique({
        where: { id: idOrSlug },
        include: FLAT_PROPERTY_INCLUDE,
      })) ??
      (await prisma.building.findUnique({
        where: { slug: idOrSlug },
        include: FLAT_PROPERTY_INCLUDE,
      })) ??
      (await prisma.building.findFirst({ where: { previousSlugs: { has: idOrSlug } }, include: FLAT_PROPERTY_INCLUDE }));

    if (!building || building.visibility === 'HIDDEN') {
      sendNotFound(res, 'Property');
      return;
    }

    // Fire and forget.
    if (shouldCountView(req)) {
      prisma.building
        .update({ where: { id: building.id }, data: { views: { increment: 1 } } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((err: any) => logger.error('Failed to increment building views', err));
    }

    sendSuccess(res, mapBuildingToProperty(building, { detail: true }));
  })
);

// Read-only. This is the storefront contract (see CLAUDE.md). Properties,
// units and options are written only through /api/buildings, /api/units and
// /api/listings; the write routes that used to live here had no callers.

export default router;
