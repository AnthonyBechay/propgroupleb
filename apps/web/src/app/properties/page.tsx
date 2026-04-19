import type { Metadata } from 'next';
import { PropertiesClient } from '@/components/properties/PropertiesClient';
import { SearchParams } from '@/types/search';

type PropertiesPageProps = {
  searchParams: Promise<SearchParams>;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === 'production' ? 'https://bechays.com' : 'http://localhost:3000');

export const metadata: Metadata = {
  title: 'Batumi & Georgia Real Estate Investment Projects',
  description:
    'Browse curated off-plan and new-build investment projects in Batumi and across Georgia. Filter by city, price, ROI, and payment plan. Transparent pricing, vetted developers.',
  alternates: { canonical: `${SITE_URL}/properties` },
  keywords: [
    'Batumi apartments for sale',
    'Batumi investment properties',
    'Georgia real estate',
    'Tbilisi apartments',
    'Georgia off-plan property',
    'Batumi sea view',
    'high ROI real estate Georgia',
  ],
  openGraph: {
    title: 'Invest in Batumi & Georgia — Projects',
    description:
      'Hand-picked investment projects in Batumi & Georgia with transparent ROI and flexible payment plans.',
    url: `${SITE_URL}/properties`,
    type: 'website',
  },
};

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;
  
  // Fetch properties from API instead of direct Prisma
  let properties: any[] = [];

  try {
    // Build query parameters for API
    const queryParams: any = {
      page: 1,
      limit: 100,
    };
    
    if (params.country) {
      queryParams.country = params.country.toUpperCase();
    }
    
    if (params.status) {
      queryParams.status = params.status.toUpperCase();
    }
    
    if (params.minPrice) {
      queryParams.minPrice = parseInt(params.minPrice);
    }

    if (params.maxPrice) {
      queryParams.maxPrice = parseInt(params.maxPrice);
    }

    // Handle budget parameter from investment matchmaker
    if (params.budget) {
      queryParams.maxPrice = parseInt(params.budget);
    }

    if (params.bedrooms) {
      queryParams.bedrooms = parseInt(params.bedrooms);
    }

    if (params.minBedrooms) {
      queryParams.minBedrooms = parseInt(params.minBedrooms);
    }

    if (params.propertyType) {
      queryParams.propertyType = params.propertyType.toUpperCase();
    }

    // City (case-insensitive contains)
    if (params.city) {
      queryParams.city = params.city;
    }

    // Area range
    if (params.minArea) {
      queryParams.minArea = parseFloat(params.minArea);
    }
    if (params.maxArea) {
      queryParams.maxArea = parseFloat(params.maxArea);
    }

    // High-ROI convenience flag
    if (params.highRoi === 'true') {
      queryParams.highRoi = 'true';
    }

    // Golden Visa checkbox from filters
    if (params.isGoldenVisaEligible === 'true') {
      queryParams.isGoldenVisaEligible = 'true';
    }

    // Handle goal parameter
    if (params.goal === 'GOLDEN_VISA') {
      queryParams.isGoldenVisaEligible = 'true';
    }

    // Fetch from API - Use fetch directly for server-side rendering
    const { normalizeApiUrl } = await import('@/lib/utils/api-url');
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    
    const queryString = new URLSearchParams(
      Object.entries(queryParams)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ).toString();
    
    const response = await fetch(`${apiUrl}/api/properties?${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh data
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        if (Array.isArray(data.data)) {
          properties = data.data;
        }
      }
    } else {
      const errorText = await response.text();
      console.error('[Properties Page] Failed to fetch properties:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: `${apiUrl}/api/properties?${queryString}`
      });
    }
  } catch (error) {
    // Silently fall back to empty list on fetch failure
    // Use empty array as fallback
    properties = [];
  }

  return <PropertiesClient initialProperties={properties} searchParams={params} />;
}
