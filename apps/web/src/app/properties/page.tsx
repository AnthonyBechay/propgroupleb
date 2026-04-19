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
