import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requireRole, logAdminAction, optionalAuthenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { BUILDING_LIST_INCLUDE, BUILDING_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const requirePropertyManager = requireRole('PROPERTY_MANAGER', 'ADMIN', 'SUPER_ADMIN');

// ── Slug helper ───────────────────────────────────────────────────────────────

async function generateUniqueSlug(
  title: string,
  excludeId?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { slug: candidate };
    if (excludeId) where.id = { not: excludeId };
    const exists = await db.building.findFirst({ where, select: { id: true } });
    if (!exists) return candidate;
    counter++;
    candidate = `${base}-${counter}`;
  }
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const buildingSchema = z.object({
  kind: z.enum(['STANDALONE', 'PROJECT', 'COMMUNITY', 'MIXED_USE']).optional(),
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
  builtYear: z.number().int().optional().nullable(),
  totalFloors: z.number().int().optional().nullable(),
  parkingSpaces: z.number().int().optional().nullable(),
  hasConcierge: z.boolean().optional(),
  hasGenerator: z.boolean().optional(),
  hasSolarPower: z.boolean().optional(),
  hasElevator: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasSecurity: z.boolean().optional(),
  hasRooftop: z.boolean().optional(),
  status: z.enum(['OFF_PLAN', 'NEW_BUILD', 'RESALE']).optional(),
  visibility: z.enum(['PUBLIC', 'ELITE_ONLY', 'HIDDEN']).optional(),
  featured: z.boolean().optional(),
  featuredUntil: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional().nullable(),
  youtubeUrls: z.array(z.string().url()).optional(),
  virtualTourUrl: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  highlightedFeatures: z.array(z.string()).optional(),
  developerId: z.string().optional().nullable(),
  locationGuideId: z.string().optional().nullable(),
  agentId: z.string().optional().nullable(),
});

const unitCreateSchema = z.object({
  kind: z.enum(['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL', 'STORAGE', 'PARKING']).optional(),
  name: z.string().optional().nullable(),
  unitNumber: z.string().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  bathrooms: z.number().int().optional().nullable(),
  areaSqm: z.number().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  parkingSpaces: z.number().int().optional().nullable(),
  lifecycle: z.enum(['DRAFT', 'FOR_SALE', 'RESERVED', 'SOLD', 'OWNER_OCCUPIED', 'FOR_RENT', 'RENTED', 'VACANT', 'OFF_MARKET']).optional(),
  ownershipSource: z.enum(['PLATFORM_SOLD', 'EXTERNAL']).optional(),
  ownerName: z.string().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  askingPrice: z.number().optional().nullable(),
  askingCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  rentAmount: z.number().optional().nullable(),
  rentCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional().nullable(),
  generatorAmpere: z.number().int().optional().nullable(),
  images: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  features: z.array(z.string()).optional(),
  views: z.array(z.string()).optional(),
});

// ── GET / — public list ───────────────────────────────────────────────────────

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    const { kind, mohafazat, caza, city, status, featured, search, visibility } = req.query as Record<string, string>;

    // Default to PUBLIC unless admin passes visibility=all
    if (visibility && visibility !== 'all') {
      where.visibility = visibility;
    } else if (!visibility) {
      where.visibility = 'PUBLIC';
    }

    if (kind) where.kind = kind;
    if (mohafazat) where.mohafazat = { contains: mohafazat, mode: 'insensitive' };
    if (caza) where.caza = { contains: caza, mode: 'insensitive' };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (status) where.status = status;
    if (featured === 'true') where.featured = true;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { neighborhood: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [buildings, total] = await Promise.all([
      prisma.building.findMany({
        where,
        include: BUILDING_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.building.count({ where }),
    ]);

    sendPaginated(res, buildings, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /slug/:slug — public by slug ──────────────────────────────────────────

router.get(
  '/slug/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const building = await prisma.building.findUnique({
      where: { slug: req.params.slug },
      include: BUILDING_DETAIL_INCLUDE,
    });

    if (!building) {
      sendNotFound(res, 'Building');
      return;
    }

    prisma.building
      .update({ where: { id: building.id }, data: { views: { increment: 1 } } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => logger.error('Failed to increment building views', err));

    sendSuccess(res, building);
  })
);

// ── GET /:id — public detail ──────────────────────────────────────────────────

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const building = await prisma.building.findUnique({
      where: { id: req.params.id },
      include: BUILDING_DETAIL_INCLUDE,
    });

    if (!building) {
      sendNotFound(res, 'Building');
      return;
    }

    prisma.building
      .update({ where: { id: req.params.id }, data: { views: { increment: 1 } } })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .catch((err: any) => logger.error('Failed to increment building views', err));

    sendSuccess(res, building);
  })
);

// ── GET /:id/units — list units for a building ────────────────────────────────

router.get(
  '/:id/units',
  optionalAuthenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const isAdmin =
      authReq.user && ['ADMIN', 'SUPER_ADMIN', 'PROPERTY_MANAGER'].includes(authReq.user.role);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { buildingId: req.params.id };
    if (!isAdmin) {
      where.lifecycle = { in: ['FOR_SALE', 'FOR_RENT', 'RESERVED', 'SOLD'] };
    }

    const units = await prisma.unit.findMany({
      where,
      include: {
        options: true,
        // Include active listings so the admin UI can show listing status per unit
        listings: {
          where: { status: { notIn: ['ARCHIVED', 'CLOSED'] } },
          select: { id: true, intent: true, status: true, price: true, currency: true, slug: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { unitNumber: 'asc' }],
    });

    sendSuccess(res, units);
  })
);

// ── POST / — create building (admin) ─────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = buildingSchema.parse(req.body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const slug = data.slug || (await generateUniqueSlug(data.title, undefined, tx));
      const createData = {
        ...data,
        slug,
        images: data.images ?? [],
        youtubeUrls: data.youtubeUrls ?? [],
        highlightedFeatures: data.highlightedFeatures ?? [],
        featuredUntil: data.featuredUntil ? new Date(data.featuredUntil) : undefined,
        publishedAt: new Date(),
      };
      return tx.building.create({ data: createData });
    });

    await logAdminAction('CREATE_BUILDING', 'building', result.id, { title: result.title }, authReq);
    sendCreated(res, result, 'Building created successfully');
  })
);

// ── POST /:id/units — create unit under building (admin) ──────────────────────

router.post(
  '/:id/units',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const building = await prisma.building.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!building) { sendNotFound(res, 'Building'); return; }

    const data = unitCreateSchema.parse(req.body);
    const unit = await prisma.unit.create({
      data: {
        ...data,
        buildingId: req.params.id,
        images: data.images ?? [],
        features: data.features ?? [],
        views: data.views ?? [],
        askingPrice: data.askingPrice !== undefined && data.askingPrice !== null ? data.askingPrice : undefined,
        rentAmount: data.rentAmount !== undefined && data.rentAmount !== null ? data.rentAmount : undefined,
      },
      include: { options: true },
    });

    await logAdminAction('CREATE_UNIT', 'unit', unit.id, { buildingId: req.params.id }, authReq);
    sendCreated(res, unit, 'Unit created successfully');
  })
);

// ── PUT /:id — update building (admin) ────────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = buildingSchema.partial().parse(req.body);

    const existing = await prisma.building.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, slug: true },
    });
    if (!existing) { sendNotFound(res, 'Building'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.featuredUntil) updateData.featuredUntil = new Date(data.featuredUntil);

    // Regenerate slug if title changed
    if (data.title && data.title !== existing.title && !data.slug) {
      updateData.slug = await generateUniqueSlug(data.title, req.params.id);
    }

    const result = await prisma.building.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAdminAction('UPDATE_BUILDING', 'building', req.params.id, { title: result.title }, authReq);
    sendSuccess(res, result, 'Building updated successfully');
  })
);

// ── DELETE /:id — delete building (admin) ─────────────────────────────────────

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
    if (!existing) { sendNotFound(res, 'Building'); return; }

    await prisma.building.delete({ where: { id: req.params.id } });

    await logAdminAction('DELETE_BUILDING', 'building', req.params.id, { title: existing.title }, authReq);
    sendSuccess(res, null, 'Building deleted successfully');
  })
);

export default router;
