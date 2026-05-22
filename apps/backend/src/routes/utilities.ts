import express, { type Request, type Response, type Router } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@propgroup/db';
import { authenticateToken, requirePropertyManager, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { allocateBill } from '../services/billing/allocate.js';
import { meterSchema, meterReadingSchema, utilityBillSchema, billAllocationSchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// METERS
// ═══════════════════════════════════════════════════════════════════

// ── GET /meters — list meters ──────────────────────────────────────────────────

router.get(
  '/meters',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { buildingId, unitId, kind, isActive } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (buildingId) where.buildingId = buildingId;
    if (unitId) where.unitId = unitId;
    if (kind) where.kind = kind;
    where.isActive = isActive !== undefined ? isActive === 'true' : true;

    const meters = await prisma.utilityMeter.findMany({
      where,
      include: {
        building: { select: { id: true, title: true, slug: true } },
        unit: { select: { id: true, unitNumber: true, kind: true } },
        readings: {
          orderBy: { readingAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    sendSuccess(res, meters);
  })
);

// ── POST /meters — create meter ────────────────────────────────────────────────

router.post(
  '/meters',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = meterSchema.parse(req.body);

    const meter = await prisma.utilityMeter.create({
      data: {
        buildingId: data.buildingId,
        unitId: data.unitId ?? null,
        kind: data.kind,
        identifier: data.identifier ?? null,
        unitOfMeasure: data.unitOfMeasure ?? 'kWh',
        notes: data.notes ?? null,
      },
    });

    await logAdminAction('CREATE_METER', 'utilityMeter', meter.id, { buildingId: meter.buildingId, kind: meter.kind }, authReq);
    sendCreated(res, meter, 'Meter created successfully');
  })
);

// ── PUT /meters/:id — update meter ────────────────────────────────────────────

router.put(
  '/meters/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = meterSchema.partial().parse(req.body);

    const existing = await prisma.utilityMeter.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!existing) { sendNotFound(res, 'Meter'); return; }

    const meter = await prisma.utilityMeter.update({ where: { id: req.params.id }, data });
    await logAdminAction('UPDATE_METER', 'utilityMeter', meter.id, { kind: meter.kind }, authReq);
    sendSuccess(res, meter, 'Meter updated successfully');
  })
);

// ── GET /meters/:id/readings — list readings ──────────────────────────────────

router.get(
  '/meters/:id/readings',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

    const meter = await prisma.utilityMeter.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!meter) { sendNotFound(res, 'Meter'); return; }

    const [readings, total] = await Promise.all([
      prisma.utilityReading.findMany({
        where: { meterId: req.params.id },
        orderBy: { readingAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.utilityReading.count({ where: { meterId: req.params.id } }),
    ]);

    sendPaginated(res, readings, buildPaginationResponse(page, limit, total));
  })
);

// ── POST /meters/:id/readings — add reading ────────────────────────────────────

router.post(
  '/meters/:id/readings',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = meterReadingSchema.parse(req.body);

    const meter = await prisma.utilityMeter.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!meter) { sendNotFound(res, 'Meter'); return; }

    const newReadingAt = new Date(data.readingAt);
    const newValue = new Decimal(data.value);

    // Find the most recent previous reading before newReadingAt to compute consumed
    const previousReading = await prisma.utilityReading.findFirst({
      where: {
        meterId: req.params.id,
        readingAt: { lt: newReadingAt },
      },
      orderBy: { readingAt: 'desc' },
      select: { value: true },
    });

    const consumed = previousReading
      ? newValue.sub(new Decimal(previousReading.value))
      : null;

    const reading = await prisma.utilityReading.create({
      data: {
        meterId: req.params.id,
        readingAt: newReadingAt,
        value: newValue,
        consumed: consumed ?? undefined,
        enteredBy: authReq.user.id,
        photoKey: data.photoKey ?? null,
      },
    });

    await logAdminAction('ADD_METER_READING', 'utilityReading', reading.id, { meterId: req.params.id, value: data.value }, authReq);
    sendCreated(res, reading, 'Reading recorded successfully');
  })
);

// ═══════════════════════════════════════════════════════════════════
// BILLS
// ═══════════════════════════════════════════════════════════════════

// ── GET /bills — list bills ───────────────────────────────────────────────────

router.get(
  '/bills',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { buildingId, kind, status } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (buildingId) where.buildingId = buildingId;
    if (kind) where.kind = kind;
    if (status) where.status = status;

    const [bills, total] = await Promise.all([
      prisma.utilityBill.findMany({
        where,
        include: {
          building: { select: { id: true, title: true, slug: true } },
          allocations: {
            select: { id: true, unitId: true, amount: true, currency: true, status: true },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip,
        take: limit,
      }),
      prisma.utilityBill.count({ where }),
    ]);

    sendPaginated(res, bills, buildPaginationResponse(page, limit, total));
  })
);

// ── POST /bills — create bill ─────────────────────────────────────────────────

router.post(
  '/bills',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = utilityBillSchema.parse(req.body);

    const bill = await prisma.utilityBill.create({
      data: {
        buildingId: data.buildingId,
        kind: data.kind,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        totalAmount: new Decimal(data.totalAmount),
        currency: data.currency,
        totalConsumed: data.totalConsumed != null ? new Decimal(data.totalConsumed) : null,
        invoiceFileKey: data.invoiceFileKey ?? null,
        notes: data.notes ?? null,
      },
    });

    await logAdminAction('CREATE_UTILITY_BILL', 'utilityBill', bill.id, {
      buildingId: bill.buildingId,
      kind: bill.kind,
      totalAmount: bill.totalAmount.toString(),
    }, authReq);

    sendCreated(res, bill, 'Bill created successfully');
  })
);

// ── GET /bills/:id — bill with all allocations ────────────────────────────────

router.get(
  '/bills/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const bill = await prisma.utilityBill.findUnique({
      where: { id: req.params.id },
      include: {
        building: { select: { id: true, title: true, slug: true } },
        allocations: {
          include: {
            unit: {
              select: { id: true, unitNumber: true, kind: true, areaSqm: true, generatorAmpere: true },
            },
          },
          orderBy: { unit: { unitNumber: 'asc' } },
        },
      },
    });

    if (!bill) { sendNotFound(res, 'Bill'); return; }
    sendSuccess(res, bill);
  })
);

// ── POST /bills/:id/allocate — run allocation engine ─────────────────────────

router.post(
  '/bills/:id/allocate',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { method, unitShares } = billAllocationSchema.parse(req.body);

    // 1. Load bill
    const bill = await prisma.utilityBill.findUnique({ where: { id: req.params.id } });
    if (!bill) { sendNotFound(res, 'Bill'); return; }

    if (bill.status !== 'RECORDED' && bill.status !== 'ALLOCATED') {
      sendError(res, 400, `Bill status is ${bill.status}; can only allocate RECORDED or ALLOCATED bills`);
      return;
    }

    // Validate FIXED_SHARE unitShares sum to 1 ± 0.01
    if (method === 'FIXED_SHARE') {
      if (!unitShares || unitShares.length === 0) {
        sendError(res, 400, 'FIXED_SHARE requires unitShares array');
        return;
      }
      const sum = unitShares.reduce((acc, s) => acc + s.share, 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        sendError(res, 400, `unitShares must sum to 1.0 (got ${sum.toFixed(4)})`);
        return;
      }
    }

    // 2. Load occupied/owned units — skip DRAFT, FOR_SALE, OFF_MARKET, VACANT
    const units = await prisma.unit.findMany({
      where: {
        buildingId: bill.buildingId,
        lifecycle: { in: ['RENTED', 'FOR_RENT', 'OWNER_OCCUPIED', 'SOLD', 'RESERVED'] },
      },
      select: { id: true, areaSqm: true, generatorAmpere: true },
    });

    if (units.length === 0) {
      sendError(res, 400, 'No eligible units found for allocation');
      return;
    }

    // 3. For METERED: load readings in the bill period, sum consumed per unit
    let readings: Array<{ unitId: string; consumed: Decimal }> = [];
    if (method === 'METERED') {
      const meters = await prisma.utilityMeter.findMany({
        where: {
          buildingId: bill.buildingId,
          kind: bill.kind,
          unitId: { not: null },
        },
        select: { id: true, unitId: true },
      });
      const unitByMeter = new Map(meters.map((m) => [m.id, m.unitId!]));
      const meterIds = meters.map((m) => m.id);

      const rawReadings = await prisma.utilityReading.findMany({
        where: {
          meterId: { in: meterIds },
          readingAt: { gte: bill.periodStart, lte: bill.periodEnd },
          consumed: { not: null },
        },
        select: { meterId: true, consumed: true },
      });

      const consumedMap = new Map<string, Decimal>();
      for (const r of rawReadings) {
        const uid = unitByMeter.get(r.meterId);
        if (uid && r.consumed) {
          const prev = consumedMap.get(uid) ?? new Decimal(0);
          consumedMap.set(uid, prev.add(new Decimal(r.consumed)));
        }
      }
      readings = Array.from(consumedMap.entries()).map(([unitId, consumed]) => ({ unitId, consumed }));
    }

    // 4. For OCCUPANT_COUNT: count active tenancies; owner-occupied with no tenancy = 1
    let occupantCounts: Array<{ unitId: string; count: number }> = [];
    if (method === 'OCCUPANT_COUNT') {
      const tenancyCounts = await prisma.tenancy.groupBy({
        by: ['unitId'],
        where: {
          unitId: { in: units.map((u) => u.id) },
          status: 'ACTIVE',
        },
        _count: { id: true },
      });
      const tenancyMap = new Map(tenancyCounts.map((t) => [t.unitId, t._count.id]));

      const ownerOccupied = await prisma.unit.findMany({
        where: { id: { in: units.map((u) => u.id) }, lifecycle: 'OWNER_OCCUPIED' },
        select: { id: true },
      });
      const ownerOccupiedIds = new Set(ownerOccupied.map((u) => u.id));

      occupantCounts = units.map((u) => ({
        unitId: u.id,
        count: tenancyMap.get(u.id) ?? (ownerOccupiedIds.has(u.id) ? 1 : 0),
      }));
    }

    // 5–6. Run allocation engine
    const results = allocateBill({
      bill: {
        totalAmount: new Decimal(bill.totalAmount),
        currency: bill.currency,
        totalConsumed: bill.totalConsumed != null ? new Decimal(bill.totalConsumed) : null,
      },
      units,
      readings,
      method,
      unitShares,
      occupantCounts,
    });

    // 7–9. In a transaction: delete existing allocations, create new, update bill status
    const updatedBill = await prisma.$transaction(async (tx) => {
      await tx.billAllocation.deleteMany({ where: { billId: req.params.id } });

      await tx.billAllocation.createMany({
        data: results.map((r) => ({
          billId: req.params.id,
          unitId: r.unitId,
          method: r.method as 'METERED' | 'AREA_PROPORTIONAL' | 'FIXED_SHARE' | 'OCCUPANT_COUNT',
          basis: r.basis !== null ? new Decimal(r.basis) : null,
          share: new Decimal(r.share),
          amount: new Decimal(r.amount),
          currency: bill.currency as 'USD' | 'LBP',
        })),
      });

      return tx.utilityBill.update({
        where: { id: req.params.id },
        data: { status: 'ALLOCATED' },
        include: {
          allocations: {
            include: {
              unit: {
                select: { id: true, unitNumber: true, kind: true, areaSqm: true, generatorAmpere: true },
              },
            },
            orderBy: { unit: { unitNumber: 'asc' } },
          },
        },
      });
    });

    await logAdminAction('ALLOCATE_BILL', 'utilityBill', req.params.id, {
      method,
      unitCount: results.length,
    }, authReq);

    sendSuccess(res, updatedBill, 'Bill allocated successfully');
  })
);

// ── PUT /bills/:id — update bill ──────────────────────────────────────────────

router.put(
  '/bills/:id',
  authenticateToken,
  requirePropertyManager,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.utilityBill.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true },
    });
    if (!existing) { sendNotFound(res, 'Bill'); return; }

    const raw = req.body as {
      totalAmount?: number;
      totalConsumed?: number | null;
      invoiceFileKey?: string | null;
      notes?: string | null;
      status?: string;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    if (raw.totalAmount !== undefined) data.totalAmount = new Decimal(raw.totalAmount);
    if (Object.prototype.hasOwnProperty.call(raw, 'totalConsumed')) {
      data.totalConsumed = raw.totalConsumed != null ? new Decimal(raw.totalConsumed) : null;
    }
    if (Object.prototype.hasOwnProperty.call(raw, 'invoiceFileKey')) data.invoiceFileKey = raw.invoiceFileKey;
    if (Object.prototype.hasOwnProperty.call(raw, 'notes')) data.notes = raw.notes;
    // Only allow explicitly setting status to SETTLED
    if (raw.status === 'SETTLED') data.status = 'SETTLED';

    const bill = await prisma.utilityBill.update({ where: { id: req.params.id }, data });
    await logAdminAction('UPDATE_UTILITY_BILL', 'utilityBill', bill.id, { status: bill.status }, authReq);
    sendSuccess(res, bill, 'Bill updated successfully');
  })
);

export default router;
