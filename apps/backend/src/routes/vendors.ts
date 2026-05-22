import { Router } from 'express';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { authenticateToken, requirePropertyManager, logAdminAction } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { vendorSchema } from '../schemas/index.js';
import type { Request, Response } from 'express';

const router: Router = Router();

// ── GET / — list vendors ──────────────────────────────────────────────────────

router.get(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { trade, isActive } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      isActive: isActive !== undefined ? isActive === 'true' : true,
    };
    if (trade) {
      where.trades = { has: trade };
    }

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: {
          _count: { select: { tickets: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.vendor.count({ where }),
    ]);

    sendPaginated(res, vendors, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /:id — vendor detail ──────────────────────────────────────────────────

router.get(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        tickets: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!vendor) {
      sendNotFound(res, 'Vendor');
      return;
    }

    sendSuccess(res, vendor);
  })
);

// ── POST / — create vendor ────────────────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = vendorSchema.parse(req.body);

    const vendor = await prisma.vendor.create({
      data: {
        ...data,
        trades: data.trades ?? [],
      },
    });

    await logAdminAction('CREATE_VENDOR', 'vendor', vendor.id, { name: vendor.name }, authReq);
    sendCreated(res, vendor, 'Vendor created successfully');
  })
);

// ── PUT /:id — update vendor ──────────────────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = vendorSchema.partial().parse(req.body);

    const existing = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) {
      sendNotFound(res, 'Vendor');
      return;
    }

    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data,
    });

    await logAdminAction('UPDATE_VENDOR', 'vendor', vendor.id, { name: vendor.name }, authReq);
    sendSuccess(res, vendor, 'Vendor updated successfully');
  })
);

// ── DELETE /:id — soft delete vendor ─────────────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    });
    if (!existing) {
      sendNotFound(res, 'Vendor');
      return;
    }

    await prisma.vendor.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await logAdminAction('DEACTIVATE_VENDOR', 'vendor', req.params.id, { name: existing.name }, authReq);
    sendSuccess(res, null, 'Vendor deactivated successfully');
  })
);

export default router;
