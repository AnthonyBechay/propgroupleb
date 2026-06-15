import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requirePropertyManager } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { getOrgScope } from '../utils/org-scope.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// All routes require at least PROPERTY_MANAGER
router.use(authenticateToken, requirePropertyManager);

// ── GET /dashboard — management KPIs (scoped to the caller's org) ─────────────

router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const scope = await getOrgScope((req as AuthenticatedRequest).user);
    // Building filters per relation depth. For platform staff these are {}.
    const ticketWhere = scope.all ? {} : { buildingId: { in: scope.buildingIds } };
    const unitWhere = scope.all ? {} : { buildingId: { in: scope.buildingIds } };
    const rentWhere = scope.all ? {} : { tenancy: { unit: { buildingId: { in: scope.buildingIds } } } };
    const billWhere = scope.all ? {} : { buildingId: { in: scope.buildingIds } };

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
        where: { status: { notIn: ['RESOLVED', 'CANCELLED'] }, ...ticketWhere },
        _count: { id: true },
        orderBy: { priority: 'asc' },
      }),
      prisma.rentPayment.count({ where: { status: 'OVERDUE', ...rentWhere } }),
      prisma.utilityBill.count({ where: { status: 'ALLOCATED', ...billWhere } }),
      prisma.unit.count({ where: { lifecycle: 'VACANT', ...unitWhere } }),
      prisma.unit.count({ where: { lifecycle: 'RENTED', ...unitWhere } }),
      prisma.unit.count({ where: { lifecycle: 'FOR_RENT', ...unitWhere } }),
      prisma.unit.count({ where: { ownershipSource: 'EXTERNAL', ...unitWhere } }),
    ]);

    const totalManagedUnits = externalManagedCount + rentedUnitsCount + vacantUnitsCount;

    const ticketsByPriority: Record<string, number> = {};
    for (const row of openTicketsByPriority) {
      ticketsByPriority[row.priority] = (row._count as { id: number } | undefined)?.id ?? 0;
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
    const scope = await getOrgScope((req as AuthenticatedRequest).user);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      lifecycle: { in: ['RENTED', 'FOR_RENT'] },
    };
    if (!scope.all) where.buildingId = { in: scope.buildingIds };
    // A specific building filter is honoured only if it's within the caller's scope.
    if (buildingId && (scope.all || scope.buildingIds.includes(buildingId))) where.buildingId = buildingId;

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
    const scope = await getOrgScope((req as AuthenticatedRequest).user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { status: 'OVERDUE' };
    if (!scope.all) where.tenancy = { unit: { buildingId: { in: scope.buildingIds } } };

    const [payments, total] = await Promise.all([
      prisma.rentPayment.findMany({
        where,
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
      prisma.rentPayment.count({ where }),
    ]);

    sendPaginated(res, payments, buildPaginationResponse(page, limit, total));
  })
);

export default router;
