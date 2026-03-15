import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requireSuperAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { USER_ADMIN_SELECT } from '../utils/prisma-includes.js';
import { updateRoleSchema, banUserSchema, inviteAdminSchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Get all users (admin only)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { role, search, isActive } = req.query;

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_ADMIN_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    sendPaginated(res, users, buildPaginationResponse(page, limit, total));
  })
);

// Get single user (admin only)
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        ...USER_ADMIN_SELECT,
        investmentGoals: true,
        bannedBy: true,
        invitedBy: true,
        invitationAcceptedAt: true,
      },
    });

    if (!user) {
      sendNotFound(res, 'User');
      return;
    }

    sendSuccess(res, user);
  })
);

// Update user role (super admin only)
router.put(
  '/:id/role',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { role } = updateRoleSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });

    if (!existing) {
      sendNotFound(res, 'User');
      return;
    }

    if (id === authReq.user.id) {
      res.status(400).json({ error: 'Bad Request', message: 'You cannot change your own role' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, updatedAt: true },
    });

    await logAdminAction('UPDATE_ROLE', 'user', id, {
      oldRole: existing.role,
      newRole: role,
      userEmail: existing.email,
    }, authReq);

    sendSuccess(res, updated, 'User role updated successfully');
  })
);

// Ban user (admin only)
router.post(
  '/:id/ban',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { reason } = banUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true, bannedAt: true },
    });

    if (!existing) { sendNotFound(res, 'User'); return; }
    if (id === authReq.user.id) {
      res.status(400).json({ error: 'Bad Request', message: 'You cannot ban yourself' });
      return;
    }
    if (existing.bannedAt) {
      res.status(400).json({ error: 'Bad Request', message: 'User is already banned' });
      return;
    }
    if ((existing.role === 'ADMIN' || existing.role === 'SUPER_ADMIN') && authReq.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'Only super admins can ban other admins' });
      return;
    }

    const banned = await prisma.user.update({
      where: { id },
      data: { isActive: false, bannedAt: new Date(), bannedBy: authReq.user.id, bannedReason: reason },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, bannedAt: true, bannedReason: true },
    });

    await logAdminAction('BAN_USER', 'user', id, { reason, userEmail: existing.email }, authReq);
    sendSuccess(res, banned, 'User banned successfully');
  })
);

// Unban user (admin only)
router.post(
  '/:id/unban',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, bannedAt: true, bannedReason: true },
    });

    if (!existing) { sendNotFound(res, 'User'); return; }
    if (!existing.bannedAt) {
      res.status(400).json({ error: 'Bad Request', message: 'User is not banned' });
      return;
    }
    if ((existing.role === 'ADMIN' || existing.role === 'SUPER_ADMIN') && authReq.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden', message: 'Only super admins can unban other admins' });
      return;
    }

    const unbanned = await prisma.user.update({
      where: { id },
      data: { isActive: true, bannedAt: null, bannedBy: null, bannedReason: null },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, bannedAt: true },
    });

    await logAdminAction('UNBAN_USER', 'user', id, { previousBanReason: existing.bannedReason, userEmail: existing.email }, authReq);
    sendSuccess(res, unbanned, 'User unbanned successfully');
  })
);

// Delete user (super admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });

    if (!existing) { sendNotFound(res, 'User'); return; }
    if (id === authReq.user.id) {
      res.status(400).json({ error: 'Bad Request', message: 'You cannot delete yourself' });
      return;
    }

    await prisma.user.delete({ where: { id } });
    await logAdminAction('DELETE_USER', 'user', id, { userEmail: existing.email, userRole: existing.role }, authReq);
    sendSuccess(res, null, 'User deleted successfully');
  })
);

// Invite admin (super admin only)
router.post(
  '/invite',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { email, role } = inviteAdminSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      res.status(400).json({ error: 'Bad Request', message: 'User with this email already exists' });
      return;
    }

    const newAdmin = await prisma.user.create({
      data: { email, role, invitedBy: authReq.user.id, isActive: true },
      select: { id: true, email: true, role: true, isActive: true, invitedBy: true, createdAt: true },
    });

    await logAdminAction('INVITE_ADMIN', 'user', newAdmin.id, { email, role, invitedBy: authReq.user.email }, authReq);
    sendCreated(res, newAdmin, 'Admin invited successfully');
  })
);

export default router;
