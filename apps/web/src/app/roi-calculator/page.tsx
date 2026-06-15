import { RoiCalculatorTool } from '@/components/tools/RoiCalculatorTool'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  title: 'Property Investment ROI Calculator — Lebanon Real Estate',
  description:
    'Free property investment calculator for Lebanon. Estimate ROI, cash-on-cash return, cap rate, monthly cash flow and multi-year compound growth before you buy.',
  alternates: { canonical: `${SITE_URL}/roi-calculator` },
  openGraph: {
    title: 'Property Investment ROI Calculator | PropGroup',
    description: 'Estimate ROI, cash flow, cap rate and compound growth for any Lebanon property.',
    url: `${SITE_URL}/roi-calculator`,
    type: 'website',
  },
}

export default function PublicRoiCalculatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Property Investment ROI Calculator',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            url: `${SITE_URL}/roi-calculator`,
            description: 'Free ROI, cash flow and compound-growth calculator for Lebanon real-estate investors.',
          }),
        }}
      />
      <RoiCalculatorTool />
    </>
  )
}
