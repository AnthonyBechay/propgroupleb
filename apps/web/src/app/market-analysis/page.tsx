import { MarketAnalysisSection } from '@/components/tools/MarketAnalysisSection'

// Queries the DB directly (no DATABASE_URL at build) → render on demand.
export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  title: 'Lebanon Real Estate Market Analysis — Prices & Trends by Region',
  description:
    'Live Lebanon property market analysis: average sale and rent prices, inventory and trends by region (Beirut, Mount Lebanon, North, South and more). Updated from active listings.',
  alternates: { canonical: `${SITE_URL}/market-analysis` },
  openGraph: {
    title: 'Lebanon Real Estate Market Analysis | PropGroup',
    description: 'Average prices, inventory and trends by Lebanese region — from live listings.',
    url: `${SITE_URL}/market-analysis`,
    type: 'website',
  },
}

export default function PublicMarketAnalysisPage() {
  return <MarketAnalysisSection />
}
