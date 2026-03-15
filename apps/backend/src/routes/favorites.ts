import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response.js';
import { PROPERTY_WITH_STATS_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Get user's favorite properties
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const favorites = await prisma.favoriteProperty.findMany({
      where: { userId: authReq.user.id },
      include: {
        property: { include: PROPERTY_WITH_STATS_INCLUDE },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, favorites);
  })
);

// Add property to favorites
router.post(
  '/:propertyId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { propertyId } = req.params;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) { sendNotFound(res, 'Property'); return; }

    const existing = await prisma.favoriteProperty.findUnique({
      where: { userId_propertyId: { userId: authReq.user.id, propertyId } },
    });

    if (existing) {
      res.status(400).json({ error: 'Already Favorited', message: 'Property is already in your favorites' });
      return;
    }

    const favorite = await prisma.favoriteProperty.create({
      data: { userId: authReq.user.id, propertyId },
      include: { property: { include: PROPERTY_WITH_STATS_INCLUDE } },
    });

    sendCreated(res, favorite, 'Property added to favorites');
  })
);

// Remove property from favorites
router.delete(
  '/:propertyId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { propertyId } = req.params;

    const favorite = await prisma.favoriteProperty.findUnique({
      where: { userId_propertyId: { userId: authReq.user.id, propertyId } },
    });

    if (!favorite) {
      sendNotFound(res, 'Favorite');
      return;
    }

    await prisma.favoriteProperty.delete({
      where: { userId_propertyId: { userId: authReq.user.id, propertyId } },
    });

    sendSuccess(res, null, 'Property removed from favorites');
  })
);

// Check if property is favorited
router.get(
  '/check/:propertyId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { propertyId } = req.params;

    const favorite = await prisma.favoriteProperty.findUnique({
      where: { userId_propertyId: { userId: authReq.user.id, propertyId } },
    });

    res.json({ success: true, isFavorited: !!favorite });
  })
);

export default router;
