import express, { type Request, type Response, type NextFunction, type Router } from 'express';
import multer from 'multer';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
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
  (req: Request, res: Response, next: NextFunction) => {
    documentUpload.single('file')(req, res, (err) => {
      if (err) {
        const status = (err as any).code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        res.status(status).json({ error: 'Upload error', message: err.message });
        return;
      }
      next();
    });
  },
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
      select: { id: true, title: true, slug: true },
    });

    if (!property) {
      sendNotFound(res, 'Property');
      return;
    }

    // Valid document types from schema
    const validTypes = ['FLOOR_PLAN', 'BROCHURE', 'CONTRACT', 'LEGAL_DOCUMENT', 'CERTIFICATE', 'OTHER'];
    const docType = validTypes.includes(type) ? type : 'OTHER';

    // Upload file to R2 with organized path: properties/{slug}/documents/{type}/{file}
    let uploaded;
    try {
      uploaded = await uploadFile(file.buffer, file.originalname, file.mimetype, 'documents', {
        propertySlug: property.slug || property.title,
        documentType: docType,
        customName: title,
      });
    } catch (uploadErr: any) {
      logger.error('R2 upload failed for document', uploadErr, {
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        propertySlug: property.slug || property.title,
        docType,
      });
      res.status(500).json({
        error: 'Upload failed',
        message: `Failed to upload file to storage: ${uploadErr?.message || 'Unknown error'}. Please try again.`,
      });
      return;
    }

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

// Get a single document's download URL (admin only)
router.get(
  '/:id/download',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const document = await prisma.propertyDocument.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, fileUrl: true, mimeType: true },
    });

    if (!document) {
      sendNotFound(res, 'Document');
      return;
    }

    // Redirect to the file URL for download
    res.redirect(document.fileUrl);
  })
);

// Update document metadata + optional file replacement (admin only)
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    // Accept multipart (with file) or JSON (metadata only)
    const contentType = req.headers['content-type'] || '';
    if (contentType.startsWith('multipart/form-data')) {
      documentUpload.single('file')(req, res, (err) => {
        if (err) {
          const status = (err as any).code === 'LIMIT_FILE_SIZE' ? 413 : 400;
          res.status(status).json({ error: 'Upload error', message: err.message });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { title, description, type, isPublic } = req.body;
    const newFile = req.file;

    const existing = await prisma.propertyDocument.findUnique({
      where: { id: req.params.id },
      include: {
        property: { select: { id: true, title: true, slug: true, country: true } },
      },
    });

    if (!existing) {
      sendNotFound(res, 'Document');
      return;
    }

    // Normalize isPublic (may come as string from multipart)
    const normalizedIsPublic =
      typeof isPublic === 'string' ? isPublic === 'true' : isPublic;

    const validTypes = ['FLOOR_PLAN', 'BROCHURE', 'CONTRACT', 'LEGAL_DOCUMENT', 'CERTIFICATE', 'OTHER'];
    const normalizedType =
      type !== undefined && validTypes.includes(type) ? type : undefined;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (normalizedType !== undefined) updateData.type = normalizedType;
    if (normalizedIsPublic !== undefined) updateData.isPublic = normalizedIsPublic;

    // Handle optional file replacement
    if (newFile) {
      try {
        const uploaded = await uploadFile(
          newFile.buffer,
          newFile.originalname,
          newFile.mimetype,
          'documents',
          {
            propertySlug: existing.property.slug || existing.property.title,
            documentType: (normalizedType || existing.type) as string,
            customName: (title || existing.title) as string,
          }
        );

        // Delete the old file from storage (best-effort)
        try {
          const oldKey = extractKeyFromUrl(existing.fileUrl);
          if (oldKey) await deleteFile(oldKey);
        } catch (delErr) {
          logger.error('Failed to delete old document file', delErr);
        }

        updateData.fileUrl = uploaded.url;
        updateData.fileSize = newFile.size;
        updateData.mimeType = newFile.mimetype;
      } catch (uploadErr: any) {
        logger.error('R2 upload failed for document replacement', uploadErr, {
          fileName: newFile.originalname,
          mimeType: newFile.mimetype,
          documentId: req.params.id,
        });
        res.status(500).json({
          error: 'Upload failed',
          message: `Failed to replace file: ${uploadErr?.message || 'Unknown error'}`,
        });
        return;
      }
    }

    const updated = await prisma.propertyDocument.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        property: { select: { id: true, title: true, country: true } },
      },
    });

    await logAdminAction('UPDATE_DOCUMENT', 'document', req.params.id, {
      title: updated.title,
      propertyId: updated.property.id,
      fileReplaced: !!newFile,
    }, authReq);

    sendSuccess(res, updated, 'Document updated successfully');
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
      logger.error('Failed to delete file from storage', err);
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
