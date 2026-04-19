import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { PROPERTY_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// ─── Scoped Share Tokens ───────────────────────────────────────────────────────
// POST /api/share
// Body: { propertyId, unitId?, unitOptionId? }
// Creates (or reuses) a ShareToken scoped to PROPERTY / UNIT / UNIT_OPTION.
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { propertyId, unitId, unitOptionId } = req.body as {
      propertyId: string;
      unitId?: string | null;
      unitOptionId?: string | null;
    };

    if (!propertyId) {
      res.status(400).json({ error: 'propertyId is required' });
      return;
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, slug: true },
    });
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    // Validate unit/option belong to property
    if (unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { propertyId: true } });
      if (!unit || unit.propertyId !== propertyId) {
        res.status(400).json({ error: 'Unit does not belong to this property' });
        return;
      }
    }
    if (unitOptionId) {
      if (!unitId) {
        res.status(400).json({ error: 'unitId is required when unitOptionId is provided' });
        return;
      }
      const opt = await prisma.unitOption.findUnique({ where: { id: unitOptionId }, select: { unitId: true } });
      if (!opt || opt.unitId !== unitId) {
        res.status(400).json({ error: 'Option does not belong to the specified unit' });
        return;
      }
    }

    const scope = unitOptionId ? 'UNIT_OPTION' : unitId ? 'UNIT' : 'PROPERTY';

    // Reuse an existing non-revoked token for the same scope if present
    let existing = await prisma.shareToken.findFirst({
      where: {
        propertyId,
        unitId: unitId ?? null,
        unitOptionId: unitOptionId ?? null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    let token: string;
    if (existing) {
      token = existing.token;
    } else {
      const { randomBytes } = await import('crypto');
      token = randomBytes(24).toString('base64url');
      await prisma.shareToken.create({
        data: {
          token,
          scope,
          propertyId,
          unitId: unitId ?? null,
          unitOptionId: unitOptionId ?? null,
          createdById: authReq.user?.id ?? null,
        },
      });

      await logAdminAction('GENERATE_SHARE_LINK', 'shareToken', token, {
        scope,
        propertyId,
        unitId: unitId ?? null,
        unitOptionId: unitOptionId ?? null,
        propertyTitle: property.title,
      }, authReq);
    }

    sendSuccess(res, { token, scope, propertyId, unitId: unitId ?? null, unitOptionId: unitOptionId ?? null }, 'Share link ready');
  })
);

// DELETE /api/share/:token — revoke a scoped share
router.delete(
  '/:token',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const st = await prisma.shareToken.findUnique({ where: { token: req.params.token } });
    if (!st) {
      res.status(404).json({ error: 'Share token not found' });
      return;
    }
    await prisma.shareToken.update({
      where: { token: req.params.token },
      data: { revokedAt: new Date() },
    });
    await logAdminAction('REVOKE_SHARE_LINK', 'shareToken', req.params.token, { scope: st.scope }, authReq);
    sendSuccess(res, null, 'Share link revoked');
  })
);

// GET /api/share/:token — PUBLIC. Resolves both legacy Property.shareToken AND new ShareToken rows.
router.get(
  '/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // 1. Try new ShareToken table (supports unit / option scope)
    const st = await prisma.shareToken.findUnique({ where: { token } });
    if (st && !st.revokedAt && (!st.expiresAt || st.expiresAt > new Date())) {
      const property = await prisma.property.findUnique({
        where: { id: st.propertyId },
        include: {
          ...PROPERTY_DETAIL_INCLUDE,
          documents: {
            where: {
              isPublic: true,
              // Scope documents: if sharing a unit, show project-level + that unit's;
              // if sharing an option, show project-level + that unit's + that option's.
              OR: st.scope === 'UNIT_OPTION'
                ? [
                    { unitId: null, unitOptionId: null }, // project-level
                    { unitId: st.unitId, unitOptionId: null }, // unit-level
                    { unitOptionId: st.unitOptionId! }, // option-level
                  ]
                : st.scope === 'UNIT'
                  ? [
                      { unitId: null, unitOptionId: null },
                      { unitId: st.unitId },
                    ]
                  : undefined,
            },
          },
        },
      });

      if (!property) {
        res.status(404).json({ error: 'Shared resource no longer available' });
        return;
      }

      sendSuccess(res, {
        property,
        share: {
          scope: st.scope,
          unitId: st.unitId,
          unitOptionId: st.unitOptionId,
        },
      });
      return;
    }

    // 2. Fallback to legacy property-level share token
    const property = await prisma.property.findUnique({
      where: { shareToken: token },
      include: {
        ...PROPERTY_DETAIL_INCLUDE,
        documents: { where: { isPublic: true } },
      },
    });
    if (!property) {
      res.status(404).json({ error: 'Share link is invalid or has been revoked' });
      return;
    }
    sendSuccess(res, { property, share: { scope: 'PROPERTY', unitId: null, unitOptionId: null } });
  })
);

export default router;
