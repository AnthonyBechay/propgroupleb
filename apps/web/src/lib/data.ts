// Server-side data fetching with caching and optimization
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { Property, PropertyInvestmentData, Developer, LocationGuide, Country, PropertyStatus } from '@propgroup/db'

// Cache tags for revalidation
export const CACHE_TAGS = {
  properties: 'properties',
  property: (id: string) => `property-${id}`,
  developers: 'developers',
  locations: 'locations',
  user: (id: string) => `user-${id}`,
  favorites: (userId: string) => `favorites-${userId}`,
} as const

// Optimized property queries with proper includes
// No cache wrapper — the page is already force-dynamic, and we need
// fresh results immediately after admin creates/deletes properties.
export async function getFeaturedProperties(limit: number = 6) {
  return prisma.property.findMany({
    take: limit,
    orderBy: [
      { createdAt: 'desc' },
    ],
    include: {
      investmentData: true,
      developer: true,
      locationGuide: {
        select: {
          id: true,
          title: true,
          country: true,
        }
      },
    },
  })
}

export const getPropertyById = unstable_cache(
  async (id: string) => {
    return prisma.property.findUnique({
      where: { id },
      include: {
        investmentData: true,
        developer: true,
        locationGuide: true,
        _count: {
          select: {
            favoriteProperties: true,
            propertyInquiries: true,
          }
        },
      },
    })
  },
  ['property-by-id'],
  {
    revalidate: 300, // 5 minutes
    tags: [CACHE_TAGS.property('property')],
  }
)

export const getPropertiesWithFilters = unstable_cache(
  async (filters: {
    country?: Country
    status?: PropertyStatus
    minPrice?: number
    maxPrice?: number
    bedrooms?: number
    bathrooms?: number
    isGoldenVisaEligible?: boolean
    sortBy?: 'price' | 'createdAt' | 'expectedROI'
    sortOrder?: 'asc' | 'desc'
    page?: number
    limit?: number
  }) => {
    const {
      country,
      status,
      minPrice,
      maxPrice,
      bedrooms,
      bathrooms,
      isGoldenVisaEligible,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 12,
    } = filters

    const where: any = {}

    if (country) where.country = country
    if (status) where.status = status
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {}
      if (minPrice !== undefined) where.price.gte = minPrice
      if (maxPrice !== undefined) where.price.lte = maxPrice
    }
    if (bedrooms !== undefined) where.bedrooms = { gte: bedrooms }
    if (bathrooms !== undefined) where.bathrooms = { gte: bathrooms }
    if (isGoldenVisaEligible !== undefined) where.isGoldenVisaEligible = isGoldenVisaEligible

    const orderBy: any = {}
    if (sortBy === 'expectedROI') {
      // Sort by investment data ROI
      orderBy.investmentData = { expectedROI: sortOrder }
    } else {
      orderBy[sortBy] = sortOrder
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          investmentData: {
            select: {
              expectedROI: true,
              rentalYield: true,
              capitalGrowth: true,
            }
          },
          developer: {
            select: {
              id: true,
              name: true,
            }
          },
        },
      }),
      prisma.property.count({ where }),
    ])

    return {
      properties,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },
  ['properties-with-filters'],
  {
    revalidate: 300, // 5 minutes
    tags: [CACHE_TAGS.properties],
  }
)

export const getDevelopers = unstable_cache(
  async () => {
    return prisma.developer.findMany({
      include: {
        _count: {
          select: {
            properties: true,
          }
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
  },
  ['developers'],
  {
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.developers],
  }
)

export const getLocationGuides = unstable_cache(
  async () => {
    return prisma.locationGuide.findMany({
      include: {
        _count: {
          select: {
            properties: true,
          }
        },
      },
      orderBy: {
        country: 'asc',
      },
    })
  },
  ['location-guides'],
  {
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.locations],
  }
)

export const getUserFavorites = unstable_cache(
  async (userId: string) => {
    return prisma.favoriteProperty.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            investmentData: {
              select: {
                expectedROI: true,
                rentalYield: true,
                capitalGrowth: true,
              }
            },
            developer: {
              select: {
                id: true,
                name: true,
              }
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  },
  ['user-favorites'],
  {
    revalidate: 60, // 1 minute
    tags: [CACHE_TAGS.favorites('user')],
  }
)

export const getPropertyStatistics = unstable_cache(
  async () => {
    const [
      totalProperties,
      averagePrice,
      countryCounts,
      statusCounts,
      goldenVisaCount,
    ] = await Promise.all([
      prisma.property.count(),
      prisma.property.aggregate({
        _avg: {
          price: true,
        },
      }),
      prisma.property.groupBy({
        by: ['country'],
        _count: true,
      }),
      prisma.property.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.property.count({
        where: {
          isGoldenVisaEligible: true,
        },
      }),
    ])

    return {
      totalProperties,
      averagePrice: averagePrice._avg.price || 0,
      countryCounts,
      statusCounts,
      goldenVisaCount,
    }
  },
  ['property-statistics'],
  {
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.properties],
  }
)

// Search properties with full-text search capability
export async function searchProperties(query: string, limit: number = 10) {
  // For PostgreSQL full-text search, you would need to set up proper indexes
  // For now, we'll use basic pattern matching
  return prisma.property.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { developer: { name: { contains: query, mode: 'insensitive' } } },
        { locationGuide: { title: { contains: query, mode: 'insensitive' } } },
      ],
    },
    include: {
      investmentData: {
        select: {
          expectedROI: true,
          rentalYield: true,
        }
      },
      developer: {
        select: {
          name: true,
        }
      },
    },
    take: limit,
  })
}

// Get similar properties based on various criteria
export async function getSimilarProperties(
  propertyId: string,
  limit: number = 4
) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      country: true,
      price: true,
      bedrooms: true,
      status: true,
    },
  })

  if (!property) return []

  return prisma.property.findMany({
    where: {
      id: { not: propertyId },
      OR: [
        // Same country and similar price range (±20%)
        {
          country: property.country,
          price: {
            gte: property.price * 0.8,
            lte: property.price * 1.2,
          },
        },
        // Same bedrooms and status
        {
          bedrooms: property.bedrooms,
          status: property.status,
        },
      ],
    },
    include: {
      investmentData: {
        select: {
          expectedROI: true,
          rentalYield: true,
        }
      },
    },
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
  })
}

// Performance monitoring helper
export async function getDatabaseMetrics() {
  // Note: $metrics is not available in the current Prisma version
  // This is a placeholder for future implementation
  return {
    message: 'Database metrics not available in current Prisma version'
  }
}
