import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import rateLimit from 'express-rate-limit';
import { sendContactConfirmation, notifyAdminOfInquiry } from '../services/email.service.js';

const router: Router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many contact submissions. Please try again later.' },
});

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
});

// POST /api/contact — Submit contact form (public)
router.post('/', contactLimiter, asyncHandler(async (req: Request, res: Response) => {
  const data = contactSchema.parse(req.body);

  const contact = await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
    },
  });

  // Send email notifications (fire and forget)
  sendContactConfirmation(data.email, data.name).catch(err =>
    logger.error('Failed to send contact confirmation', err)
  );

  notifyAdminOfInquiry({
    name: data.name,
    email: data.email,
    phone: data.phone,
    message: data.message,
  }).catch(err => logger.error('Failed to send admin notification', err));

  res.status(201).json({ success: true, id: contact.id });
}));

// GET /api/contact — List all contact messages (admin only)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.contactMessage.count(),
    ]);

    sendPaginated(res, messages, buildPaginationResponse(page, limit, total));
  })
);

// PATCH /api/contact/:id/read — Mark as read (admin only)
router.patch(
  '/:id/read',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const message = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    sendSuccess(res, message);
  })
);

// DELETE /api/contact/:id — Delete contact message (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    await prisma.contactMessage.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 'Contact message deleted');
  })
);

export default router;
