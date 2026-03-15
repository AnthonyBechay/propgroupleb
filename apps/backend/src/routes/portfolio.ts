import express, { type Request, type Response } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response.js';
import { PROPERTY_WITH_STATS_INCLUDE } from '../utils/prisma-includes.js';
import { ownedPropertySchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = express.Router();

const PORTFOLIO_INCLUDE = {
  property: { include: PROPERTY_WITH_STATS_INCLUDE },
} as const;

// Get portfolio stats - must be before /:id
router.get(
  '/stats',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const owned = await prisma.userOwnedProperty.findMany({
      where: { userId: authReq.user.id },
      include: { property: { include: { investmentData: true } } },
    });

    const totalProperties = owned.length;
    const totalInvestment = owned.reduce((sum: number, p) => sum + p.purchasePrice, 0);
    const totalMortgage = owned.reduce((sum: number, p) => sum + (p.initialMortgage || 0), 0);
    const totalRent = owned.reduce((sum: number, p) => sum + (p.currentRent || 0), 0);
    const averageROI = totalProperties > 0
      ? owned.reduce((sum: number, p) => sum + ((p.property?.investmentData as { expectedROI?: number } | null)?.expectedROI || 0), 0) / totalProperties
      : 0;

    sendSuccess(res, {
      totalProperties,
      totalInvestment,
      totalMortgage,
      totalRent,
      averageROI,
      netWorth: totalInvestment - totalMortgage,
    });
  })
);

// Get user's portfolio
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const owned = await prisma.userOwnedProperty.findMany({
      where: { userId: authReq.user.id },
      include: PORTFOLIO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, owned);
  })
);

// Add property to portfolio
router.post(
  '/',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = ownedPropertySchema.parse(req.body);

    if (validatedData.propertyId) {
      const property = await prisma.property.findUnique({ where: { id: validatedData.propertyId } });
      if (!property) { sendNotFound(res, 'Property'); return; }
    }

    const owned = await prisma.userOwnedProperty.create({
      data: {
        userId: authReq.user.id,
        customName: validatedData.customName,
        purchasePrice: validatedData.purchasePrice,
        purchaseDate: new Date(validatedData.purchaseDate),
        initialMortgage: validatedData.initialMortgage,
        currentRent: validatedData.currentRent,
        notes: validatedData.notes,
        propertyId: validatedData.propertyId,
      },
      include: PORTFOLIO_INCLUDE,
    });

    sendCreated(res, owned, 'Property added to portfolio');
  })
);

// Update owned property
router.put(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = ownedPropertySchema.partial().parse(req.body);

    const existing = await prisma.userOwnedProperty.findFirst({
      where: { id: req.params.id, userId: authReq.user.id },
    });

    if (!existing) { sendNotFound(res, 'Portfolio property'); return; }

    if (validatedData.propertyId) {
      const property = await prisma.property.findUnique({ where: { id: validatedData.propertyId } });
      if (!property) { sendNotFound(res, 'Property'); return; }
    }

    const updated = await prisma.userOwnedProperty.update({
      where: { id: req.params.id },
      data: {
        customName: validatedData.customName,
        purchasePrice: validatedData.purchasePrice,
        purchaseDate: validatedData.purchaseDate ? new Date(validatedData.purchaseDate) : undefined,
        initialMortgage: validatedData.initialMortgage,
        currentRent: validatedData.currentRent,
        notes: validatedData.notes,
        propertyId: validatedData.propertyId,
      },
      include: PORTFOLIO_INCLUDE,
    });

    sendSuccess(res, updated, 'Property updated successfully');
  })
);

// Delete owned property
router.delete(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.userOwnedProperty.findFirst({
      where: { id: req.params.id, userId: authReq.user.id },
    });

    if (!existing) { sendNotFound(res, 'Portfolio property'); return; }

    await prisma.userOwnedProperty.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Property removed from portfolio');
  })
);

export default router;
