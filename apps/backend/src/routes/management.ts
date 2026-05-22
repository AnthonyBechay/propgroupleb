import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requirePropertyManager } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

const router: Router = express.Router();

// All routes require at least PROPERTY_MANAGER
router.use(authenticateToken, requirePropertyManager);

// ── GET /dashboard — management KPIs ─────────────────────────────────────────

router.get(
  '/dashboard',
  asyncHandler(async (_req: Request, res: Response) => {
    const [
      openTicketsByPriority,
      overdueRentCount,
      allocatedBillsCount,
      vacantUnitsCount,
      rentedUnitsCount,
      forRentUnitsCount,
      externalManagedCount,
    ] = await prisma.$transaction([
      prisma.maintenanceTicket.groupBy({
        by: ['priority'],
        where: { status: { notIn: ['RESOLVED', 'CANCELLED'] } },
        _count: { id: true },
      }),
      prisma.rentPayment.count({ where: { status: 'OVERDUE' } }),
      prisma.utilityBill.count({ where: { status: 'ALLOCATED' } }),
      prisma.unit.count({ where: { lifecycle: 'VACANT' } }),
      prisma.unit.count({ where: { lifecycle: 'RENTED' } }),
      prisma.unit.count({ where: { lifecycle: 'FOR_RENT' } }),
      prisma.unit.count({ where: { ownershipSource: 'EXTERNAL' } }),
    ]);

    const totalManagedUnits = externalManagedCount + rentedUnitsCount + vacantUnitsCount;

    const ticketsByPriority: Record<string, number> = {};
    for (const row of openTicketsByPriority) {
      ticketsByPriority[row.priority] = row._count.id;
    }

    sendSuccess(res, {
      openTicketsByPriority: ticketsByPriority,
      overdueRentCount,
      allocatedBillsCount,
      vacantUnitsCount,
      rentedUnitsCount,
      forRentUnitsCount,
      totalManagedUnits,
    });
  })
);

// ── GET /rent-roll — rented/for-rent units with active tenancy ────────────────

router.get(
  '/rent-roll',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { buildingId } = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      lifecycle: { in: ['RENTED', 'FOR_RENT'] },
    };
    if (buildingId) where.buildingId = buildingId;

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: {
          building: { select: { id: true, title: true, slug: true, images: true } },
          tenancies: {
            where: { status: 'ACTIVE' },
            include: {
              payments: {
                orderBy: { dueDate: 'desc' },
                take: 1,
              },
            },
          },
          _count: { select: { tenancies: true, tickets: true } },
        },
        orderBy: [{ building: { title: 'asc' } }, { floor: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.unit.count({ where }),
    ]);

    sendPaginated(res, units, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /overdue-rent — overdue rent payments ─────────────────────────────────

router.get(
  '/overdue-rent',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

    const [payments, total] = await Promise.all([
      prisma.rentPayment.findMany({
        where: { status: 'OVERDUE' },
        include: {
          tenancy: {
            include: {
              unit: {
                include: {
                  building: { select: { id: true, title: true, slug: true } },
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.rentPayment.count({ where: { status: 'OVERDUE' } }),
    ]);

    sendPaginated(res, payments, buildPaginationResponse(page, limit, total));
  })
);

export default router;
