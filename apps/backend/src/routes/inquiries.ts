import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_WITH_STATS_INCLUDE } from '../utils/prisma-includes.js';
import { inquirySchema } from '../schemas/index.js';
import type { AuthenticatedRequest, MaybeAuthRequest } from '../types/index.js';

const router: Router = express.Router();

// Create property inquiry (public - no auth required)
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const maybeReq = req as MaybeAuthRequest;
    const validatedData = inquirySchema.parse(req.body);

    const property = await prisma.property.findUnique({ where: { id: validatedData.propertyId } });
    if (!property) { sendNotFound(res, 'Property'); return; }

    const inquiry = await prisma.propertyInquiry.create({
      data: {
        ...validatedData,
        userId: maybeReq.user?.id,
      },
      include: {
        property: { select: { id: true, title: true, price: true, currency: true, country: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    sendCreated(res, inquiry, 'Inquiry submitted successfully');
  })
);

// Get user's inquiries
router.get(
  '/my',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const inquiries = await prisma.propertyInquiry.findMany({
      where: { userId: authReq.user.id },
      include: { property: { include: PROPERTY_WITH_STATS_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, inquiries);
  })
);

// Get all inquiries (admin only)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { propertyId } = req.query;

    const where: Record<string, unknown> = {};
    if (propertyId) where.propertyId = propertyId;

    const [inquiries, total] = await Promise.all([
      prisma.propertyInquiry.findMany({
        where,
        include: {
          property: { select: { id: true, title: true, price: true, currency: true, country: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.propertyInquiry.count({ where }),
    ]);

    sendPaginated(res, inquiries, buildPaginationResponse(page, limit, total));
  })
);

// Get single inquiry (admin only)
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const inquiry = await prisma.propertyInquiry.findUnique({
      where: { id: req.params.id },
      include: {
        property: { include: { developer: true, locationGuide: true, investmentData: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, country: true } },
      },
    });

    if (!inquiry) { sendNotFound(res, 'Inquiry'); return; }
    sendSuccess(res, inquiry);
  })
);

// Delete inquiry (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const inquiry = await prisma.propertyInquiry.findUnique({
      where: { id: req.params.id },
      select: { id: true, propertyId: true, name: true, email: true },
    });

    if (!inquiry) { sendNotFound(res, 'Inquiry'); return; }

    await prisma.propertyInquiry.delete({ where: { id: req.params.id } });
    await logAdminAction('DELETE_INQUIRY', 'inquiry', req.params.id, {
      propertyId: inquiry.propertyId,
      name: inquiry.name,
      email: inquiry.email,
    }, authReq);

    sendSuccess(res, null, 'Inquiry deleted successfully');
  })
);

export default router;
