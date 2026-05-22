import express, { type Request, type Response, type Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requireSuperAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Get admin dashboard stats
router.get(
  '/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalBuildings,
      totalInquiries,
      totalFavorites,
      totalContactMessages,
      totalDocuments,
      newUsersThisWeek,
      newInquiriesThisWeek,
      newUsersThisMonth,
      newInquiriesThisMonth,
      recentUsers,
      recentInquiries,
      recentBuildings,
      recentContacts,
      userStats,
      buildingStats,
      inquiryStatusStats,
      buildingStatusStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.building.count(),
      prisma.propertyInquiry.count(),
      prisma.favoriteProperty.count(),
      prisma.contactMessage.count(),
      prisma.propertyDocument.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.propertyInquiry.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.propertyInquiry.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.propertyInquiry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          buildingTitle: true,
          status: true,
          createdAt: true,
          building: { select: { id: true, title: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.building.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, city: true, status: true, createdAt: true },
      }),
      prisma.contactMessage.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, subject: true, createdAt: true },
      }),
      prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
      prisma.building.groupBy({ by: ['city'], _count: { city: true } }),
      prisma.propertyInquiry.groupBy({ by: ['status'], _count: { status: true } }),
      prisma.building.groupBy({ by: ['status'], _count: { status: true } }),
    ]);

    sendSuccess(res, {
      overview: { totalUsers, totalBuildings, totalInquiries, totalFavorites, totalContactMessages, totalDocuments },
      trends: { newUsersThisWeek, newInquiriesThisWeek, newUsersThisMonth, newInquiriesThisMonth },
      recent: { users: recentUsers, inquiries: recentInquiries, buildings: recentBuildings, contacts: recentContacts },
      statistics: { usersByRole: userStats, buildingsByCity: buildingStats, inquiriesByStatus: inquiryStatusStats, buildingsByStatus: buildingStatusStats },
    });
  })
);

// Get audit logs
router.get(
  '/audit-logs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { action, adminId } = req.query;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (adminId) where.adminId = adminId;

    const [auditLogs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: { admin: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    sendPaginated(res, auditLogs, buildPaginationResponse(page, limit, total));
  })
);

// Create super admin (super admin only)
router.post(
  '/create-super-admin',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Bad Request', message: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const superAdmin = await prisma.user.create({
      data: { email, password: hashedPassword, role: 'SUPER_ADMIN', isActive: true, emailVerifiedAt: new Date() },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAdminAction('CREATE_SUPER_ADMIN', 'user', superAdmin.id, {
      email,
      createdBy: authReq.user.email,
    }, authReq);

    sendCreated(res, superAdmin, 'Super admin created successfully');
  })
);

// System health (admin only)
router.get(
  '/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    await prisma.$queryRaw`SELECT 1`;

    sendSuccess(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    });
  })
);

export default router;
