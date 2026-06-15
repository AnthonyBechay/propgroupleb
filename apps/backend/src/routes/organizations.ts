import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireRole, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendError, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const requireSuperAdmin = requireRole('SUPER_ADMIN');

const ORG_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN'] as const;

function isSuperAdmin(user?: AuthenticatedRequest['user']) {
  return !!user && user.role === 'SUPER_ADMIN';
}

/** The caller's membership in an org (or null). Super admins implicitly have OWNER rights. */
async function getMembership(orgId: string, userId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
}

const MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
} as const;

// ── GET /mine — the orgs the caller belongs to (with their role) ──────────────
router.get(
  '/mine',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: authReq.user.id, isActive: true },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    sendSuccess(res, memberships);
  })
);

// ── GET / — list organizations (super admin: all; others: their own) ──────────
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    if (isSuperAdmin(authReq.user)) {
      const orgs = await prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { members: true, buildings: true } } },
      });
      sendSuccess(res, orgs);
      return;
    }
    const memberships = await prisma.organizationMember.findMany({
      where: { userId: authReq.user.id, isActive: true },
      include: { organization: { include: { _count: { select: { members: true, buildings: true } } } } },
    });
    sendSuccess(res, memberships.map((m) => m.organization));
  })
);

// ── POST / — create an organization (super admin) ─────────────────────────────
const createSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['AGENCY', 'PM_COMPANY']).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  ownerEmail: z.string().email().optional().nullable(), // assign an initial OWNER
});

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'org';
}

router.post(
  '/',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = createSchema.parse(req.body);

    // Unique slug
    let slug = slugify(data.name);
    if (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    let ownerUserId: string | null = null;
    if (data.ownerEmail) {
      const owner = await prisma.user.findUnique({ where: { email: data.ownerEmail.toLowerCase() }, select: { id: true } });
      if (!owner) { sendError(res, 404, 'No registered user with the owner email'); return; }
      ownerUserId = owner.id;
    }

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: data.name,
          slug,
          type: data.type ?? 'PM_COMPANY',
          email: data.email ?? null,
          phone: data.phone ?? null,
          description: data.description ?? null,
          createdBy: authReq.user.id,
        },
      });
      if (ownerUserId) {
        await tx.organizationMember.create({
          data: { organizationId: created.id, userId: ownerUserId, role: 'OWNER' },
        });
        // Promote the owner to PROPERTY_MANAGER so they can reach the PM tooling.
        await tx.user.update({ where: { id: ownerUserId }, data: { role: 'PROPERTY_MANAGER' } }).catch(() => {});
      }
      return created;
    });

    await logAdminAction('CREATE_ORGANIZATION', 'organization', org.id, { name: org.name }, authReq);
    sendCreated(res, org, 'Organization created');
  })
);

// ── Authorization guard for a specific org ────────────────────────────────────
async function authorizeOrg(req: Request, res: Response, roles: readonly string[]): Promise<boolean> {
  const authReq = req as AuthenticatedRequest;
  if (isSuperAdmin(authReq.user)) return true;
  const m = await getMembership(req.params.id, authReq.user.id);
  if (!m || !m.isActive || !roles.includes(m.role)) {
    sendError(res, 403, 'You do not have access to this organization');
    return false;
  }
  return true;
}

// ── GET /:id — org details + members ──────────────────────────────────────────
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await authorizeOrg(req, res, ORG_ROLES))) return;
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: MEMBER_INCLUDE, orderBy: { createdAt: 'asc' } },
        _count: { select: { buildings: true } },
      },
    });
    if (!org) { sendNotFound(res, 'Organization'); return; }
    sendSuccess(res, org);
  })
);

// ── PATCH /:id — update org (super admin or owner/admin) ──────────────────────
const updateSchema = createSchema.partial().omit({ ownerEmail: true }).extend({ isActive: z.boolean().optional() });
router.patch(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await authorizeOrg(req, res, ['OWNER', 'ADMIN']))) return;
    const authReq = req as AuthenticatedRequest;
    const data = updateSchema.parse(req.body);
    const org = await prisma.organization.update({ where: { id: req.params.id }, data });
    await logAdminAction('UPDATE_ORGANIZATION', 'organization', org.id, {}, authReq);
    sendSuccess(res, org, 'Organization updated');
  })
);

// ── GET /:id/buildings — the org's buildings ──────────────────────────────────
router.get(
  '/:id/buildings',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await authorizeOrg(req, res, ORG_ROLES))) return;
    const buildings = await prisma.building.findMany({
      where: { organizationId: req.params.id },
      select: { id: true, title: true, city: true, status: true, images: true, _count: { select: { units: true } } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, buildings);
  })
);

// ── POST /:id/members — add a member / technician by email ────────────────────
const memberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES).default('MANAGER'),
  title: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});
router.post(
  '/:id/members',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await authorizeOrg(req, res, ['OWNER', 'ADMIN']))) return;
    const authReq = req as AuthenticatedRequest;
    const data = memberSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() }, select: { id: true, role: true } });
    if (!user) { sendError(res, 404, 'No registered user with that email. Ask them to sign up first.'); return; }

    const existing = await getMembership(req.params.id, user.id);
    if (existing) { sendError(res, 409, 'That user is already a member of this organization'); return; }

    const member = await prisma.$transaction(async (tx) => {
      const m = await tx.organizationMember.create({
        data: { organizationId: req.params.id, userId: user.id, role: data.role, title: data.title ?? null, phone: data.phone ?? null },
        include: MEMBER_INCLUDE,
      });
      // Ensure the member can reach PM tooling (don't downgrade existing admins).
      if (user.role === 'USER') {
        await tx.user.update({ where: { id: user.id }, data: { role: 'PROPERTY_MANAGER' } }).catch(() => {});
      }
      return m;
    });

    await logAdminAction('ADD_ORG_MEMBER', 'organization', req.params.id, { userId: user.id, role: data.role }, authReq);
    sendCreated(res, member, 'Member added');
  })
);

// ── PATCH /:id/members/:memberId — update role / details / active ─────────────
const memberUpdateSchema = z.object({
  role: z.enum(ORG_ROLES).optional(),
  title: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
router.patch(
  '/:id/members/:memberId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await authorizeOrg(req, res, ['OWNER', 'ADMIN']))) return;
    const authReq = req as AuthenticatedRequest;
    const data = memberUpdateSchema.parse(req.body);
    const member = await prisma.organizationMember.update({
      where: { id: req.params.memberId },
      data,
      include: MEMBER_INCLUDE,
    });
    await logAdminAction('UPDATE_ORG_MEMBER', 'organization', req.params.id, { memberId: req.params.memberId }, authReq);
    sendSuccess(res, member, 'Member updated');
  })
);

// ── DELETE /:id/members/:memberId — remove a member ───────────────────────────
router.delete(
  '/:id/members/:memberId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(await authorizeOrg(req, res, ['OWNER', 'ADMIN']))) return;
    const authReq = req as AuthenticatedRequest;
    await prisma.organizationMember.delete({ where: { id: req.params.memberId } }).catch(() => {});
    await logAdminAction('REMOVE_ORG_MEMBER', 'organization', req.params.id, { memberId: req.params.memberId }, authReq);
    sendSuccess(res, null, 'Member removed');
  })
);

export default router;
