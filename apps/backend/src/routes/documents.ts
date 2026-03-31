import express, { type Request, type Response, type Router } from 'express';
import multer from 'multer';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response.js';
import { uploadFile, deleteFile, extractKeyFromUrl } from '../services/upload.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per document
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PDF, images, Word, Excel`));
    }
  },
});

// Get all documents (admin only)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { propertyId, type } = req.query;

    const where: Record<string, unknown> = {};
    if (propertyId) where.propertyId = propertyId;
    if (type) where.type = type;

    const documents = await prisma.propertyDocument.findMany({
      where,
      include: {
        property: {
          select: { id: true, title: true, country: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, documents);
  })
);

// Upload a document linked to a property (admin only)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  documentUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const file = req.file;
    const { propertyId, title, description, type, isPublic } = req.body;

    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    if (!propertyId) {
      res.status(400).json({ error: 'Property ID is required' });
      return;
    }

    if (!title) {
      res.status(400).json({ error: 'Document title is required' });
      return;
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true },
    });

    if (!property) {
      sendNotFound(res, 'Property');
      return;
    }

    // Valid document types from schema
    const validTypes = ['FLOOR_PLAN', 'BROCHURE', 'CONTRACT', 'LEGAL_DOCUMENT', 'CERTIFICATE', 'OTHER'];
    const docType = validTypes.includes(type) ? type : 'OTHER';

    // Upload file to R2
    const uploaded = await uploadFile(file.buffer, file.originalname, file.mimetype, 'documents');

    const document = await prisma.propertyDocument.create({
      data: {
        propertyId,
        title,
        description: description || null,
        type: docType,
        fileUrl: uploaded.url,
        fileSize: file.size,
        mimeType: file.mimetype,
        isPublic: isPublic === 'true',
      },
      include: {
        property: {
          select: { id: true, title: true, country: true },
        },
      },
    });

    await logAdminAction('UPLOAD_DOCUMENT', 'document', document.id, {
      title,
      type: docType,
      propertyId,
      propertyTitle: property.title,
      fileSize: file.size,
    }, authReq);

    sendCreated(res, document, 'Document uploaded successfully');
  })
);

// Delete a document (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const document = await prisma.propertyDocument.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, fileUrl: true, propertyId: true },
    });

    if (!document) {
      sendNotFound(res, 'Document');
      return;
    }

    // Delete from storage
    try {
      const key = extractKeyFromUrl(document.fileUrl);
      if (key) await deleteFile(key);
    } catch (err) {
      console.error('Failed to delete file from storage:', err);
    }

    await prisma.propertyDocument.delete({ where: { id: req.params.id } });

    await logAdminAction('DELETE_DOCUMENT', 'document', req.params.id, {
      title: document.title,
      propertyId: document.propertyId,
    }, authReq);

    sendSuccess(res, null, 'Document deleted successfully');
  })
);

export default router;
