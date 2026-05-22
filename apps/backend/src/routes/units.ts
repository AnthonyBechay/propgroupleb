import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requireRole, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { UNIT_LIST_INCLUDE, UNIT_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const requirePropertyManager = requireRole('PROPERTY_MANAGER', 'ADMIN', 'SUPER_ADMIN');

// ── Schemas ───────────────────────────────────────────────────────────────────

const unitUpdateSchema = z.object({
  kind: z.enum(['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL', 'STORAGE', 'PARKING']).optional(),
  name: z.string().optional().nullable(),
  unitNumber: z.string().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  bathrooms: z.number().int().optional().nullable(),
  areaSqm: z.number().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  parkingSpaces: z.number().int().optional().nullable(),
  furnishing: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).optional().nullable(),
  ownership: z.enum(['FREEHOLD', 'LEASEHOLD']).optional().nullable(),
  views: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  lifecycle: z.enum(['DRAFT', 'FOR_SALE', 'RESERVED', 'SOLD', 'OWNER_OCCUPIED', 'FOR_RENT', 'RENTED', 'VACANT', 'OFF_MARKET']).optional(),
  ownershipSource: z.enum(['PLATFORM_SOLD', 'EXTERNAL']).optional(),
  ownerName: z.string().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  managedByUserId: z.string().optional().nullable(),
  managementNote: z.string().optional().nullable(),
  managementStartedAt: z.string().optional().nullable(),
  askingPrice: z.number().optional().nullable(),
  askingCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  soldPrice: z.number().optional().nullable(),
  soldCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  soldAt: z.string().optional().nullable(),
  rentAmount: z.number().optional().nullable(),
  rentCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional().nullable(),
  generatorAmpere: z.number().int().optional().nullable(),
  images: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
});

const optionSchema = z.object({
  name: z.string().min(1, 'Option name is required'),
  pricePerSqm: z.number().min(0),
  currency: z.enum(['USD', 'LBP']).optional(),
  initialPayment: z.number().optional().nullable(),
  paymentPlanDetails: z.any().optional().nullable(),
  description: z.string().optional().nullable(),
});

// ── GET / — admin list all units ──────────────────────────────────────────────

router.get(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { buildingId, kind, lifecycle, ownershipSource } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (buildingId) where.buildingId = buildingId;
    if (kind) where.kind = kind;
    if (lifecycle) where.lifecycle = lifecycle;
    if (ownershipSource) where.ownershipSource = ownershipSource;

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: UNIT_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.unit.count({ where }),
    ]);

    sendPaginated(res, units, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /:id — detail (public if FOR_SALE|FOR_RENT, else admin) ───────────────

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const unit = await prisma.unit.findUnique({
      where: { id: req.params.id },
      include: UNIT_DETAIL_INCLUDE,
    });

    if (!unit) { sendNotFound(res, 'Unit'); return; }

    const isPublicLifecycle = ['FOR_SALE', 'FOR_RENT', 'RESERVED', 'SOLD'].includes(unit.lifecycle);
    const isAdmin =
      authReq.user && ['ADMIN', 'SUPER_ADMIN', 'PROPERTY_MANAGER'].includes(authReq.user.role);

    if (!isPublicLifecycle && !isAdmin) {
      sendError(res, 403, 'Access denied');
      return;
    }

    sendSuccess(res, unit);
  })
);

// ── GET /:id/options — get unit options ────────────────────────────────────────

router.get(
  '/:id/options',
  asyncHandler(async (req: Request, res: Response) => {
    const options = await prisma.unitOption.findMany({
      where: { unitId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    sendSuccess(res, options);
  })
);

// ── POST /:id/options — create option ─────────────────────────────────────────

router.post(
  '/:id/options',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = optionSchema.parse(req.body);

    const unit = await prisma.unit.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!unit) { sendNotFound(res, 'Unit'); return; }

    const option = await prisma.unitOption.create({
      data: { ...data, unitId: req.params.id },
    });

    await logAdminAction('CREATE_UNIT_OPTION', 'unitOption', option.id, { unitId: req.params.id, name: option.name }, authReq);
    sendCreated(res, option, 'Unit option created successfully');
  })
);

// ── PUT /:id/options/:optionId — update option ────────────────────────────────

router.put(
  '/:id/options/:optionId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = optionSchema.partial().parse(req.body);

    const existing = await prisma.unitOption.findUnique({
      where: { id: req.params.optionId },
      select: { id: true },
    });
    if (!existing) { sendNotFound(res, 'Unit option'); return; }

    const option = await prisma.unitOption.update({
      where: { id: req.params.optionId },
      data,
    });

    await logAdminAction('UPDATE_UNIT_OPTION', 'unitOption', option.id, { unitId: req.params.id }, authReq);
    sendSuccess(res, option, 'Unit option updated successfully');
  })
);

// ── DELETE /:id/options/:optionId — delete option ─────────────────────────────

router.delete(
  '/:id/options/:optionId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.unitOption.findUnique({
      where: { id: req.params.optionId },
      select: { id: true },
    });
    if (!existing) { sendNotFound(res, 'Unit option'); return; }

    await prisma.unitOption.delete({ where: { id: req.params.optionId } });
    await logAdminAction('DELETE_UNIT_OPTION', 'unitOption', req.params.optionId, { unitId: req.params.id }, authReq);
    sendSuccess(res, null, 'Unit option deleted successfully');
  })
);

// ── PUT /:id — update unit (admin/property_manager) ───────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = unitUpdateSchema.parse(req.body);

    const existing = await prisma.unit.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) { sendNotFound(res, 'Unit'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.managementStartedAt) updateData.managementStartedAt = new Date(data.managementStartedAt);
    if (data.soldAt) updateData.soldAt = new Date(data.soldAt);

    const unit = await prisma.unit.update({
      where: { id: req.params.id },
      data: updateData,
      include: { options: true },
    });

    await logAdminAction('UPDATE_UNIT', 'unit', unit.id, { lifecycle: unit.lifecycle }, authReq);
    sendSuccess(res, unit, 'Unit updated successfully');
  })
);

// ── DELETE /:id — delete unit (admin) ─────────────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.unit.findUnique({
      where: { id: req.params.id },
      select: { id: true, buildingId: true },
    });
    if (!existing) { sendNotFound(res, 'Unit'); return; }

    await prisma.unit.delete({ where: { id: req.params.id } });
    await logAdminAction('DELETE_UNIT', 'unit', req.params.id, { buildingId: existing.buildingId }, authReq);
    sendSuccess(res, null, 'Unit deleted successfully');
  })
);

export default router;
