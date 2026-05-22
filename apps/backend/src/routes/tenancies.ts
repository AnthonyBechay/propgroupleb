import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requirePropertyManager, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { tenancySchema, rentPaymentSchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// ── Inline update schemas ─────────────────────────────────────────────────────

const tenancyUpdateSchema = z.object({
  tenantName: z.string().optional(),
  tenantPhone: z.string().optional().nullable(),
  tenantEmail: z.string().email().optional().nullable(),
  tenantWhatsapp: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  rentAmount: z.number().min(0).optional(),
  rentCurrency: z.enum(['USD', 'LBP']).optional(),
  rentPeriod: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  depositAmount: z.number().optional().nullable(),
  depositCurrency: z.enum(['USD', 'LBP']).optional().nullable(),
  contractFileKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'NOTICE_PERIOD', 'ENDED', 'EVICTED']).optional(),
});

const rentPaymentUpdateSchema = z.object({
  status: z.enum(['DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED']).optional(),
  paidDate: z.string().optional().nullable(),
  receiptFileKey: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const tenancyEndSchema = z.object({
  notes: z.string().optional(),
});

// ── GET / — list tenancies ────────────────────────────────────────────────────

router.get(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { unitId, buildingId, status } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (unitId) where.unitId = unitId;
    if (status) where.status = status;
    if (buildingId) where.unit = { buildingId };

    const [tenancies, total] = await Promise.all([
      prisma.tenancy.findMany({
        where,
        include: {
          unit: {
            include: {
              building: {
                select: { id: true, title: true, slug: true, images: true },
              },
            },
          },
          _count: {
            select: { payments: true },
          },
        },
        orderBy: { startDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.tenancy.count({ where }),
    ]);

    sendPaginated(res, tenancies, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /:id — tenancy detail with payments ───────────────────────────────────

router.get(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const tenancy = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      include: {
        unit: {
          include: {
            building: {
              select: { id: true, title: true, slug: true, images: true },
            },
          },
        },
        payments: {
          orderBy: { dueDate: 'desc' },
          take: 12,
        },
      },
    });

    if (!tenancy) { sendNotFound(res, 'Tenancy'); return; }
    sendSuccess(res, tenancy);
  })
);

// ── POST / — create tenancy ───────────────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = tenancySchema.parse(req.body);

    const unit = await prisma.unit.findUnique({
      where: { id: data.unitId },
      select: { id: true },
    });
    if (!unit) { sendNotFound(res, 'Unit'); return; }

    const tenancy = await prisma.$transaction(async (tx) => {
      const created = await tx.tenancy.create({
        data: {
          ...data,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).unit.update({
        where: { id: data.unitId },
        data: { lifecycle: 'RENTED' },
      });
      return created;
    });

    await logAdminAction('CREATE_TENANCY', 'tenancy', tenancy.id, {
      unitId: data.unitId,
      tenantName: data.tenantName,
    }, authReq);

    sendCreated(res, tenancy, 'Tenancy created successfully');
  })
);

// ── PUT /:id — update tenancy ─────────────────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = tenancyUpdateSchema.parse(req.body);

    const existing = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) { sendNotFound(res, 'Tenancy'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    else if (data.endDate === null) updateData.endDate = null;

    const tenancy = await prisma.tenancy.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAdminAction('UPDATE_TENANCY', 'tenancy', req.params.id, { status: tenancy.status }, authReq);
    sendSuccess(res, tenancy, 'Tenancy updated successfully');
  })
);

// ── POST /:id/end — end a tenancy ─────────────────────────────────────────────

router.post(
  '/:id/end',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { notes } = tenancyEndSchema.parse(req.body);

    const tenancy = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      select: { id: true, unitId: true, status: true },
    });
    if (!tenancy) { sendNotFound(res, 'Tenancy'); return; }
    if (tenancy.status === 'ENDED' || tenancy.status === 'EVICTED') {
      sendError(res, 400, 'Tenancy is already ended');
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.tenancy.update({
        where: { id: req.params.id },
        data: {
          status: 'ENDED',
          endDate: new Date(),
          ...(notes ? { notes } : {}),
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).unit.update({
        where: { id: tenancy.unitId },
        data: { lifecycle: 'VACANT' },
      });
      return updated;
    });

    await logAdminAction('END_TENANCY', 'tenancy', req.params.id, { unitId: tenancy.unitId }, authReq);
    sendSuccess(res, result, 'Tenancy ended successfully');
  })
);

// ── GET /:id/payments — list payments for a tenancy ───────────────────────────

router.get(
  '/:id/payments',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

    const tenancy = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!tenancy) { sendNotFound(res, 'Tenancy'); return; }

    const [payments, total] = await Promise.all([
      prisma.rentPayment.findMany({
        where: { tenancyId: req.params.id },
        orderBy: { dueDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.rentPayment.count({ where: { tenancyId: req.params.id } }),
    ]);

    sendPaginated(res, payments, buildPaginationResponse(page, limit, total));
  })
);

// ── POST /:id/payments — record a payment ─────────────────────────────────────

router.post(
  '/:id/payments',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = rentPaymentSchema.parse(req.body);

    const tenancy = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!tenancy) { sendNotFound(res, 'Tenancy'); return; }

    const payment = await prisma.rentPayment.create({
      data: {
        ...data,
        tenancyId: req.params.id,
        dueDate: new Date(data.dueDate),
        paidDate: data.paidDate ? new Date(data.paidDate) : undefined,
        recordedBy: authReq.user.id,
      },
    });

    await logAdminAction('RECORD_RENT_PAYMENT', 'rentPayment', payment.id, {
      tenancyId: req.params.id,
      amount: String(payment.amount),
      status: payment.status,
    }, authReq);

    sendCreated(res, payment, 'Payment recorded successfully');
  })
);

// ── PUT /:tenancyId/payments/:paymentId — update a payment ────────────────────

router.put(
  '/:tenancyId/payments/:paymentId',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = rentPaymentUpdateSchema.parse(req.body);

    const payment = await prisma.rentPayment.findFirst({
      where: { id: req.params.paymentId, tenancyId: req.params.tenancyId },
      select: { id: true },
    });
    if (!payment) { sendNotFound(res, 'Payment'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.paidDate) updateData.paidDate = new Date(data.paidDate);
    else if (data.paidDate === null) updateData.paidDate = null;

    const updated = await prisma.rentPayment.update({
      where: { id: req.params.paymentId },
      data: updateData,
    });

    await logAdminAction('UPDATE_RENT_PAYMENT', 'rentPayment', req.params.paymentId, {
      tenancyId: req.params.tenancyId,
      status: updated.status,
    }, authReq);

    sendSuccess(res, updated, 'Payment updated successfully');
  })
);

export default router;
