import express, { type Request, type Response, type Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requireSuperAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { USER_ADMIN_SELECT } from '../utils/prisma-includes.js';
import {
  updateRoleSchema,
  banUserSchema,
  createUserSchema,
  adminUpdateUserSchema,
  setPasswordSchema,
} from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

/** What every write here hands back. Never includes the password hash. */
const MANAGED_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  country: true,
  role: true,
  isActive: true,
  bannedAt: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  agentCommissionRate: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Refuse to remove the last super admin.
 *
 * Demoting, deactivating or deleting the only one locks everybody out of role
 * management permanently — there is no console to fix it from, and `db push`
 * deployments have no seed step that would put one back.
 */
async function wouldOrphanSuperAdmins(userId: string, currentRole: string): Promise<boolean> {
  if (currentRole !== 'SUPER_ADMIN') return false;
  const remaining = await prisma.user.count({
    where: { role: 'SUPER_ADMIN', isActive: true, bannedAt: null, id: { not: userId } },
  });
  return remaining === 0;
}

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

// ─── Create a user outright ───────────────────────────────────────────────────
// This replaced an "invite" endpoint that wrote a row with a null password and
// promised an email nothing ever sent, so every account it created was one
// nobody could log into. Setting the password here is the whole point.
router.post(
  '/',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = createUserSchema.parse(req.body);
    const email = data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      sendError(res, 400, 'A user with this email already exists');
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(data.password, 12),
        role: data.role,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        phone: data.phone || null,
        country: data.country || null,
        isActive: data.isActive,
        agentCommissionRate: data.agentCommissionRate ?? null,
        provider: 'local',
        invitedBy: authReq.user.id,
        // Created by a human who already knows who this is — there is nobody
        // left to verify the address to.
        emailVerifiedAt: new Date(),
      },
      select: MANAGED_USER_SELECT,
    });

    // The password is never logged, only the fact that one was set.
    await logAdminAction('CREATE_USER', 'user', user.id, {
      email,
      role: data.role,
      passwordSet: true,
      createdBy: authReq.user.email,
    }, authReq);

    sendCreated(res, user, 'User created');
  })
);

// ─── Edit a user's details and rights ─────────────────────────────────────────
router.put(
  '/:id',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const data = adminUpdateUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!existing) { sendNotFound(res, 'User'); return; }

    // Same rule as the dedicated role endpoint: you don't get to change your
    // own rights, because the mistake is unrecoverable from inside the app.
    if (id === authReq.user.id && data.role && data.role !== existing.role) {
      sendError(res, 400, 'You cannot change your own role');
      return;
    }
    if (id === authReq.user.id && data.isActive === false) {
      sendError(res, 400, 'You cannot deactivate your own account');
      return;
    }

    const losingSuperAdmin =
      (data.role && data.role !== 'SUPER_ADMIN') || data.isActive === false;
    if (losingSuperAdmin && (await wouldOrphanSuperAdmins(id, existing.role))) {
      sendError(res, 400, 'This is the last active super admin — promote someone else first');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    if (data.firstName !== undefined) patch.firstName = data.firstName || null;
    if (data.lastName !== undefined) patch.lastName = data.lastName || null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.country !== undefined) patch.country = data.country || null;
    if (data.role !== undefined) patch.role = data.role;
    if (data.agentCommissionRate !== undefined) patch.agentCommissionRate = data.agentCommissionRate;
    if (data.isActive !== undefined) {
      patch.isActive = data.isActive;
      // Reactivating has to clear the ban too, or the account stays locked out
      // by `bannedAt` while the UI shows it as active.
      if (data.isActive) {
        patch.bannedAt = null;
        patch.bannedBy = null;
        patch.bannedReason = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: patch,
      select: MANAGED_USER_SELECT,
    });

    await logAdminAction('UPDATE_USER', 'user', id, {
      userEmail: existing.email,
      changed: Object.keys(patch),
      ...(data.role && data.role !== existing.role ? { oldRole: existing.role, newRole: data.role } : {}),
    }, authReq);

    sendSuccess(res, updated, 'User updated');
  })
);

// ─── Set a user's password ────────────────────────────────────────────────────
// For the common case where somebody is locked out and the reset email either
// isn't configured or never arrives. Audited, and the value itself is never
// written to the log.
router.post(
  '/:id/password',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { password } = setPasswordSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!existing) { sendNotFound(res, 'User'); return; }

    await prisma.user.update({
      where: { id },
      data: {
        password: await bcrypt.hash(password, 12),
        // Any reset link already in flight must stop working — otherwise the
        // old link silently outranks the password just set.
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    await logAdminAction('SET_USER_PASSWORD', 'user', id, {
      userEmail: existing.email,
      userRole: existing.role,
      setBy: authReq.user.email,
    }, authReq);

    sendSuccess(res, { id }, 'Password updated');
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

    if (role !== 'SUPER_ADMIN' && (await wouldOrphanSuperAdmins(id, existing.role))) {
      sendError(res, 400, 'This is the last active super admin — promote someone else first');
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
    if (await wouldOrphanSuperAdmins(id, existing.role)) {
      sendError(res, 400, 'This is the last active super admin — promote someone else first');
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
    if (await wouldOrphanSuperAdmins(id, existing.role)) {
      sendError(res, 400, 'This is the last active super admin — promote someone else first');
      return;
    }

    await prisma.user.delete({ where: { id } });
    await logAdminAction('DELETE_USER', 'user', id, { userEmail: existing.email, userRole: existing.role }, authReq);
    sendSuccess(res, null, 'User deleted successfully');
  })
);

export default router;
