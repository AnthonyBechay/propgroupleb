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
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image type: ${file.mimetype}. Allowed: jpeg, png, webp, avif`));
    }
  },
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per video
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid video type: ${file.mimetype}. Allowed: mp4, webm`));
    }
  },
});

// POST /api/upload — Upload single image (field: "file")
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

    const result = await uploadFile(file.buffer, file.originalname, file.mimetype, 'properties');
    res.status(201).json({ url: result.url, key: result.key });
  })
);

// POST /api/upload/video — Upload single video
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

    const result = await uploadFile(file.buffer, file.originalname, file.mimetype, 'videos');
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
      res.status(400).json({ error: 'Provide a file URL or key to delete' });
      return;
    }

    await deleteFile(fileKey);
    res.json({ success: true });
  })
);

export default router;
