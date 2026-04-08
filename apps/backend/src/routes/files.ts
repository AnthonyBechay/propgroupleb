import express, { type Request, type Response, type Router } from 'express';
import { getFileStream, getSignedFileUrl, extractKeyFromUrl } from '../services/upload.service.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { Readable } from 'stream';

const router: Router = express.Router();

/**
 * GET /api/files/*
 * Public file proxy - serves R2 files through the backend.
 * This ensures files are accessible even when R2.dev public access is disabled.
 *
 * Supports:
 *   /api/files/properties/slug/images/file.jpg
 *   /api/files/documents/uuid.pdf
 *   etc.
 *
 * Caching: Files are cached for 1 year (immutable) since keys contain timestamps/UUIDs.
 */
router.get(
  '/*',
  asyncHandler(async (req: Request, res: Response) => {
    // Extract the file key from the URL path (everything after /api/files/)
    const key = req.params[0] || req.path.replace(/^\//, '');

    if (!key) {
      res.status(400).json({ error: 'File key is required' });
      return;
    }

    // Prevent path traversal
    if (key.includes('..') || key.startsWith('/')) {
      res.status(400).json({ error: 'Invalid file path' });
      return;
    }

    try {
      const result = await getFileStream(key);

      if (!result.Body) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Set response headers
      if (result.ContentType) {
        res.setHeader('Content-Type', result.ContentType);
      }
      if (result.ContentLength) {
        res.setHeader('Content-Length', result.ContentLength.toString());
      }
      if (result.ContentDisposition) {
        res.setHeader('Content-Disposition', result.ContentDisposition);
      }

      // Cache headers - files are immutable (key contains timestamp + UUID)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Stream the file body to the response
      const body = result.Body;
      if (body instanceof Readable) {
        body.pipe(res);
      } else if (body && typeof (body as any).transformToByteArray === 'function') {
        // AWS SDK v3 SdkStream
        const bytes = await (body as any).transformToByteArray();
        res.end(Buffer.from(bytes));
      } else {
        res.status(500).json({ error: 'Unable to stream file' });
      }
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      logger.error('File proxy error', err);
      res.status(500).json({ error: 'Failed to retrieve file' });
    }
  })
);

/**
 * GET /api/files-signed?key=...
 * Generate a short-lived signed URL (redirect) for a file.
 * Useful for downloads with proper filename.
 */
router.get(
  '-signed',
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.query.key as string;

    if (!key) {
      res.status(400).json({ error: 'File key query parameter is required' });
      return;
    }

    if (key.includes('..')) {
      res.status(400).json({ error: 'Invalid file path' });
      return;
    }

    try {
      const signedUrl = await getSignedFileUrl(key, 3600); // 1 hour
      res.redirect(signedUrl);
    } catch (err: any) {
      logger.error('Signed URL error', err);
      res.status(404).json({ error: 'File not found' });
    }
  })
);

export default router;
