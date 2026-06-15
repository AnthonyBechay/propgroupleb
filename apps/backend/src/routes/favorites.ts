import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response.js';
import { LISTING_CARD_INCLUDE } from '../utils/prisma-includes.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Narrow shape kept for the add/toggle responses (no need for full card data there).
const LISTING_SELECT = {
  id: true,
  headline: true,
  price: true,
  currency: true,
  intent: true,
  slug: true,
} as const;

// Get user's favorite listings — full card shape so the saved-properties page
// can render the same ListingCard as the catalog (images, location, specs).
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const favorites = await prisma.favoriteProperty.findMany({
      where: { userId: authReq.user.id, listingId: { not: null } },
      include: {
        listing: { include: LISTING_CARD_INCLUDE },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Return the listings directly (filter out any whose listing was deleted).
    const listings = favorites.map((f) => f.listing).filter(Boolean);
    sendSuccess(res, listings);
  })
);

// Add listing to favorites
router.post(
  '/:listingId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { listingId } = req.params;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) { sendNotFound(res, 'Listing'); return; }

    // Idempotent: if already favorited, return the existing record rather than 400.
    // The heart button is a toggle and can race — this avoids breaking UX when the
    // client's cached state disagrees with the backend.
    const existing = await prisma.favoriteProperty.findUnique({
      where: { userId_listingId: { userId: authReq.user.id, listingId } },
      include: { listing: { select: LISTING_SELECT } },
    });

    if (existing) {
      sendSuccess(res, existing, 'Listing is already in your favorites');
      return;
    }

    const favorite = await prisma.favoriteProperty.create({
      data: { userId: authReq.user.id, listingId },
      include: { listing: { select: LISTING_SELECT } },
    });

    sendCreated(res, favorite, 'Listing added to favorites');
  })
);

// Toggle favorite — single endpoint that handles the full state transition
// atomically. Preferred by the UI over POST+DELETE which can race.
router.post(
  '/:listingId/toggle',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { listingId } = req.params;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) { sendNotFound(res, 'Listing'); return; }

    const existing = await prisma.favoriteProperty.findUnique({
      where: { userId_listingId: { userId: authReq.user.id, listingId } },
    });

    if (existing) {
      await prisma.favoriteProperty.delete({
        where: { userId_listingId: { userId: authReq.user.id, listingId } },
      });
      sendSuccess(res, { isFavorited: false }, 'Removed from favorites');
      return;
    }

    await prisma.favoriteProperty.create({
      data: { userId: authReq.user.id, listingId },
    });
    sendSuccess(res, { isFavorited: true }, 'Added to favorites');
  })
);

// Remove listing from favorites
router.delete(
  '/:listingId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { listingId } = req.params;

    const favorite = await prisma.favoriteProperty.findUnique({
      where: { userId_listingId: { userId: authReq.user.id, listingId } },
    });

    if (!favorite) {
      sendNotFound(res, 'Favorite');
      return;
    }

    await prisma.favoriteProperty.delete({
      where: { userId_listingId: { userId: authReq.user.id, listingId } },
    });

    sendSuccess(res, null, 'Listing removed from favorites');
  })
);

// Check if listing is favorited
router.get(
  '/check/:listingId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { listingId } = req.params;

    const favorite = await prisma.favoriteProperty.findUnique({
      where: { userId_listingId: { userId: authReq.user.id, listingId } },
    });

    res.json({ success: true, isFavorited: !!favorite });
  })
);

export default router;
