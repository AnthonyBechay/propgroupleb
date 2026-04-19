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

    // Idempotent: if already favorited, return the existing record rather than 400.
    // The heart button is a toggle and can race — this avoids breaking UX when the
    // client's cached state disagrees with the backend.
    const existing = await prisma.favoriteProperty.findUnique({
      where: { userId_propertyId: { userId: authReq.user.id, propertyId } },
      include: { property: { include: PROPERTY_WITH_STATS_INCLUDE } },
    });

    if (existing) {
      sendSuccess(res, existing, 'Property is already in your favorites');
      return;
    }

    const favorite = await prisma.favoriteProperty.create({
      data: { userId: authReq.user.id, propertyId },
      include: { property: { include: PROPERTY_WITH_STATS_INCLUDE } },
    });

    sendCreated(res, favorite, 'Property added to favorites');
  })
);

// Toggle favorite — single endpoint that handles the full state transition
// atomically. Preferred by the UI over POST+DELETE which can race.
router.post(
  '/:propertyId/toggle',
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
      await prisma.favoriteProperty.delete({
        where: { userId_propertyId: { userId: authReq.user.id, propertyId } },
      });
      sendSuccess(res, { isFavorited: false }, 'Removed from favorites');
      return;
    }

    await prisma.favoriteProperty.create({
      data: { userId: authReq.user.id, propertyId },
    });
    sendSuccess(res, { isFavorited: true }, 'Added to favorites');
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
