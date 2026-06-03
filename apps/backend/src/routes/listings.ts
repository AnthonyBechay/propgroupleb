import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction, optionalAuthenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { listingSchema } from '../schemas/index.js';
import { LISTING_CARD_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';
import {
  syncUnitLifecycleFromListing,
  MARKETABLE_LIFECYCLES,
  type ListingIntent,
  type ListingStatus,
  type UnitLifecycle,
} from '../utils/listing-status-sync.js';

const router: Router = express.Router();

// ── Slug helper ───────────────────────────────────────────────────────────────

async function generateListingSlug(
  base: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any
): Promise<string> {
  const slugBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  const db = tx || prisma;
  // Append 4-char random suffix to keep slugs unique without collisions
  const suffix = Math.random().toString(36).substring(2, 6);
  const candidate = `${slugBase}-${suffix}`;
  const exists = await db.listing.findFirst({ where: { slug: candidate }, select: { id: true } });
  if (!exists) return candidate;
  // Extremely unlikely collision — retry with a new suffix
  return generateListingSlug(base, tx);
}

// ── Inline update schema (partial of listingSchema) ───────────────────────────

const listingUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'UNDER_OFFER', 'CLOSED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PUBLIC', 'ELITE_ONLY', 'HIDDEN']).optional(),
  price: z.number().min(0).optional(),
  currency: z.enum(['USD', 'LBP']).optional(),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional().nullable(),
  headline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  highlights: z.array(z.string()).optional(),
  closingReason: z.string().optional().nullable(),
});

// ── Building-with-public-documents include ────────────────────────────────────
// Reused by the slug + id detail endpoints so the public listing page can show
// downloadable docs (floor plans, brochures, …) the admin marked as `isPublic`.
const BUILDING_PUBLIC_INCLUDE = {
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
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

// ── Shared listing detail include ─────────────────────────────────────────────

const LISTING_DETAIL_INCLUDE = {
  building: {
    select: {
      id: true,
      title: true,
      slug: true,
      city: true,
      caza: true,
      mohafazat: true,
      neighborhood: true,
      images: true,
      kind: true,
      status: true,
      hasGenerator: true,
      hasElevator: true,
      hasPool: true,
      latitude: true,
      longitude: true,
    },
  },
  unit: {
    select: {
      id: true,
      kind: true,
      unitNumber: true,
      name: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true,
      floor: true,
      images: true,
      lifecycle: true,
      furnishing: true,
      features: true,
      views: true,
    },
  },
  _count: {
    select: {
      favorites: true,
      inquiries: true,
    },
  },
} as const;

// ── GET / — public listing search ─────────────────────────────────────────────

router.get(
  '/',
  optionalAuthenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const q = req.query as Record<string, string>;
    const authReq = req as AuthenticatedRequest;
    const isAdmin = authReq.user && ['ADMIN', 'SUPER_ADMIN'].includes(authReq.user.role);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Public callers always see only PUBLIC listings; admins may pass status filter
    if (!isAdmin) {
      where.visibility = 'PUBLIC';
      where.status = q.status ?? 'ACTIVE';
    } else {
      if (q.status && q.status !== 'all') where.status = q.status;
    }

    if (q.intent) where.intent = q.intent;
    if (q.subjectType) where.subjectType = q.subjectType;
    if (q.currency) where.currency = q.currency;

    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const price: Record<string, any> = {};
      if (q.minPrice) price.gte = parseFloat(q.minPrice);
      if (q.maxPrice) price.lte = parseFloat(q.maxPrice);
      where.price = price;
    }

    // Free-text search — matches building title or listing headline
    if (q.search) {
      where.OR = [
        { headline: { contains: q.search, mode: 'insensitive' } },
        { building: { title: { contains: q.search, mode: 'insensitive' } } },
        { unit: { building: { title: { contains: q.search, mode: 'insensitive' } } } },
      ];
    }

    // Location filters — must match through direct building relation OR via unit → building
    if (q.mohafazat || q.caza || q.city) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locationFilter: Record<string, any> = {};
      if (q.mohafazat) locationFilter.mohafazat = { contains: q.mohafazat, mode: 'insensitive' };
      if (q.caza) locationFilter.caza = { contains: q.caza, mode: 'insensitive' };
      if (q.city) locationFilter.city = { contains: q.city, mode: 'insensitive' };

      const locationOR = [
        { building: locationFilter },
        { unit: { building: locationFilter } },
      ];

      if (where.OR) {
        // Combine search OR and location OR with AND
        where.AND = [{ OR: where.OR }, { OR: locationOR }];
        delete where.OR;
      } else {
        where.OR = locationOR;
      }
    }

    // Unit-level filters (for UNIT-subject listings)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitFilter: Record<string, any> = {};
    if (q.kind) unitFilter.kind = q.kind;
    if (q.minBeds) unitFilter.bedrooms = { ...(unitFilter.bedrooms ?? {}), gte: parseInt(q.minBeds) };
    if (q.maxBeds) unitFilter.bedrooms = { ...(unitFilter.bedrooms ?? {}), lte: parseInt(q.maxBeds) };
    if (q.minArea) unitFilter.areaSqm = { ...(unitFilter.areaSqm ?? {}), gte: parseFloat(q.minArea) };
    if (q.maxArea) unitFilter.areaSqm = { ...(unitFilter.areaSqm ?? {}), lte: parseFloat(q.maxArea) };

    if (Object.keys(unitFilter).length > 0) {
      where.unit = unitFilter;
    }

    // Public safety guard: never surface a unit-listing whose unit is no longer
    // on the market (SOLD/RENTED/OWNER_OCCUPIED/OFF_MARKET, or still DRAFT/VACANT).
    // The write-side sync normally CLOSEs such listings, but this guarantees the
    // public catalog can't show a sold apartment as available even if a listing
    // status drifted out of sync. BUILDING-subject listings have no unit and
    // always pass. Admins see everything.
    if (!isAdmin) {
      const lifecycleGuard = {
        OR: [
          { subjectType: 'BUILDING' },
          { unit: { lifecycle: { in: MARKETABLE_LIFECYCLES } } },
        ],
      };
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), lifecycleGuard];
    }

    // Sort
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: Record<string, any>[] = [{ createdAt: 'desc' }];
    if (q.sortBy === 'price' || q.sortBy === 'createdAt' || q.sortBy === 'views') {
      const order = q.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = [{ [q.sortBy]: order }];
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        // Catalog cards only need a narrow projection — using the full detail
        // include here over-fetched lat/long, amenity flags and unit feature
        // arrays on every row (per CLAUDE.md: never use detail include for lists).
        include: LISTING_CARD_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.listing.count({ where }),
    ]);

    sendPaginated(res, listings, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /slug/:slug — public detail by slug ───────────────────────────────────

router.get(
  '/slug/:slug',
  optionalAuthenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const isAdmin = authReq.user && ['ADMIN', 'SUPER_ADMIN'].includes(authReq.user.role);

    const listing = await prisma.listing.findUnique({
      where: { slug: req.params.slug },
      include: {
        ...LISTING_DETAIL_INCLUDE,
        building: { include: BUILDING_PUBLIC_INCLUDE },
        unit: {
          include: {
            building: { include: BUILDING_PUBLIC_INCLUDE },
            options: true,
          },
        },
      },
    });

    if (!listing) { sendNotFound(res, 'Listing'); return; }

    // Non-admins must not be able to reach DRAFT/ARCHIVED or non-PUBLIC listings
    // by guessing/sharing a slug. ACTIVE / UNDER_OFFER / CLOSED stay reachable so
    // previously-shared links to sold units still resolve. Treat as not-found
    // (don't leak existence of hidden/draft records).
    if (!isAdmin) {
      const viewableStatus = ['ACTIVE', 'UNDER_OFFER', 'CLOSED'].includes(listing.status);
      if (listing.visibility !== 'PUBLIC' || !viewableStatus) {
        sendNotFound(res, 'Listing');
        return;
      }
    }

    const buildingId = listing.buildingId ?? (listing.unit as { buildingId?: string } | null)?.buildingId;
    if (buildingId) {
      prisma.building
        .update({ where: { id: buildingId }, data: { views: { increment: 1 } } })
        .catch((err) => logger.error('Failed to increment building views', err));
    }

    sendSuccess(res, listing);
  })
);

// ── GET /:id — public detail by id ───────────────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: {
        ...LISTING_DETAIL_INCLUDE,
        building: { include: BUILDING_PUBLIC_INCLUDE },
        unit: {
          include: {
            building: { include: BUILDING_PUBLIC_INCLUDE },
            options: true,
          },
        },
      },
    });

    if (!listing) { sendNotFound(res, 'Listing'); return; }

    const buildingId = listing.buildingId ?? (listing.unit as { buildingId?: string } | null)?.buildingId;
    if (buildingId) {
      prisma.building
        .update({ where: { id: buildingId }, data: { views: { increment: 1 } } })
        .catch((err) => logger.error('Failed to increment building views', err));
    }

    sendSuccess(res, listing);
  })
);

// ── POST / — create listing (admin) ──────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = listingSchema.parse(req.body);

    if (data.subjectType === 'UNIT' && !data.unitId) {
      sendError(res, 400, 'unitId is required when subjectType is UNIT');
      return;
    }
    if (data.subjectType === 'BUILDING' && !data.buildingId) {
      sendError(res, 400, 'buildingId is required when subjectType is BUILDING');
      return;
    }

    // Validate referenced entities exist and auto-fill buildingId for unit listings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let resolvedData: typeof data & { buildingId?: string | null } = data;
    if (data.subjectType === 'UNIT' && data.unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: data.unitId },
        select: { id: true, buildingId: true },
      });
      if (!unit) { sendError(res, 400, 'Unit not found'); return; }
      // Always link buildingId on unit listings so building-level queries work
      resolvedData = { ...data, buildingId: unit.buildingId };
    } else if (data.subjectType === 'BUILDING' && data.buildingId) {
      const building = await prisma.building.findUnique({
        where: { id: data.buildingId },
        select: { id: true },
      });
      if (!building) { sendError(res, 400, 'Building not found'); return; }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const slugSource = resolvedData.slug || resolvedData.headline || `listing-${Date.now()}`;
      const slug = resolvedData.slug || (await generateListingSlug(slugSource, tx));
      return tx.listing.create({
        data: {
          ...resolvedData,
          slug,
          highlights: resolvedData.highlights ?? [],
          publishedAt: resolvedData.status === 'ACTIVE' ? new Date() : undefined,
        },
      });
    });

    await logAdminAction('CREATE_LISTING', 'listing', result.id, {
      intent: result.intent,
      subjectType: result.subjectType,
      price: String(result.price),
    }, authReq);

    sendCreated(res, result, 'Listing created successfully');
  })
);

// ── PUT /:id — update listing (admin) ─────────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = listingUpdateSchema.parse(req.body);

    const existing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        intent: true,
        subjectType: true,
        unitId: true,
        unit: { select: { lifecycle: true } },
      },
    });
    if (!existing) { sendNotFound(res, 'Listing'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE' && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
    if (data.status === 'CLOSED' || data.status === 'ARCHIVED') {
      updateData.closedAt = new Date();
    }

    // When a unit-listing's status changes, nudge the parent unit's lifecycle so
    // the asset state stays consistent (e.g. CLOSED sale → unit SOLD). Run both
    // writes in one transaction. See utils/listing-status-sync.ts.
    const statusChanged = data.status != null && data.status !== existing.status;
    const shouldSyncUnit =
      statusChanged &&
      existing.subjectType === 'UNIT' &&
      !!existing.unitId &&
      !!existing.unit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result, unitLifecycle } = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.listing.update({ where: { id: req.params.id }, data: updateData });
      let newLifecycle: UnitLifecycle | null = null;
      if (shouldSyncUnit) {
        newLifecycle = await syncUnitLifecycleFromListing(
          tx,
          existing.unitId as string,
          existing.intent as ListingIntent,
          data.status as ListingStatus,
          existing.unit!.lifecycle as UnitLifecycle,
        );
      }
      return { result: updated, unitLifecycle: newLifecycle };
    });

    await logAdminAction('UPDATE_LISTING', 'listing', req.params.id, { status: result.status, unitLifecycle }, authReq);
    sendSuccess(
      res,
      result,
      unitLifecycle ? `Listing updated — unit marked ${unitLifecycle}` : 'Listing updated successfully',
    );
  })
);

// ── DELETE /:id — soft-delete listing (admin) ─────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      select: { id: true, headline: true },
    });
    if (!existing) { sendNotFound(res, 'Listing'); return; }

    const result = await prisma.listing.update({
      where: { id: req.params.id },
      data: { status: 'ARCHIVED', closedAt: new Date() },
    });

    await logAdminAction('ARCHIVE_LISTING', 'listing', req.params.id, { headline: existing.headline }, authReq);
    sendSuccess(res, result, 'Listing archived successfully');
  })
);

export default router;
