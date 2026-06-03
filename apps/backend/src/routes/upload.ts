import express, { type Router } from 'express';
import multer from 'multer';
import { uploadFile, deleteFile, extractKeyFromUrl } from '../services/upload.service.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';

const router: Router = express.Router();

// Multer config — memory storage (buffer goes directly to R2)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
  fileFilter: (_req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    const docTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if ([...imageTypes, ...docTypes].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: jpeg, png, webp, avif, pdf, doc, docx, xls, xlsx`));
    }
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per video
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid video type: ${file.mimetype}. Allowed: mp4, webm, mov, avi, mkv`));
    }
  },
});

// POST /api/upload — Upload single image (field: "file")
// Optional query param: ?propertySlug=my-property for organized storage
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const propertySlug = req.body.propertySlug || req.query.propertySlug;
    const folder = (req.body.folder || req.query.folder || 'properties') as string;
    // Whitelist allowed folders
    const allowedFolders = ['properties', 'buildings', 'units', 'branding', 'general', 'users', 'documents'];
    const safeFolder = allowedFolders.includes(folder) ? folder : 'properties';
    const result = await uploadFile(file.buffer, file.originalname, file.mimetype, safeFolder, {
      propertySlug: propertySlug as string | undefined,
    });
    res.status(201).json({ url: result.url, key: result.key });
  })
);

// POST /api/upload/video — Upload single video
// Optional query param: ?propertySlug=my-property for organized storage
router.post(
  '/video',
  authenticateToken,
  requireAdmin,
  videoUpload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No video file provided' });
      return;
    }

    const propertySlug = req.body.propertySlug || req.query.propertySlug;
    const result = await uploadFile(file.buffer, file.originalname, file.mimetype, 'videos', {
      propertySlug: propertySlug as string | undefined,
    });
    res.status(201).json({ url: result.url, key: result.key });
  })
);

// DELETE /api/upload — Delete a file by URL or key
router.delete(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { url, key } = req.body as { url?: string; key?: string };

    let fileKey = key;
    if (!fileKey && url) {
      fileKey = extractKeyFromUrl(url) || undefined;
    }

    if (!fileKey) {
      // External URL (e.g., unsplash) — not stored in R2, just acknowledge removal
      if (url && url.startsWith('http')) {
        res.json({ success: true, message: 'External URL removed (not stored in R2)' });
        return;
      }
      res.status(400).json({ error: 'Provide a file URL or key to delete' });
      return;
    }

    await deleteFile(fileKey);
    res.json({ success: true });
  })
);

export default router;
