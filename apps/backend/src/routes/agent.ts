import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAgent, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_LIST_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Get agent dashboard stats
router.get(
  '/dashboard/stats',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const agentId = authReq.user.id;

    const [
      totalBuildings,
      activeBuildings,
      totalInquiries,
      pendingInquiries,
      totalViews,
      recentInquiries,
      topBuildings,
    ] = await Promise.all([
      prisma.building.count({ where: { agentId } }),
      prisma.building.count({ where: { agentId, visibility: 'PUBLIC' } }),
      prisma.propertyInquiry.count({ where: { building: { agentId } } }),
      prisma.propertyInquiry.count({
        where: {
          building: { agentId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.building.aggregate({ where: { agentId }, _sum: { views: true } }),
      prisma.propertyInquiry.findMany({
        where: { building: { agentId } },
        include: {
          building: { select: { id: true, title: true, images: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.building.findMany({
        where: { agentId },
        include: { investmentData: true, _count: { select: { inquiries: true, favorites: true } } },
        orderBy: { views: 'desc' },
        take: 5,
      }),
    ]);

    const commissionRate = authReq.user.agentCommissionRate || 3.0;

    sendSuccess(res, {
      overview: {
        totalBuildings,
        activeBuildings,
        totalInquiries,
        pendingInquiries,
        totalViews: totalViews._sum.views || 0,
        commissionRate,
      },
      recentInquiries,
      topBuildings,
    });
  })
);

// Get agent's buildings
router.get(
  '/properties',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { status, search } = req.query;

    const where: Record<string, unknown> = { agentId: authReq.user.id };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [buildings, total] = await Promise.all([
      prisma.building.findMany({
        where,
        include: PROPERTY_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.building.count({ where }),
    ]);

    sendPaginated(res, buildings, buildPaginationResponse(page, limit, total));
  })
);

// Get agent's inquiries
router.get(
  '/inquiries',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { propertyId } = req.query;

    const where: Record<string, unknown> = { building: { agentId: authReq.user.id } };
    if (propertyId) where.buildingId = propertyId;

    const [inquiries, total] = await Promise.all([
      prisma.propertyInquiry.findMany({
        where,
        include: {
          building: { select: { id: true, title: true, images: true, city: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, country: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.propertyInquiry.count({ where }),
    ]);

    sendPaginated(res, inquiries, buildPaginationResponse(page, limit, total));
  })
);

// Get agent profile
router.get(
  '/profile',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const agent = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true, country: true,
        role: true, agentLicenseNumber: true, agentCompany: true, agentBio: true,
        agentCommissionRate: true, membershipTier: true, createdAt: true,
        _count: { select: { managedBuildings: true } },
      },
    });

    if (!agent) { sendNotFound(res, 'Agent'); return; }
    sendSuccess(res, agent);
  })
);

// Update agent profile
router.put(
  '/profile',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { firstName, lastName, phone, agentLicenseNumber, agentCompany, agentBio, agentCommissionRate } = req.body;

    const updated = await prisma.user.update({
      where: { id: authReq.user.id },
      data: {
        firstName, lastName, phone, agentLicenseNumber, agentCompany, agentBio,
        agentCommissionRate: agentCommissionRate ? parseFloat(agentCommissionRate) : undefined,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        agentLicenseNumber: true, agentCompany: true, agentBio: true,
        agentCommissionRate: true, updatedAt: true,
      },
    });

    sendSuccess(res, updated, 'Agent profile updated successfully');
  })
);

// Update building status (agent's own buildings)
router.patch(
  '/properties/:id/status',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['ACTIVE', 'DRAFT', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Bad Request', message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const building = await prisma.building.findUnique({
      where: { id },
      select: { id: true, agentId: true, title: true },
    });

    if (!building) { sendNotFound(res, 'Building'); return; }
    if (building.agentId !== authReq.user.id && authReq.user.role !== 'ADMIN' && authReq.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'You can only update buildings assigned to you' });
      return;
    }

    const updated = await prisma.building.update({
      where: { id },
      data: { status },
      select: { id: true, title: true, status: true, updatedAt: true },
    });

    await logAdminAction('UPDATE_BUILDING_STATUS', 'building', id, {
      title: building.title,
      newStatus: status,
    }, authReq);

    sendSuccess(res, updated, 'Building status updated successfully');
  })
);

// Agent analytics
router.get(
  '/analytics',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const agentId = authReq.user.id;
    const days = parseInt((req.query.period as string) || '30');
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      inquiriesByDay,
      buildingsByCity,
      buildingsByStatus,
      conversionData,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM "PropertyInquiry"
        WHERE building_id IN (SELECT id FROM "Building" WHERE agent_id = ${agentId})
        AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      prisma.building.groupBy({ by: ['city'], where: { agentId }, _count: { city: true } }),
      prisma.building.groupBy({ by: ['status'], where: { agentId }, _count: { status: true } }),
      prisma.building.findMany({
        where: { agentId },
        select: { status: true, _count: { select: { inquiries: true } } },
      }),
    ]);

    const totalInquiries = conversionData.reduce((sum: number, p: { status: string; _count: { inquiries: number } }) => sum + p._count.inquiries, 0);

    sendSuccess(res, {
      inquiriesByDay,
      buildingsByCity,
      buildingsByStatus,
      avgResponseTime: 2.5, // placeholder
      conversionRate: {
        totalInquiries,
      },
    });
  })
);

export default router;
