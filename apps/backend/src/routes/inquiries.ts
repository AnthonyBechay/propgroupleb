import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import rateLimit from 'express-rate-limit';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { inquirySchema } from '../schemas/index.js';
import { sendInquiryConfirmation, notifyAdminOfInquiry } from '../services/email.service.js';
import type { AuthenticatedRequest, MaybeAuthRequest } from '../types/index.js';

const router: Router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many inquiry submissions. Please try again later.' },
});

// Create building inquiry (public - no auth required)
router.post(
  '/',
  inquiryLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const maybeReq = req as MaybeAuthRequest;
    const validatedData = inquirySchema.parse(req.body);

    const building = await prisma.building.findUnique({ where: { id: validatedData.buildingId ?? '' } });
    if (!building) { sendNotFound(res, 'Building'); return; }

    const inquiry = await prisma.propertyInquiry.create({
      data: {
        ...validatedData,
        buildingTitle: building.title,
        userId: maybeReq.user?.id,
      },
      include: {
        building: { select: { id: true, title: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    // Send email notifications (fire and forget)
    sendInquiryConfirmation(validatedData.email, {
      name: validatedData.name,
      propertyTitle: building.title,
    }).catch(err => logger.error('Failed to send inquiry confirmation', err));

    notifyAdminOfInquiry({
      name: validatedData.name,
      email: validatedData.email,
      phone: validatedData.phone,
      message: validatedData.message,
      propertyTitle: building.title,
    }).catch(err => logger.error('Failed to send admin notification', err));

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
      include: { building: { select: { id: true, title: true } } },
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
    if (propertyId) where.buildingId = propertyId;
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
          buildingTitle: true,
          status: true,
          adminNotes: true,
          repliedAt: true,
          repliedBy: true,
          createdAt: true,
          updatedAt: true,
          building: { select: { id: true, title: true } },
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
        building: { select: { id: true, title: true } },
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
        building: { select: { id: true, title: true } },
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

// Bulk delete inquiries (admin only)
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Please provide an array of inquiry IDs to delete' });
      return;
    }

    const count = await prisma.propertyInquiry.deleteMany({
      where: { id: { in: ids } },
    });

    await logAdminAction('BULK_DELETE_INQUIRIES', 'inquiry', ids.join(','), {
      count: count.count,
    }, authReq);

    sendSuccess(res, { deleted: count.count }, `${count.count} inquiries deleted successfully`);
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
      select: { id: true, buildingId: true, name: true, email: true },
    });

    if (!inquiry) { sendNotFound(res, 'Inquiry'); return; }

    await prisma.propertyInquiry.delete({ where: { id: req.params.id } });
    await logAdminAction('DELETE_INQUIRY', 'inquiry', req.params.id, {
      buildingId: inquiry.buildingId,
      name: inquiry.name,
      email: inquiry.email,
    }, authReq);

    sendSuccess(res, null, 'Inquiry deleted successfully');
  })
);

export default router;
