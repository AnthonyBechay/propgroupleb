import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_WITH_STATS_INCLUDE } from '../utils/prisma-includes.js';
import { inquirySchema } from '../schemas/index.js';
import type { AuthenticatedRequest, MaybeAuthRequest } from '../types/index.js';

const router: Router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many inquiry submissions. Please try again later.' },
});

// Create property inquiry (public - no auth required)
router.post(
  '/',
  inquiryLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const maybeReq = req as MaybeAuthRequest;
    const validatedData = inquirySchema.parse(req.body);

    const property = await prisma.property.findUnique({ where: { id: validatedData.propertyId } });
    if (!property) { sendNotFound(res, 'Property'); return; }

    const inquiry = await prisma.propertyInquiry.create({
      data: {
        ...validatedData,
        propertyTitle: property.title,
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
    const { propertyId, status } = req.query;

    const where: Record<string, unknown> = {};
    if (propertyId) where.propertyId = propertyId;
    if (status && status !== 'ALL') where.status = status;

    const [inquiries, total] = await Promise.all([
      prisma.propertyInquiry.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          propertyTitle: true,
          status: true,
          adminNotes: true,
          repliedAt: true,
          repliedBy: true,
          createdAt: true,
          updatedAt: true,
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

// Update inquiry status / notes (admin only)
router.patch(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

    const existing = await prisma.propertyInquiry.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendNotFound(res, 'Inquiry'); return; }

    const validStatuses = ['NEW', 'IN_PROGRESS', 'REPLIED', 'CANCELLED', 'CLOSED'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    // Auto-set repliedAt/repliedBy when marking as REPLIED
    if (status === 'REPLIED' && !existing.repliedAt) {
      updateData.repliedAt = new Date();
      updateData.repliedBy = authReq.user.email || authReq.user.id;
    }

    const inquiry = await prisma.propertyInquiry.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        property: { select: { id: true, title: true, price: true, currency: true, country: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await logAdminAction('UPDATE_INQUIRY', 'inquiry', req.params.id, {
      status: inquiry.status,
      previousStatus: existing.status,
    }, authReq);

    sendSuccess(res, inquiry, 'Inquiry updated successfully');
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
