import { PropertiesClient } from '@/components/properties/PropertiesClient';
import { prisma } from '@/lib/prisma';
import { SearchParams } from '@/types/search';

type PropertiesPageProps = {
  searchParams: Promise<SearchParams>;
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;
  
  // Build the where clause based on search parameters
  const where: any = {
    visibility: 'PUBLIC',
    availabilityStatus: 'AVAILABLE',
  };
  
  if (params.country) {
    where.country = params.country.toUpperCase();
  }
  
  if (params.status) {
    where.status = params.status.toUpperCase();
  }
  
  if (params.minPrice || params.maxPrice) {
    where.price = {};
    if (params.minPrice) {
      where.price.gte = parseInt(params.minPrice);
    }
    if (params.maxPrice) {
      where.price.lte = parseInt(params.maxPrice);
    }
  }

  // Handle budget parameter from investment matchmaker
  if (params.budget) {
    where.price = {
      ...where.price,
      lte: parseInt(params.budget)
    };
  }

  // Handle goal parameter
  if (params.goal === 'HIGH_ROI') {
    // You might want to filter or sort by ROI here
    // For now, we'll just include all properties
  } else if (params.goal === 'GOLDEN_VISA') {
    where.isGoldenVisaEligible = true;
  }

  // Fetch properties from the database with error handling
  let properties: any[] = [];

  try {
    properties = await prisma.property.findMany({
      where,
      include: {
        investmentData: true,
        developer: true,
        locationGuide: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.warn('Failed to fetch properties from database:', error);
    // Use empty array as fallback
    properties = [];
  }

  return <PropertiesClient initialProperties={properties} searchParams={params} />;
}
