import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response.js';
import * as contentService from '../services/content.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const contentSchema = z.object({
  section: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const mediaSchema = z.object({
  section: z.string().optional(),
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// PUBLIC - Site Media (must be before /:key)
// ============================================

// GET /api/content/media - list all media or by section
router.get(
  '/media',
  asyncHandler(async (req: Request, res: Response) => {
    const { section } = req.query;
    if (section) {
      const media = await contentService.getMediaBySection(section as string);
      sendSuccess(res, media);
    } else {
      const media = await contentService.getAllMedia();
      sendSuccess(res, media);
    }
  })
);

// GET /api/content/media/:key
router.get(
  '/media/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const media = await contentService.getMediaByKey(req.params.key);
    if (!media) { sendNotFound(res, 'Media'); return; }
    sendSuccess(res, media);
  })
);

// PUT /api/content/media/:key (admin)
router.put(
  '/media/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = mediaSchema.parse(req.body);
    const result = await contentService.upsertMedia(req.params.key, data, authReq.user.id);

    await logAdminAction('UPDATE_MEDIA', 'site_media', req.params.key, {
      section: result.section,
      url: result.url,
    }, authReq);

    sendSuccess(res, result, 'Media updated successfully');
  })
);

// DELETE /api/content/media/:key (admin)
router.delete(
  '/media/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await contentService.deleteMedia(req.params.key);
    if (!result) { sendNotFound(res, 'Media'); return; }

    await logAdminAction('DELETE_MEDIA', 'site_media', req.params.key, {
      section: result.section,
    }, authReq);

    sendSuccess(res, null, 'Media deleted successfully');
  })
);

// ============================================
// PUBLIC - Site Content
// ============================================

// GET /api/content/all - list all content (admin only)
router.get(
  '/all',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const content = await contentService.getAllContent();
    sendSuccess(res, content);
  })
);

// GET /api/content?section=hero - get content by section (public)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { section } = req.query;
    if (!section) {
      res.status(400).json({ success: false, message: 'section query parameter is required' });
      return;
    }
    const content = await contentService.getContentBySection(section as string);
    sendSuccess(res, content);
  })
);

// GET /api/content/key/:key
router.get(
  '/key/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const content = await contentService.getContentByKey(req.params.key);
    if (!content) { sendNotFound(res, 'Content'); return; }
    sendSuccess(res, content);
  })
);

// PUT /api/content/:key (admin) - MUST be last (catches all params)
router.put(
  '/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = contentSchema.parse(req.body);
    const result = await contentService.upsertContent(req.params.key, data, authReq.user.id);

    await logAdminAction('UPDATE_CONTENT', 'site_content', req.params.key, {
      section: result.section,
      title: result.title,
    }, authReq);

    sendSuccess(res, result, 'Content updated successfully');
  })
);

// DELETE /api/content/:key (admin) - MUST be last (catches all params)
router.delete(
  '/:key',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const result = await contentService.deleteContent(req.params.key);
    if (!result) { sendNotFound(res, 'Content'); return; }

    await logAdminAction('DELETE_CONTENT', 'site_content', req.params.key, {
      section: result.section,
    }, authReq);

    sendSuccess(res, null, 'Content deleted successfully');
  })
);

export default router;
