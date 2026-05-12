import type { Metadata } from 'next';
import { PropertiesClient } from '@/components/properties/PropertiesClient';
import { SearchParams } from '@/types/search';

type PropertiesPageProps = {
  searchParams: Promise<SearchParams>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Lebanon Real Estate Listings',
  description:
    'Browse curated Lebanon real estate listings. Filter by city, price, and property type. Transparent pricing and a clean way to shortlist and compare.',
  alternates: { canonical: `${SITE_URL}/properties` },
  keywords: [
    'Lebanon real estate',
    'Beirut apartments for sale',
    'buy property in Lebanon',
    'Lebanon new build',
    'Lebanon off-plan',
  ],
  openGraph: {
    title: 'Lebanon — Listings',
    description:
      'Curated Lebanon real estate listings with clear filters and comparisons.',
    url: `${SITE_URL}/properties`,
    type: 'website',
  },
};

import { normalizeApiUrl } from '@/lib/utils/api-url';

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  // Await searchParams as it's now a Promise in Next.js 15
  const params = await searchParams;

  // Fetch the FULL unfiltered catalog once on the server so the client can
  // narrow/widen filters entirely locally — no additional server roundtrip on
  // every filter change. The browser then filters `liveParams` via useMemo.
  let properties: any[] = [];

  try {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

    const response = await fetch(`${apiUrl}/api/properties?page=1&limit=500`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        properties = data.data;
      }
    } else {
      console.error('[Properties Page] Failed to fetch properties:', {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch {
    properties = [];
  }

  return <PropertiesClient initialProperties={properties} searchParams={params} />;
}
