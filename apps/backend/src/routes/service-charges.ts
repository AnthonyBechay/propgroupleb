import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@propgroup/db';
import { authenticateToken, requirePropertyManager, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { serviceChargeSchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const generateSchema = z.object({
  dueDate: z.string().min(1, 'dueDate is required'),
});

// ── GET / — list service charges ──────────────────────────────────────────────

router.get(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { buildingId, isActive } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (buildingId) where.buildingId = buildingId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [charges, total] = await Promise.all([
      prisma.serviceCharge.findMany({
        where,
        include: {
          building: { select: { id: true, title: true, slug: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.serviceCharge.count({ where }),
    ]);

    sendPaginated(res, charges, buildPaginationResponse(page, limit, total));
  })
);

// ── POST / — create service charge ────────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = serviceChargeSchema.parse(req.body);

    const charge = await prisma.serviceCharge.create({
      data: {
        buildingId: data.buildingId,
        name: data.name,
        description: data.description ?? null,
        amount: new Decimal(data.amount),
        currency: data.currency,
        cadence: data.cadence,
        splitMethod: data.splitMethod,
      },
    });

    await logAdminAction('CREATE_SERVICE_CHARGE', 'serviceCharge', charge.id, {
      buildingId: charge.buildingId,
      name: charge.name,
      amount: charge.amount.toString(),
    }, authReq);

    sendCreated(res, charge, 'Service charge created successfully');
  })
);

// ── PUT /:id — update service charge ──────────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = serviceChargeSchema.partial().parse(req.body);

    const existing = await prisma.serviceCharge.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) { sendNotFound(res, 'Service charge'); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { ...data };
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);

    const charge = await prisma.serviceCharge.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logAdminAction('UPDATE_SERVICE_CHARGE', 'serviceCharge', charge.id, { name: charge.name }, authReq);
    sendSuccess(res, charge, 'Service charge updated successfully');
  })
);

// ── DELETE /:id — soft delete (isActive=false) ────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.serviceCharge.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    });
    if (!existing) { sendNotFound(res, 'Service charge'); return; }

    await prisma.serviceCharge.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await logAdminAction('DEACTIVATE_SERVICE_CHARGE', 'serviceCharge', req.params.id, { name: existing.name }, authReq);
    sendSuccess(res, null, 'Service charge deactivated successfully');
  })
);

// ── POST /:id/generate — generate UnitExpenseShare rows ──────────────────────

router.post(
  '/:id/generate',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { dueDate } = generateSchema.parse(req.body);

    // 1. Load the serviceCharge with its building
    const charge = await prisma.serviceCharge.findUnique({
      where: { id: req.params.id },
      include: { building: { select: { id: true, title: true } } },
    });
    if (!charge) { sendNotFound(res, 'Service charge'); return; }
    if (!charge.isActive) {
      sendError(res, 400, 'Cannot generate shares for an inactive service charge');
      return;
    }

    // 2. Load all units in building with relevant lifecycle
    const units = await prisma.unit.findMany({
      where: {
        buildingId: charge.buildingId,
        lifecycle: { in: ['RENTED', 'FOR_RENT', 'OWNER_OCCUPIED', 'SOLD'] },
      },
      select: { id: true, areaSqm: true, lifecycle: true },
    });

    if (units.length === 0) {
      sendSuccess(res, { generated: 0 }, 'No eligible units in this building');
      return;
    }

    const due = new Date(dueDate);
    // First and last day of the same calendar month as dueDate
    const firstOfMonth = new Date(due.getFullYear(), due.getMonth(), 1);
    const firstOfNextMonth = new Date(due.getFullYear(), due.getMonth() + 1, 1);

    // 3. Skip units that already have a share for this charge in the same month
    const existingShares = await prisma.unitExpenseShare.findMany({
      where: {
        serviceChargeId: req.params.id,
        dueDate: { gte: firstOfMonth, lt: firstOfNextMonth },
      },
      select: { unitId: true },
    });
    const alreadyCharged = new Set(existingShares.map((s) => s.unitId));
    const unitsToCharge = units.filter((u) => !alreadyCharged.has(u.id));

    if (unitsToCharge.length === 0) {
      sendSuccess(res, { generated: 0 }, 'All eligible units already have a share for this period');
      return;
    }

    const total = new Decimal(charge.amount);

    // 4. Compute per-unit amount based on splitMethod
    let amounts: Map<string, Decimal>;

    if (charge.splitMethod === 'AREA_PROPORTIONAL') {
      const totalArea = unitsToCharge.reduce((sum, u) => sum + (u.areaSqm ?? 0), 0);
      if (totalArea > 0) {
        amounts = new Map(
          unitsToCharge.map((u) => [
            u.id,
            total.mul(new Decimal(u.areaSqm ?? 0)).div(new Decimal(totalArea)).toDecimalPlaces(2),
          ])
        );
      } else {
        // Fall back to equal split if no area data
        const perUnit = total.div(new Decimal(unitsToCharge.length)).toDecimalPlaces(2);
        amounts = new Map(unitsToCharge.map((u) => [u.id, perUnit]));
      }
    } else {
      // FIXED_SHARE, METERED, OCCUPANT_COUNT — all fall back to equal split
      // (METERED and OCCUPANT_COUNT would need reading/tenancy data; caller should use the billing engine for those)
      const perUnit = total.div(new Decimal(unitsToCharge.length)).toDecimalPlaces(2);
      amounts = new Map(unitsToCharge.map((u) => [u.id, perUnit]));
    }

    // 5. Create UnitExpenseShare rows with status=DUE
    await prisma.unitExpenseShare.createMany({
      data: unitsToCharge.map((u) => ({
        unitId: u.id,
        serviceChargeId: req.params.id,
        description: charge.name,
        amount: amounts.get(u.id) ?? total.div(new Decimal(unitsToCharge.length)).toDecimalPlaces(2),
        currency: charge.currency,
        dueDate: due,
        status: 'DUE' as const,
      })),
    });

    await logAdminAction('GENERATE_SERVICE_CHARGE_SHARES', 'serviceCharge', req.params.id, {
      unitCount: unitsToCharge.length,
      dueDate,
      splitMethod: charge.splitMethod,
    }, authReq);

    sendCreated(res, { generated: unitsToCharge.length }, `Generated ${unitsToCharge.length} expense share(s) for ${due.toISOString().slice(0, 7)}`);
  })
);

export default router;
