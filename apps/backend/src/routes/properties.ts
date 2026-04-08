import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { buildPaginationResponse } from '../utils/pagination.js';
import { PROPERTY_LIST_INCLUDE, PROPERTY_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import { propertySchema, propertyQuerySchema, extractInvestmentData, buildInvestmentDataPayload } from '../schemas/index.js';
import { deleteFile, extractKeyFromUrl } from '../services/upload.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Get all properties (public)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = propertyQuerySchema.parse(req.query);
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    // "all" skips the filter (used by admin panel to see everything)
    if (query.visibility && query.visibility !== 'all') {
      where.visibility = query.visibility;
    } else if (!query.visibility) {
      where.visibility = 'PUBLIC';
    }

    if (query.availabilityStatus && query.availabilityStatus !== 'all') {
      where.availabilityStatus = query.availabilityStatus;
    } else if (!query.availabilityStatus) {
      where.availabilityStatus = 'AVAILABLE';
    }

    if (query.country) where.country = query.country;
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.propertyType) where.propertyType = query.propertyType;
    if (query.status) where.status = query.status;
    if (query.furnishingStatus) where.furnishingStatus = query.furnishingStatus;
    if (query.isGoldenVisaEligible) where.isGoldenVisaEligible = true;
    if (query.featured) where.featured = true;
    if (query.hasPool) where.hasPool = true;

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (query.minPrice !== undefined) price.gte = query.minPrice;
      if (query.maxPrice !== undefined) price.lte = query.maxPrice;
      where.price = price;
    }

    if (query.bedrooms !== undefined) {
      where.bedrooms = query.bedrooms;
    } else if (query.minBedrooms !== undefined || query.maxBedrooms !== undefined) {
      const bedrooms: Record<string, number> = {};
      if (query.minBedrooms !== undefined) bedrooms.gte = query.minBedrooms;
      if (query.maxBedrooms !== undefined) bedrooms.lte = query.maxBedrooms;
      where.bedrooms = bedrooms;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { district: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (query.sortBy) {
      const validSortFields = ['price', 'area', 'bedrooms', 'createdAt', 'views'];
      if (validSortFields.includes(query.sortBy)) {
        orderBy = { [query.sortBy]: query.sortOrder || 'asc' };
      }
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: PROPERTY_LIST_INCLUDE,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    sendPaginated(res, properties, buildPaginationResponse(page, limit, total));
  })
);

// Get property by share token (PUBLIC — no auth required)
router.get(
  '/shared/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const property = await prisma.property.findUnique({
      where: { shareToken: req.params.token },
      include: {
        ...PROPERTY_DETAIL_INCLUDE,
        documents: {
          where: { isPublic: true },
          select: {
            id: true,
            title: true,
            description: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            type: true,
            createdAt: true,
          },
        },
      },
    });

    if (!property) {
      res.status(404).json({ error: 'Share link is invalid or has been revoked' });
      return;
    }

    sendSuccess(res, property);
  })
);

// Get single property (public)
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: PROPERTY_DETAIL_INCLUDE,
    });

    if (!property) {
      sendNotFound(res, 'Property');
      return;
    }

    // Increment view count (fire and forget)
    prisma.property.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } },
    }).catch(err => console.error('Failed to increment view count:', err));

    sendSuccess(res, property);
  })
);

// Create property (admin only)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = propertySchema.parse(req.body);
    const { investmentData: investFields, propertyData } = extractInvestmentData(validatedData);

    // Convert date strings to proper DateTime objects for Prisma
    const pd = propertyData as Record<string, unknown>;
    if (pd.featuredUntil && typeof pd.featuredUntil === 'string') {
      pd.featuredUntil = new Date(pd.featuredUntil);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const createData = {
        ...propertyData,
        images: (propertyData as Record<string, unknown>).images as string[] || [],
        highlightedFeatures: (propertyData as Record<string, unknown>).highlightedFeatures as string[] || [],
        publishedAt: new Date(),
      };
      const property = await tx.property.create({ data: createData });

      const hasInvestmentData = Object.values(investFields).some((v) => v !== undefined && v !== null);
      if (hasInvestmentData) {
        const payload = buildInvestmentDataPayload(investFields, validatedData.isGoldenVisaEligible);
        await tx.propertyInvestmentData.create({
          data: {
            propertyId: property.id,
            ...payload,
          },
        });
      }

      return property;
    });

    await logAdminAction('CREATE_PROPERTY', 'property', result.id, {
      title: result.title,
      price: result.price,
      country: result.country,
    }, authReq);

    sendCreated(res, result, 'Property created successfully');
  })
);

// Update property (admin only)
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const validatedData = propertySchema.partial().parse(req.body);

    const existing = await prisma.property.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      sendNotFound(res, 'Property');
      return;
    }

    const { investmentData: investFields, propertyData } = extractInvestmentData(validatedData);

    // Convert date strings to proper DateTime objects for Prisma
    const pd = propertyData as Record<string, unknown>;
    if (pd.featuredUntil && typeof pd.featuredUntil === 'string') {
      pd.featuredUntil = new Date(pd.featuredUntil);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      const property = await tx.property.update({
        where: { id: req.params.id },
        data: pd,
      });

      const hasInvestmentData = Object.values(investFields).some((v) => v !== undefined);
      if (hasInvestmentData) {
        const payload = buildInvestmentDataPayload(investFields, validatedData.isGoldenVisaEligible);
        await tx.propertyInvestmentData.upsert({
          where: { propertyId: req.params.id },
          update: payload,
          create: {
            propertyId: req.params.id,
            ...payload,
          },
        });
      }

      return property;
    });

    await logAdminAction('UPDATE_PROPERTY', 'property', req.params.id, {
      title: result.title,
      price: result.price,
      country: result.country,
    }, authReq);

    sendSuccess(res, result, 'Property updated successfully');
  })
);

// Bulk delete properties (admin only)
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { ids } = req.body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'Please provide an array of property IDs to delete' });
      return;
    }

    // Fetch titles for audit log
    const properties = await prisma.property.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true },
    });

    if (properties.length === 0) {
      res.status(404).json({ error: 'No matching properties found' });
      return;
    }

    // Clean up R2 files for all properties
    await Promise.all(properties.map(p => cleanupPropertyFiles(p.id)));

    await prisma.property.deleteMany({ where: { id: { in: ids } } });

    await logAdminAction('BULK_DELETE_PROPERTIES', 'property', ids.join(','), {
      count: properties.length,
      titles: properties.map(p => p.title),
    }, authReq);

    sendSuccess(res, { deleted: properties.length }, `${properties.length} properties deleted successfully`);
  })
);

// Helper: clean up R2 files for a property (images + documents)
async function cleanupPropertyFiles(propertyId: string) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { images: true, documents: { select: { fileUrl: true } } },
    });
    if (!property) return;

    const urlsToDelete: string[] = [
      ...(property.images || []),
      ...property.documents.map(d => d.fileUrl),
    ];

    for (const url of urlsToDelete) {
      try {
        const key = extractKeyFromUrl(url);
        if (key) await deleteFile(key);
      } catch (err) {
        console.error(`Failed to delete R2 file: ${url}`, err);
      }
    }
  } catch (err) {
    console.error(`Failed to cleanup files for property ${propertyId}:`, err);
  }
}

// Delete property (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;

    const existing = await prisma.property.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true },
    });

    if (!existing) {
      sendNotFound(res, 'Property');
      return;
    }

    // Clean up R2 files before deleting from DB
    await cleanupPropertyFiles(req.params.id);

    await prisma.property.delete({ where: { id: req.params.id } });

    await logAdminAction('DELETE_PROPERTY', 'property', req.params.id, {
      title: existing.title,
    }, authReq);

    sendSuccess(res, null, 'Property deleted successfully');
  })
);

// Generate / get share link (admin only)
router.post(
  '/:id/share',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true, shareToken: true },
    });

    if (!property) { sendNotFound(res, 'Property'); return; }

    let { shareToken } = property;
    if (!shareToken) {
      // Generate a URL-safe random token
      const { randomBytes } = await import('crypto');
      shareToken = randomBytes(24).toString('base64url');
      await prisma.property.update({
        where: { id: req.params.id },
        data: { shareToken },
      });

      await logAdminAction('GENERATE_SHARE_LINK', 'property', req.params.id, {
        title: property.title,
      }, authReq);
    }

    sendSuccess(res, { shareToken }, 'Share link generated');
  })
);

// Revoke share link (admin only)
router.delete(
  '/:id/share',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true },
    });

    if (!property) { sendNotFound(res, 'Property'); return; }

    await prisma.property.update({
      where: { id: req.params.id },
      data: { shareToken: null },
    });

    await logAdminAction('REVOKE_SHARE_LINK', 'property', req.params.id, {
      title: property.title,
    }, authReq);

    sendSuccess(res, null, 'Share link revoked');
  })
);

export default router;
