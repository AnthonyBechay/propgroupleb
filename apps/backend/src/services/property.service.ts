import { prisma } from '@propgroup/db';
import { PROPERTY_LIST_INCLUDE, PROPERTY_DETAIL_INCLUDE } from '../utils/prisma-includes.js';
import { buildPaginationResponse } from '../utils/pagination.js';
import { extractInvestmentData, buildInvestmentDataPayload } from '../schemas/index.js';

interface PropertyFilters {
  page: number;
  limit: number;
  country?: string;
  city?: string;
  propertyType?: string;
  status?: string;
  furnishingStatus?: string;
  isGoldenVisaEligible?: boolean;
  featured?: boolean;
  hasPool?: boolean;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  visibility?: string;
  availabilityStatus?: string;
}

export async function listProperties(filters: PropertyFilters) {
  const { page, limit } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  where.visibility = filters.visibility || 'PUBLIC';
  where.availabilityStatus = filters.availabilityStatus || 'AVAILABLE';

  if (filters.country) where.country = filters.country;
  if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
  if (filters.propertyType) where.propertyType = filters.propertyType;
  if (filters.status) where.status = filters.status;
  if (filters.furnishingStatus) where.furnishingStatus = filters.furnishingStatus;
  if (filters.isGoldenVisaEligible) where.isGoldenVisaEligible = true;
  if (filters.featured) where.featured = true;
  if (filters.hasPool) where.hasPool = true;

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const price: Record<string, number> = {};
    if (filters.minPrice !== undefined) price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) price.lte = filters.maxPrice;
    where.price = price;
  }

  if (filters.bedrooms !== undefined) {
    where.bedrooms = filters.bedrooms;
  } else if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
    const bedrooms: Record<string, number> = {};
    if (filters.minBedrooms !== undefined) bedrooms.gte = filters.minBedrooms;
    if (filters.maxBedrooms !== undefined) bedrooms.lte = filters.maxBedrooms;
    where.bedrooms = bedrooms;
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
      { district: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: 'desc' };
  if (filters.sortBy) {
    const validSortFields = ['price', 'area', 'bedrooms', 'createdAt', 'views'];
    if (validSortFields.includes(filters.sortBy)) {
      orderBy = { [filters.sortBy]: filters.sortOrder || 'asc' };
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

  return { properties, pagination: buildPaginationResponse(page, limit, total) };
}

export async function getPropertyById(id: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: PROPERTY_DETAIL_INCLUDE,
  });

  if (property) {
    // Increment view count (fire and forget)
    prisma.property.update({
      where: { id },
      data: { views: { increment: 1 } },
    }).catch(err => console.error('Failed to increment view count:', err));
  }

  return property;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProperty(validatedData: Record<string, any>) {
  const { investmentData: investFields, propertyData } = extractInvestmentData(validatedData);

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
        data: { propertyId: property.id, ...payload },
      });
    }

    return property;
  });

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProperty(id: string, validatedData: Record<string, any>) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) return null;

  const { investmentData: investFields, propertyData } = extractInvestmentData(validatedData);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    const property = await tx.property.update({
      where: { id },
      data: propertyData as Record<string, unknown>,
    });

    const hasInvestmentData = Object.values(investFields).some((v) => v !== undefined);
    if (hasInvestmentData) {
      const payload = buildInvestmentDataPayload(investFields, validatedData.isGoldenVisaEligible);
      await tx.propertyInvestmentData.upsert({
        where: { propertyId: id },
        update: payload,
        create: { propertyId: id, ...payload },
      });
    }

    return property;
  });

  return result;
}

export async function deleteProperty(id: string) {
  const existing = await prisma.property.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!existing) return null;

  await prisma.property.delete({ where: { id } });
  return existing;
}
