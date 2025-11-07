import { PropertiesClient } from '@/components/properties/PropertiesClient';
import { apiClient } from '@/lib/api/client';
import { SearchParams } from '@/types/search';

type PropertiesPageProps = {
  searchParams: Promise<SearchParams>;
}

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

    // Handle goal parameter
    if (params.goal === 'GOLDEN_VISA') {
      queryParams.isGoldenVisaEligible = true;
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
      console.log('Properties API response:', { success: data.success, dataLength: data.data?.length, pagination: data.pagination });
      
      if (data.success && data.data) {
        // Backend returns { success: true, data: [properties array], pagination: {...} }
        if (Array.isArray(data.data)) {
          properties = data.data;
          console.log(`[Properties Page] Loaded ${properties.length} properties from ${apiUrl}/api/properties`);
        } else {
          console.warn('[Properties Page] Properties data is not an array:', data.data);
        }
      } else {
        console.warn('[Properties Page] API returned unsuccessful response:', data);
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
    console.warn('Failed to fetch properties from API:', error);
    // Use empty array as fallback
    properties = [];
  }

  return <PropertiesClient initialProperties={properties} searchParams={params} />;
}
