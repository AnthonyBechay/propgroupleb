import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { uploadFile } from '../services/upload.service.js';
import { logger } from '../utils/logger.js';
import type { AuthenticatedRequest } from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Owner submissions — the public "list your property, zero commission" intake.
// Anyone with the link can POST a submission (rate-limited, photo count/size
// capped). Admins review in /admin/submissions: contact the seller, then
// approve (creates Building[source=OWNER] + Unit + Listing) or reject.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

// Public endpoint — keep abuse in check: 5 submissions / hour / IP.
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
});

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per photo

// Seller media: up to 12 photos + 3 videos. The multer cap is the video limit;
// oversized images are rejected per-file in the handler.
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 15 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'videos') {
      VIDEO_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Invalid video type: ${file.mimetype}`));
      return;
    }
    IMAGE_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error(`Invalid image type: ${file.mimetype}`));
  },
});

const UNIT_KINDS = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL', 'STORAGE', 'PARKING'] as const;

// Multipart form fields arrive as strings — coerce numerics.
const submissionSchema = z.object({
  sellerName: z.string().min(2).max(100),
  sellerPhone: z.string().min(6).max(30),
  sellerEmail: z.string().email().optional().or(z.literal('')),
  preferredContact: z.enum(['phone', 'whatsapp', 'email']).optional(),
  title: z.string().min(3).max(150),
  description: z.string().max(5000).optional(),
  extraDetails: z.string().max(5000).optional(),
  locationUrl: z.string().url().max(500).optional().or(z.literal('')),
  unitKind: z.enum(UNIT_KINDS).default('APARTMENT'),
  intent: z.enum(['FOR_SALE', 'FOR_RENT']).default('FOR_SALE'),
  bedrooms: z.coerce.number().int().min(0).max(30).optional(),
  bathrooms: z.coerce.number().int().min(0).max(30).optional(),
  areaSqm: z.coerce.number().positive().max(1_000_000).optional(),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  price: z.coerce.number().positive().max(1_000_000_000).optional(),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  negotiable: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  wantsPhotoVisit: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  mohafazat: z.string().max(50).optional(),
  caza: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  neighborhood: z.string().max(80).optional(),
  address: z.string().max(200).optional(),
});

// ── POST / — public: submit a property (multipart, photos in "photos") ────────

router.post(
  '/',
  submitLimiter,
  mediaUpload.fields([{ name: 'photos', maxCount: 12 }, { name: 'videos', maxCount: 3 }]),
  asyncHandler(async (req: Request, res: Response) => {
    const data = submissionSchema.parse(req.body);
    const grouped = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;

    // Upload seller media to R2 under a dedicated prefix.
    const images: string[] = [];
    for (const file of grouped.photos ?? []) {
      if (file.size > MAX_IMAGE_BYTES) continue; // silently skip oversized photos
      try {
        const { url } = await uploadFile(file.buffer, file.originalname, file.mimetype, 'submissions');
        images.push(url);
      } catch (err) {
        logger.error('Submission photo upload failed', err);
      }
    }
    const videos: string[] = [];
    for (const file of grouped.videos ?? []) {
      try {
        const { url } = await uploadFile(file.buffer, file.originalname, file.mimetype, 'submissions');
        videos.push(url);
      } catch (err) {
        logger.error('Submission video upload failed', err);
      }
    }

    const submission = await prisma.propertySubmission.create({
      data: {
        sellerName: data.sellerName,
        sellerPhone: data.sellerPhone,
        sellerEmail: data.sellerEmail || null,
        preferredContact: data.preferredContact ?? null,
        title: data.title,
        description: data.description || null,
        extraDetails: data.extraDetails || null,
        locationUrl: data.locationUrl || null,
        unitKind: data.unitKind,
        intent: data.intent,
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        areaSqm: data.areaSqm ?? null,
        floor: data.floor ?? null,
        price: data.price ?? null,
        currency: data.currency,
        negotiable: data.negotiable,
        mohafazat: data.mohafazat || null,
        caza: data.caza || null,
        city: data.city || null,
        neighborhood: data.neighborhood || null,
        address: data.address || null,
        images,
        videos,
        wantsPhotoVisit: data.wantsPhotoVisit,
      },
    });

    // Only return what the seller needs — not the whole record.
    sendCreated(res, { id: submission.id }, 'Submission received. Our team will contact you after review.');
  })
);

// ── GET / — admin: list submissions (filter by status) ────────────────────────

router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as { page?: string; limit?: string });
    const status = typeof req.query.status === 'string' && ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'].includes(req.query.status)
      ? req.query.status
      : undefined;
    const where = status ? { status: status as never } : {};

    const [items, total] = await Promise.all([
      prisma.propertySubmission.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.propertySubmission.count({ where }),
    ]);
    sendPaginated(res, items, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /:id — admin: detail ──────────────────────────────────────────────────

router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const submission = await prisma.propertySubmission.findUnique({ where: { id: req.params.id } });
    if (!submission) { sendNotFound(res, 'Submission'); return; }
    sendSuccess(res, submission);
  })
);

// ── PATCH /:id — admin: update status / notes (the review cycle) ──────────────

const reviewSchema = z.object({
  status: z.enum(['PENDING', 'IN_REVIEW', 'REJECTED']).optional(), // APPROVED only via /approve
  adminNotes: z.string().max(5000).optional().nullable(),
  // Editable after contacting the seller (e.g. agreeing the final asking price)
  price: z.coerce.number().positive().max(1_000_000_000).optional().nullable(),
  currency: z.enum(['USD', 'LBP']).optional(),
  // Internal follow-up steps before we publish
  visited: z.boolean().optional(),
  dataCollected: z.boolean().optional(),
});

router.patch(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = reviewSchema.parse(req.body);

    const existing = await prisma.propertySubmission.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendNotFound(res, 'Submission'); return; }
    if (existing.status === 'APPROVED' && data.status) {
      sendError(res, 400, 'Approved submissions cannot change status'); return;
    }

    const submission = await prisma.propertySubmission.update({
      where: { id: req.params.id },
      data: {
        ...(data.status ? { status: data.status, reviewedById: authReq.user?.id ?? null, reviewedAt: new Date() } : {}),
        ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.visited !== undefined ? { visited: data.visited } : {}),
        ...(data.dataCollected !== undefined ? { dataCollected: data.dataCollected } : {}),
      },
    });

    await logAdminAction('UPDATE_SUBMISSION', 'property_submission', submission.id, {
      status: submission.status,
    }, authReq);

    sendSuccess(res, submission, 'Submission updated');
  })
);

// ── POST /:id/approve — admin: publish (Building + Unit + Listing) ────────────

async function generateUniqueBuildingSlug(title: string, tx: { building: { findFirst: (args: never) => Promise<unknown> } }): Promise<string> {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60) || 'property';
  let candidate = base;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exists = await (tx as any).building.findFirst({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
    counter++;
    candidate = `${base}-${counter}`;
  }
}

router.post(
  '/:id/approve',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const submission = await prisma.propertySubmission.findUnique({ where: { id: req.params.id } });
    if (!submission) { sendNotFound(res, 'Submission'); return; }
    if (submission.status === 'APPROVED') { sendError(res, 400, 'Submission is already approved'); return; }
    if (!submission.price || submission.price <= 0) {
      sendError(res, 400, 'Set a price on the submission before approving (edit it after contacting the seller)');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const slug = await generateUniqueBuildingSlug(submission.title, tx);
      // Fold the seller's extra notes into the published description.
      const description = [submission.description, submission.extraDetails].filter(Boolean).join('\n\n') || null;
      const building = await tx.building.create({
        data: {
          kind: 'STANDALONE',
          source: 'OWNER',
          title: submission.title,
          description,
          status: 'RESALE',
          visibility: 'PUBLIC',
          mohafazat: submission.mohafazat,
          caza: submission.caza,
          city: submission.city,
          neighborhood: submission.neighborhood,
          address: submission.address,
          locationUrl: submission.locationUrl,
          images: submission.images,
          videoUrl: submission.videos?.[0] ?? null,
          slug,
        },
      });
      const unit = await tx.unit.create({
        data: {
          buildingId: building.id,
          kind: submission.unitKind,
          bedrooms: submission.bedrooms,
          bathrooms: submission.bathrooms,
          areaSqm: submission.areaSqm,
          floor: submission.floor,
          lifecycle: submission.intent === 'FOR_RENT' ? 'FOR_RENT' : 'FOR_SALE',
        },
      });
      const listingSlugBase = submission.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60) || 'listing';
      const listing = await tx.listing.create({
        data: {
          subjectType: 'UNIT',
          unitId: unit.id,
          buildingId: building.id,
          intent: submission.intent,
          price: submission.price,
          currency: submission.currency,
          negotiable: submission.negotiable,
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          highlights: [],
          slug: `${listingSlugBase}-${Math.random().toString(36).slice(2, 6)}`,
          publishedAt: new Date(),
        },
      });
      await tx.propertySubmission.update({
        where: { id: submission.id },
        data: {
          status: 'APPROVED',
          buildingId: building.id,
          reviewedById: authReq.user?.id ?? null,
          reviewedAt: new Date(),
        },
      });
      return { building, unit, listing };
    });

    await logAdminAction('APPROVE_SUBMISSION', 'property_submission', submission.id, {
      buildingId: result.building.id,
      listingId: result.listing.id,
    }, authReq);

    sendSuccess(res, result, 'Submission approved and published');
  })
);

// ── DELETE /:id — admin: remove a submission (spam cleanup) ───────────────────

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.propertySubmission.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) { sendNotFound(res, 'Submission'); return; }
    await prisma.propertySubmission.delete({ where: { id: req.params.id } });
    await logAdminAction('DELETE_SUBMISSION', 'property_submission', req.params.id, {}, authReq);
    sendSuccess(res, { id: req.params.id }, 'Submission deleted');
  })
);

export default router;
