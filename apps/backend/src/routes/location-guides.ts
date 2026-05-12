import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const COUNTRIES = ['LEBANON'] as const;

const locationGuideSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  country: z.enum(COUNTRIES),
  imageUrl: z.string().url().nullish().or(z.literal('')),
});

const updateSchema = locationGuideSchema.partial();

// GET /api/location-guides — public list (optionally filtered by country)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { country } = req.query;
    const where: Record<string, unknown> = {};
    if (country && typeof country === 'string' && COUNTRIES.includes(country as any)) {
      where.country = country;
    }

    const guides = await prisma.locationGuide.findMany({
      where,
      orderBy: [{ country: 'asc' }, { title: 'asc' }],
      include: {
        _count: { select: { properties: true } },
      },
    });

    sendSuccess(res, guides);
  })
);

// GET /api/location-guides/:id — public single guide
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const guide = await prisma.locationGuide.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { properties: true } } },
    });
    if (!guide) { sendNotFound(res, 'Location guide'); return; }
    sendSuccess(res, guide);
  })
);

// POST /api/location-guides — admin create
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = locationGuideSchema.parse(req.body);

    const guide = await prisma.locationGuide.create({
      data: {
        title: parsed.title,
        content: parsed.content,
        country: parsed.country,
        imageUrl: parsed.imageUrl || null,
      },
    });

    await logAdminAction('CREATE_LOCATION_GUIDE', 'location_guide', guide.id, {
      title: guide.title,
      country: guide.country,
    }, authReq);

    sendCreated(res, guide, 'Location guide created');
  })
);

// PUT /api/location-guides/:id — admin update
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = updateSchema.parse(req.body);

    const existing = await prisma.locationGuide.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendNotFound(res, 'Location guide'); return; }

    const data: Record<string, unknown> = {};
    if (parsed.title !== undefined) data.title = parsed.title;
    if (parsed.content !== undefined) data.content = parsed.content;
    if (parsed.country !== undefined) data.country = parsed.country;
    if (parsed.imageUrl !== undefined) data.imageUrl = parsed.imageUrl || null;

    const updated = await prisma.locationGuide.update({
      where: { id: req.params.id },
      data,
    });

    await logAdminAction('UPDATE_LOCATION_GUIDE', 'location_guide', updated.id, {
      title: updated.title,
      country: updated.country,
    }, authReq);

    sendSuccess(res, updated, 'Location guide updated');
  })
);

// DELETE /api/location-guides/:id — admin delete (only if no properties linked)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.locationGuide.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { properties: true } } },
    });
    if (!existing) { sendNotFound(res, 'Location guide'); return; }

    if (existing._count.properties > 0) {
      res.status(409).json({
        error: 'Cannot delete',
        message: `${existing._count.properties} propert${existing._count.properties === 1 ? 'y is' : 'ies are'} linked to this guide. Unlink them first.`,
      });
      return;
    }

    await prisma.locationGuide.delete({ where: { id: req.params.id } });

    await logAdminAction('DELETE_LOCATION_GUIDE', 'location_guide', req.params.id, {
      title: existing.title,
      country: existing.country,
    }, authReq);

    sendSuccess(res, null, 'Location guide deleted');
  })
);

export default router;
