import express, { type Request, type Response } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAgent, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_LIST_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

// Get agent dashboard stats
router.get(
  '/dashboard/stats',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const agentId = authReq.user.id;

    const [
      totalProperties,
      activeProperties,
      soldProperties,
      totalInquiries,
      pendingInquiries,
      totalViews,
      recentInquiries,
      topProperties,
    ] = await Promise.all([
      prisma.property.count({ where: { agentId } }),
      prisma.property.count({ where: { agentId, availabilityStatus: 'AVAILABLE' } }),
      prisma.property.count({ where: { agentId, availabilityStatus: 'SOLD' } }),
      prisma.propertyInquiry.count({ where: { property: { agentId } } }),
      prisma.propertyInquiry.count({
        where: {
          property: { agentId },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.property.aggregate({ where: { agentId }, _sum: { views: true } }),
      prisma.propertyInquiry.findMany({
        where: { property: { agentId } },
        include: {
          property: { select: { id: true, title: true, price: true, currency: true, images: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.property.findMany({
        where: { agentId },
        include: { investmentData: true, _count: { select: { propertyInquiries: true, favoriteProperties: true } } },
        orderBy: { views: 'desc' },
        take: 5,
      }),
    ]);

    const commissionRate = authReq.user.agentCommissionRate || 3.0;
    const soldPropertiesData = await prisma.property.findMany({
      where: { agentId, availabilityStatus: 'SOLD' },
      select: { price: true },
    });

    const totalSalesValue = soldPropertiesData.reduce((sum: number, p) => sum + p.price, 0);
    const estimatedCommission = (totalSalesValue * commissionRate) / 100;

    sendSuccess(res, {
      overview: {
        totalProperties,
        activeProperties,
        soldProperties,
        totalInquiries,
        pendingInquiries,
        totalViews: totalViews._sum.views || 0,
        totalSalesValue,
        estimatedCommission,
        commissionRate,
      },
      recentInquiries,
      topProperties,
    });
  })
);

// Get agent's properties
router.get(
  '/properties',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { status, availabilityStatus, search } = req.query;

    const where: Record<string, unknown> = { agentId: authReq.user.id };
    if (status) where.status = status;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: PROPERTY_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    sendPaginated(res, properties, buildPaginationResponse(page, limit, total));
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

    const where: Record<string, unknown> = { property: { agentId: authReq.user.id } };
    if (propertyId) where.propertyId = propertyId;

    const [inquiries, total] = await Promise.all([
      prisma.propertyInquiry.findMany({
        where,
        include: {
          property: { select: { id: true, title: true, price: true, currency: true, images: true, country: true, city: true } },
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
        _count: { select: { managedProperties: true } },
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

// Update property status (agent's own properties)
router.patch(
  '/properties/:id/status',
  authenticateToken,
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { availabilityStatus } = req.body;

    if (!['AVAILABLE', 'RESERVED', 'SOLD', 'OFF_MARKET'].includes(availabilityStatus)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid availability status' });
      return;
    }

    const property = await prisma.property.findUnique({
      where: { id },
      select: { id: true, agentId: true, title: true },
    });

    if (!property) { sendNotFound(res, 'Property'); return; }
    if (property.agentId !== authReq.user.id && authReq.user.role !== 'ADMIN' && authReq.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'You can only update properties assigned to you' });
      return;
    }

    const updated = await prisma.property.update({
      where: { id },
      data: { availabilityStatus },
      select: { id: true, title: true, availabilityStatus: true, updatedAt: true },
    });

    await logAdminAction('UPDATE_PROPERTY_STATUS', 'property', id, {
      title: property.title,
      newStatus: availabilityStatus,
    }, authReq);

    sendSuccess(res, updated, 'Property status updated successfully');
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
      propertiesByCountry,
      propertiesByStatus,
      conversionData,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*)::int as count
        FROM "PropertyInquiry"
        WHERE property_id IN (SELECT id FROM "Property" WHERE agent_id = ${agentId})
        AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,
      prisma.property.groupBy({ by: ['country'], where: { agentId }, _count: { country: true } }),
      prisma.property.groupBy({ by: ['availabilityStatus'], where: { agentId }, _count: { availabilityStatus: true } }),
      prisma.property.findMany({
        where: { agentId },
        select: { availabilityStatus: true, _count: { select: { propertyInquiries: true } } },
      }),
    ]);

    const totalInquiries = conversionData.reduce((sum: number, p) => sum + p._count.propertyInquiries, 0);
    const totalSales = conversionData.filter((p: { availabilityStatus: string }) => p.availabilityStatus === 'SOLD').length;
    const conversionPercentage = totalInquiries > 0 ? ((totalSales / totalInquiries) * 100) : 0;

    sendSuccess(res, {
      inquiriesByDay,
      propertiesByCountry,
      propertiesByStatus,
      avgResponseTime: 2.5, // placeholder
      conversionRate: {
        totalInquiries,
        totalSales,
        percentage: parseFloat(conversionPercentage.toFixed(2)),
      },
    });
  })
);

export default router;
