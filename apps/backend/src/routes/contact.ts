import express, { type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { asyncHandler } from '../utils/errors.js';
import rateLimit from 'express-rate-limit';

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
  subject: z.string().min(2).max(200),
  message: z.string().min(10).max(5000),
  propertyId: z.string().optional(),
});

// POST /api/contact - Submit contact form
router.post('/', contactLimiter, asyncHandler(async (req, res) => {
  const data = contactSchema.parse(req.body);

  // propertyId is required on PropertyInquiry, so this endpoint
  // requires it to be provided (contact about a specific property)
  if (!data.propertyId) {
    res.status(400).json({ error: 'propertyId is required for contact submissions' });
    return;
  }

  // Store as an inquiry
  const inquiry = await prisma.propertyInquiry.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      message: `[${data.subject}] ${data.message}`,
      propertyId: data.propertyId,
    },
  });

  res.status(201).json({ success: true, id: inquiry.id });
}));

export default router;
