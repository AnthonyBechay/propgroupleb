import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_LIST_INCLUDE, PROPERTY_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import { buildingSchema, buildingQuerySchema, extractInvestmentData, buildInvestmentDataPayload, unitSchema, unitOptionSchema } from '../schemas/index.js';
import { deleteFile, extractKeyFromUrl } from '../services/upload.service.js';
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

// Get all buildings (public)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = buildingQuerySchema.parse(req.query);
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { visibility: 'PUBLIC' };

    if (query.kind) where.kind = query.kind;
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
      ];
    }

    const sortOrder = query.sortOrder || 'desc';
    let orderBy: Record<string, string> = { createdAt: sortOrder };
    if (query.sortBy) {
      const validSortFields = ['createdAt', 'views', 'title'];
      if (validSortFields.includes(query.sortBy)) {
        orderBy = { [query.sortBy]: sortOrder };
      }
    }

    const [buildings, total] = await Promise.all([
      prisma.building.findMany({
        where,
        include: PROPERTY_LIST_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.building.count({ where }),
    ]);

    sendPaginated(res, buildings, buildPaginationResponse(page, limit, total));
  })
);

// Get building by slug (PUBLIC — no auth required)
router.get(
  '/slug/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const building = await prisma.building.findUnique({
      where: { slug: req.params.slug },
      include: PROPERTY_DETAIL_INCLUDE,
    });

    if (!building) {
      res.status(404).json({ error: 'Building not found' });
      return;
    }

    sendSuccess(res, building);
  })
);

// Get single building (public)
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const building = await prisma.building.findUnique({
      where: { id: req.params.id },
      include: PROPERTY_DETAIL_INCLUDE,
    });

    if (!building) {
      sendNotFound(res, 'Building');
      return;
    }

    // Increment view count (fire and forget)
    prisma.building.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
    }).catch((err: unknown) => logger.error('Failed to increment view count', err));

    sendSuccess(res, building);
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
    data: { ...data, buildingId: req.params.id },
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
