import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { shouldCountView } from '../utils/view-counting.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_LIST_INCLUDE, PROPERTY_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import { buildingSchema, buildingQuerySchema, extractInvestmentData, buildInvestmentDataPayload, unitSchema, unitOptionSchema } from '../schemas/index.js';
import { deleteFile, extractKeyFromUrl } from '../services/upload.service.js';
import { nextUnitRef } from '../utils/reference.js';
import { publicCountryFilter } from '../utils/market.js';
import { mapBuildingToProperty } from '../utils/property-mapper.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

/**
 * Generate a URL-safe slug from a building title.
 * Handles collisions by appending -2, -3, … until unique.
 */
async function generateUniqueSlug(
  title: string,
  excludeId?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any,
): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  const db = tx || prisma;

  let candidate = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const where: Record<string, unknown> = { slug: candidate };
    if (excludeId) where.id = { not: excludeId };
    const exists = await db.building.findFirst({ where, select: { id: true } });
    if (!exists) return candidate;
    counter++;
    candidate = `${base}-${counter}`;
  }
}

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

/** Everything the flat shape needs, in one query. */
const FLAT_PROPERTY_INCLUDE = {
  developer: true,
  locationGuide: true,
  investmentData: true,
  listings: true,
  units: { include: { options: true }, orderBy: { floor: 'asc' as const } },
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
    const building = await prisma.building.findUnique({
      where: { slug: req.params.slug },
      include: FLAT_PROPERTY_INCLUDE,
    });

    if (!building) {
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
      }));

    if (!building) {
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

// Create building (admin only)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = buildingSchema.parse(req.body);
    const { investmentData: investFields, buildingData } = extractInvestmentData(validatedData);

    // Convert date strings to proper DateTime objects for Prisma
    const bd = buildingData as Record<string, unknown>;
    if (bd.featuredUntil && typeof bd.featuredUntil === 'string') {
      bd.featuredUntil = new Date(bd.featuredUntil);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // Auto-generate slug from title if none provided
      const slug = (bd.slug as string) || await generateUniqueSlug(validatedData.title, undefined, tx);

      const createData = {
        ...buildingData,
        slug,
        images: (bd.images as string[]) || [],
        highlightedFeatures: (bd.highlightedFeatures as string[]) || [],
        youtubeUrls: (bd.youtubeUrls as string[]) || [],
        publishedAt: new Date(),
      };
      const building = await tx.building.create({ data: createData });

      const hasInvestmentData = Object.values(investFields).some((v) => v !== undefined && v !== null);
      if (hasInvestmentData) {
        const payload = buildInvestmentDataPayload(investFields);
        await tx.buildingInvestmentData.create({
          data: {
            buildingId: building.id,
            ...payload,
          },
        });
      }

      return building;
    });

    await logAdminAction('CREATE_BUILDING', 'building', result.id, {
      title: result.title,
      city: result.city,
    }, authReq);

    sendCreated(res, result, 'Building created successfully');
  })
);

// Update building (admin only)
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = buildingSchema.partial().parse(req.body);

    const existing = await prisma.building.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      sendNotFound(res, 'Building');
      return;
    }

    const { investmentData: investFields, buildingData } = extractInvestmentData(validatedData);

    // Convert date strings to proper DateTime objects for Prisma
    const bd = buildingData as Record<string, unknown>;
    if (bd.featuredUntil && typeof bd.featuredUntil === 'string') {
      bd.featuredUntil = new Date(bd.featuredUntil);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      // Backfill slug if missing or regenerate when title changes
      if (!existing.slug || (bd.title && bd.title !== existing.title)) {
        const title = (bd.title as string) || existing.title;
        bd.slug = await generateUniqueSlug(title, req.params.id, tx);
      }

      const building = await tx.building.update({
        where: { id: req.params.id },
        data: bd,
      });

      const hasInvestmentData = Object.values(investFields).some((v) => v !== undefined);
      if (hasInvestmentData) {
        const payload = buildInvestmentDataPayload(investFields);
        await tx.buildingInvestmentData.upsert({
          where: { buildingId: req.params.id },
          update: payload,
          create: {
            buildingId: req.params.id,
            ...payload,
          },
        });
      }

      return building;
    });

    await logAdminAction('UPDATE_BUILDING', 'building', req.params.id, {
      title: result.title,
      city: result.city,
    }, authReq);

    sendSuccess(res, result, 'Building updated successfully');
  })
);

// Bulk delete buildings (admin only)
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Please provide an array of building IDs to delete' });
      return;
    }

    // Fetch titles for audit log
    const buildings = await prisma.building.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });

    if (buildings.length === 0) {
      res.status(404).json({ error: 'No matching buildings found' });
      return;
    }

    // Clean up R2 files for all buildings
    await Promise.all(buildings.map((b: { id: string }) => cleanupBuildingFiles(b.id)));

    await prisma.building.deleteMany({ where: { id: { in: ids } } });

    await logAdminAction('BULK_DELETE_BUILDINGS', 'building', ids.join(','), {
      count: buildings.length,
      titles: buildings.map((b: { title: string }) => b.title),
    }, authReq);

    sendSuccess(res, { deleted: buildings.length }, `${buildings.length} buildings deleted successfully`);
  })
);

// Helper: clean up R2 files for a building (images + documents)
async function cleanupBuildingFiles(buildingId: string) {
  try {
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { images: true, documents: { select: { fileUrl: true } } },
    });
    if (!building) return;

    const urlsToDelete: string[] = [
      ...(building.images || []),
      ...building.documents.map((d: { fileUrl: string }) => d.fileUrl),
    ];

    await Promise.all(
      urlsToDelete.map(async (url) => {
        try {
          const key = extractKeyFromUrl(url);
          if (key) await deleteFile(key);
        } catch (err) {
          logger.error('Failed to delete R2 file', err, { url });
        }
      })
    );
  } catch (err) {
    logger.error('Failed to cleanup files for building', err, { buildingId });
  }
}

// Delete building (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.building.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true },
    });

    if (!existing) {
      sendNotFound(res, 'Building');
      return;
    }

    // Clean up R2 files before deleting from DB
    await cleanupBuildingFiles(req.params.id);

    await prisma.building.delete({ where: { id: req.params.id } });

    await logAdminAction('DELETE_BUILDING', 'building', req.params.id, {
      title: existing.title,
    }, authReq);

    sendSuccess(res, null, 'Building deleted successfully');
  })
);

// ─── Unit Routes ──────────────────────────────────────────────────────────────

// List units for a building
router.get('/:id/units', asyncHandler(async (req: Request, res: Response) => {
  const units = await prisma.unit.findMany({
    where: { buildingId: req.params.id },
    include: { options: true },
    orderBy: { createdAt: 'asc' },
  });
  sendSuccess(res, units);
}));

// Create unit
router.post('/:id/units', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const data = unitSchema.parse(req.body);
  const unit = await prisma.unit.create({
    data: { ...data, buildingId: req.params.id, ref: await nextUnitRef(req.params.id) },
    include: { options: true },
  });
  await logAdminAction('CREATE_UNIT', 'unit', unit.id, { buildingId: req.params.id, name: unit.name }, authReq);
  sendCreated(res, unit, 'Unit created successfully');
}));

// Update unit
router.put('/:id/units/:unitId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const data = unitSchema.partial().parse(req.body);
  const unit = await prisma.unit.update({
    where: { id: req.params.unitId },
    data: data as Parameters<typeof prisma.unit.update>[0]['data'],
    include: { options: true },
  });
  await logAdminAction('UPDATE_UNIT', 'unit', unit.id, { name: unit.name }, authReq);
  sendSuccess(res, unit, 'Unit updated successfully');
}));

// Delete unit
router.delete('/:id/units/:unitId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const unit = await prisma.unit.findUnique({ where: { id: req.params.unitId }, select: { id: true, name: true } });
  if (!unit) { sendNotFound(res, 'Unit'); return; }
  await prisma.unit.delete({ where: { id: req.params.unitId } });
  await logAdminAction('DELETE_UNIT', 'unit', req.params.unitId, { name: unit.name }, authReq);
  sendSuccess(res, null, 'Unit deleted successfully');
}));

// ─── Unit Option Routes ───────────────────────────────────────────────────────

// Create option for a unit
router.post('/:id/units/:unitId/options', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const data = unitOptionSchema.parse(req.body);
  const option = await prisma.unitOption.create({
    data: { ...data, unitId: req.params.unitId },
  });
  await logAdminAction('CREATE_UNIT_OPTION', 'unitOption', option.id, { name: option.name }, authReq);
  sendCreated(res, option, 'Option created successfully');
}));

// Update option
router.put('/:id/units/:unitId/options/:optionId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const data = unitOptionSchema.partial().parse(req.body);
  const option = await prisma.unitOption.update({
    where: { id: req.params.optionId },
    data,
  });
  await logAdminAction('UPDATE_UNIT_OPTION', 'unitOption', option.id, { name: option.name }, authReq);
  sendSuccess(res, option, 'Option updated successfully');
}));

// Delete option
router.delete('/:id/units/:unitId/options/:optionId', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  await prisma.unitOption.delete({ where: { id: req.params.optionId } });
  await logAdminAction('DELETE_UNIT_OPTION', 'unitOption', req.params.optionId, {}, authReq);
  sendSuccess(res, null, 'Option deleted successfully');
}));

export default router;
