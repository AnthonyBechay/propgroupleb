import express from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const propertySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  shortDescription: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  currency: z.string().min(3, 'Currency is required'),

  // Basic Property Details - now required
  propertyType: z.enum(['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO', 'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE']),
  bedrooms: z.number().min(0, 'Bedrooms must be non-negative'),
  bathrooms: z.number().min(0, 'Bathrooms must be non-negative'),
  area: z.number().min(0, 'Area must be positive'),
  builtYear: z.number().optional(),
  floors: z.number().optional(),
  floor: z.number().optional(),
  parkingSpaces: z.number().optional(),

  // Location Details
  country: z.enum(['GEORGIA', 'CYPRUS', 'GREECE', 'LEBANON']),
  city: z.string().optional(),
  district: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  // Property Status & Visibility
  status: z.enum(['OFF_PLAN', 'NEW_BUILD', 'RESALE']),
  availabilityStatus: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'OFF_MARKET']).optional(),
  visibility: z.enum(['PUBLIC', 'ELITE_ONLY', 'HIDDEN']).optional(),

  // Features & Amenities
  furnishingStatus: z.enum(['UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED']).optional(),
  ownershipType: z.enum(['FREEHOLD', 'LEASEHOLD']).optional(),
  isGoldenVisaEligible: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasGym: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasBalcony: z.boolean().optional(),
  hasSecurity: z.boolean().optional(),
  hasElevator: z.boolean().optional(),
  hasCentralAC: z.boolean().optional(),

  // Media
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  virtualTourUrl: z.string().optional(),

  // SEO & Marketing
  slug: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  featured: z.boolean().optional(),
  featuredUntil: z.string().optional(),

  // Highlighted Features
  highlightedFeatures: z.array(z.string()).optional(),

  // Foreign Keys
  developerId: z.string().optional(),
  locationGuideId: z.string().optional(),
  agentId: z.string().optional(),

  // Investment data (nested)
  expectedROI: z.number().optional(),
  rentalYield: z.number().optional(),
  capitalGrowth: z.number().optional(),
  annualAppreciation: z.number().optional(),
  minInvestment: z.number().optional(),
  maxInvestment: z.number().optional(),
  downPaymentPercentage: z.number().optional(),
  paymentPlan: z.string().optional(),
  installmentYears: z.number().optional(),
  completionDate: z.string().optional(),
  handoverDate: z.string().optional(),
  expectedRentalStart: z.string().optional(),
  averageRentPerMonth: z.number().optional(),
  mortgageAvailable: z.boolean().optional(),
  serviceFee: z.number().optional(),
  propertyTax: z.number().optional(),
  goldenVisaMinAmount: z.number().optional()
});

const querySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  country: z.string().optional(),
  city: z.string().optional(),
  propertyType: z.string().optional(),
  status: z.string().optional(),
  availabilityStatus: z.string().optional(),
  visibility: z.string().optional(),
  minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  bedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  minBedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  maxBedrooms: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  isGoldenVisaEligible: z.string().optional().transform(val => val === 'true'),
  featured: z.string().optional().transform(val => val === 'true'),
  hasPool: z.string().optional().transform(val => val === 'true'),
  furnishingStatus: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

// Get all properties (public)
router.get('/', async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    const {
      page,
      limit,
      country,
      city,
      propertyType,
      status,
      availabilityStatus,
      visibility,
      minPrice,
      maxPrice,
      bedrooms,
      minBedrooms,
      maxBedrooms,
      isGoldenVisaEligible,
      featured,
      hasPool,
      furnishingStatus,
      search,
      sortBy,
      sortOrder
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    // By default, only show PUBLIC properties unless visibility is explicitly specified
    if (visibility) {
      where.visibility = visibility;
    } else {
      where.visibility = 'PUBLIC';
    }

    // Only show available properties by default
    if (availabilityStatus) {
      where.availabilityStatus = availabilityStatus;
    } else {
      where.availabilityStatus = 'AVAILABLE';
    }

    if (country) where.country = country;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (propertyType) where.propertyType = propertyType;
    if (status) where.status = status;
    if (furnishingStatus) where.furnishingStatus = furnishingStatus;
    if (isGoldenVisaEligible !== undefined) where.isGoldenVisaEligible = isGoldenVisaEligible;
    if (featured !== undefined) where.featured = featured;
    if (hasPool !== undefined) where.hasPool = hasPool;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (bedrooms !== undefined) {
      where.bedrooms = bedrooms;
    } else if (minBedrooms !== undefined || maxBedrooms !== undefined) {
      where.bedrooms = {};
      if (minBedrooms !== undefined) where.bedrooms.gte = minBedrooms;
      if (maxBedrooms !== undefined) where.bedrooms.lte = maxBedrooms;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { district: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Build orderBy clause
    let orderBy = { createdAt: 'desc' }; // default
    if (sortBy) {
      const validSortFields = ['price', 'area', 'bedrooms', 'createdAt', 'views'];
      if (validSortFields.includes(sortBy)) {
        orderBy = { [sortBy]: sortOrder || 'asc' };
      }
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          developer: true,
          locationGuide: true,
          investmentData: true,
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              agentCompany: true
            }
          },
          _count: {
            select: {
              favoriteProperties: true,
              propertyInquiries: true
            }
          }
        },
        orderBy,
        skip,
        take: limit
      }),
      prisma.property.count({ where })
    ]);

    res.json({
      success: true,
      data: properties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: error.errors
      });
    }

    console.error('Get properties error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch properties'
    });
  }
});

// Get single property (public)
router.get('/:id', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: {
        developer: true,
        locationGuide: true,
        investmentData: true,
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            agentCompany: true,
            agentBio: true
          }
        },
        amenities: true,
        tags: {
          include: {
            tag: true
          }
        },
        reviews: {
          where: { status: 'APPROVED' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        _count: {
          select: {
            favoriteProperties: true,
            propertyInquiries: true,
            reviews: true
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }

    // Increment view count
    await prisma.property.update({
      where: { id: req.params.id },
      data: { views: { increment: 1 } }
    });

    res.json({
      success: true,
      data: property
    });

  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch property'
    });
  }
});

// Create property (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const validatedData = propertySchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      // Separate investment data from property data
      const {
        expectedROI,
        rentalYield,
        capitalGrowth,
        annualAppreciation,
        minInvestment,
        maxInvestment,
        downPaymentPercentage,
        paymentPlan,
        installmentYears,
        completionDate,
        handoverDate,
        expectedRentalStart,
        averageRentPerMonth,
        mortgageAvailable,
        serviceFee,
        propertyTax,
        goldenVisaMinAmount,
        ...propertyData
      } = validatedData;

      // Create the property with all fields
      const property = await tx.property.create({
        data: {
          ...propertyData,
          images: propertyData.images || [],
          highlightedFeatures: propertyData.highlightedFeatures || [],
          publishedAt: new Date()
        }
      });

      // Create investment data if any investment fields are provided
      const hasInvestmentData = expectedROI || rentalYield || capitalGrowth ||
        minInvestment || maxInvestment || paymentPlan || completionDate ||
        annualAppreciation || handoverDate || averageRentPerMonth;

      if (hasInvestmentData) {
        await tx.propertyInvestmentData.create({
          data: {
            propertyId: property.id,
            expectedROI: expectedROI || null,
            rentalYield: rentalYield || null,
            capitalGrowth: capitalGrowth || null,
            annualAppreciation: annualAppreciation || null,
            isGoldenVisaEligible: validatedData.isGoldenVisaEligible || false,
            goldenVisaMinAmount: goldenVisaMinAmount || null,
            minInvestment: minInvestment || null,
            maxInvestment: maxInvestment || null,
            downPaymentPercentage: downPaymentPercentage || null,
            paymentPlan: paymentPlan || null,
            installmentYears: installmentYears || null,
            completionDate: completionDate ? new Date(completionDate) : null,
            handoverDate: handoverDate ? new Date(handoverDate) : null,
            expectedRentalStart: expectedRentalStart ? new Date(expectedRentalStart) : null,
            averageRentPerMonth: averageRentPerMonth || null,
            mortgageAvailable: mortgageAvailable || false,
            serviceFee: serviceFee || null,
            propertyTax: propertyTax || null
          }
        });
      }

      return property;
    });

    // Log admin action
    await logAdminAction('CREATE_PROPERTY', 'property', result.id, {
      title: result.title,
      price: result.price,
      country: result.country,
      propertyType: result.propertyType
    }, req);

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: result
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      });
    }

    console.error('Create property error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create property'
    });
  }
});

// Update property (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const validatedData = propertySchema.partial().parse(req.body);

    // Check if property exists
    const existingProperty = await prisma.property.findUnique({
      where: { id: req.params.id }
    });

    if (!existingProperty) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Separate investment data from property data
      const {
        expectedROI,
        rentalYield,
        capitalGrowth,
        annualAppreciation,
        minInvestment,
        maxInvestment,
        downPaymentPercentage,
        paymentPlan,
        installmentYears,
        completionDate,
        handoverDate,
        expectedRentalStart,
        averageRentPerMonth,
        mortgageAvailable,
        serviceFee,
        propertyTax,
        goldenVisaMinAmount,
        ...propertyData
      } = validatedData;

      // Update the property
      const property = await tx.property.update({
        where: { id: req.params.id },
        data: propertyData
      });

      // Update or create investment data if any investment fields are provided
      const hasInvestmentData = expectedROI !== undefined || rentalYield !== undefined ||
        capitalGrowth !== undefined || minInvestment !== undefined ||
        maxInvestment !== undefined || paymentPlan !== undefined ||
        completionDate !== undefined || annualAppreciation !== undefined ||
        handoverDate !== undefined || averageRentPerMonth !== undefined ||
        mortgageAvailable !== undefined || serviceFee !== undefined ||
        propertyTax !== undefined || goldenVisaMinAmount !== undefined ||
        downPaymentPercentage !== undefined || installmentYears !== undefined ||
        expectedRentalStart !== undefined;

      if (hasInvestmentData) {
        const investmentDataUpdate = {};
        if (expectedROI !== undefined) investmentDataUpdate.expectedROI = expectedROI;
        if (rentalYield !== undefined) investmentDataUpdate.rentalYield = rentalYield;
        if (capitalGrowth !== undefined) investmentDataUpdate.capitalGrowth = capitalGrowth;
        if (annualAppreciation !== undefined) investmentDataUpdate.annualAppreciation = annualAppreciation;
        if (minInvestment !== undefined) investmentDataUpdate.minInvestment = minInvestment;
        if (maxInvestment !== undefined) investmentDataUpdate.maxInvestment = maxInvestment;
        if (downPaymentPercentage !== undefined) investmentDataUpdate.downPaymentPercentage = downPaymentPercentage;
        if (paymentPlan !== undefined) investmentDataUpdate.paymentPlan = paymentPlan;
        if (installmentYears !== undefined) investmentDataUpdate.installmentYears = installmentYears;
        if (completionDate !== undefined) investmentDataUpdate.completionDate = completionDate ? new Date(completionDate) : null;
        if (handoverDate !== undefined) investmentDataUpdate.handoverDate = handoverDate ? new Date(handoverDate) : null;
        if (expectedRentalStart !== undefined) investmentDataUpdate.expectedRentalStart = expectedRentalStart ? new Date(expectedRentalStart) : null;
        if (averageRentPerMonth !== undefined) investmentDataUpdate.averageRentPerMonth = averageRentPerMonth;
        if (mortgageAvailable !== undefined) investmentDataUpdate.mortgageAvailable = mortgageAvailable;
        if (serviceFee !== undefined) investmentDataUpdate.serviceFee = serviceFee;
        if (propertyTax !== undefined) investmentDataUpdate.propertyTax = propertyTax;
        if (goldenVisaMinAmount !== undefined) investmentDataUpdate.goldenVisaMinAmount = goldenVisaMinAmount;
        if (validatedData.isGoldenVisaEligible !== undefined) investmentDataUpdate.isGoldenVisaEligible = validatedData.isGoldenVisaEligible;

        await tx.propertyInvestmentData.upsert({
          where: { propertyId: req.params.id },
          update: investmentDataUpdate,
          create: {
            propertyId: req.params.id,
            expectedROI: expectedROI || null,
            rentalYield: rentalYield || null,
            capitalGrowth: capitalGrowth || null,
            annualAppreciation: annualAppreciation || null,
            isGoldenVisaEligible: validatedData.isGoldenVisaEligible || false,
            goldenVisaMinAmount: goldenVisaMinAmount || null,
            minInvestment: minInvestment || null,
            maxInvestment: maxInvestment || null,
            downPaymentPercentage: downPaymentPercentage || null,
            paymentPlan: paymentPlan || null,
            installmentYears: installmentYears || null,
            completionDate: completionDate ? new Date(completionDate) : null,
            handoverDate: handoverDate ? new Date(handoverDate) : null,
            expectedRentalStart: expectedRentalStart ? new Date(expectedRentalStart) : null,
            averageRentPerMonth: averageRentPerMonth || null,
            mortgageAvailable: mortgageAvailable || false,
            serviceFee: serviceFee || null,
            propertyTax: propertyTax || null
          }
        });
      }

      return property;
    });

    // Log admin action
    await logAdminAction('UPDATE_PROPERTY', 'property', req.params.id, {
      title: result.title,
      price: result.price,
      country: result.country
    }, req);

    res.json({
      success: true,
      message: 'Property updated successfully',
      data: result
    });

  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid input data',
        details: error.errors
      });
    }

    console.error('Update property error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update property'
    });
  }
});

// Delete property (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Check if property exists
    const existingProperty = await prisma.property.findUnique({
      where: { id: req.params.id },
      select: { id: true, title: true }
    });

    if (!existingProperty) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Property not found'
      });
    }

    await prisma.property.delete({
      where: { id: req.params.id }
    });

    // Log admin action
    await logAdminAction('DELETE_PROPERTY', 'property', req.params.id, {
      title: existingProperty.title
    }, req);

    res.json({
      success: true,
      message: 'Property deleted successfully'
    });

  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete property'
    });
  }
});

export default router;
