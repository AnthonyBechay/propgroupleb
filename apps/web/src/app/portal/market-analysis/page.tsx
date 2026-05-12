import { prisma } from '@/lib/prisma'
import { MarketAnalysisClient } from './MarketAnalysisClient'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MarketAnalysisPage() {
  // Layout already handles authentication

  // Fetch real market data from database
  const marketData = await prisma.property.groupBy({
    by: ['country'],
    _avg: {
      price: true,
      // Add more fields as needed
    },
    _count: {
      id: true
    }
  })

  // Fetch properties with investment data for more detailed analysis
  const propertiesWithInvestment = await prisma.property.findMany({
    include: {
      investmentData: true,
      developer: true
    }
  })

  // Calculate market insights from real data
  const marketInsights = marketData.map((country: any) => {
    const countryProperties = propertiesWithInvestment.filter((p: any) => p.country === country.country)
    const avgROI = countryProperties.length > 0 
      ? countryProperties.reduce((sum: number, p: any) => sum + (p.investmentData?.expectedROI || 0), 0) / countryProperties.length
      : 0
    const avgRentalYield = countryProperties.length > 0
      ? countryProperties.reduce((sum: number, p: any) => sum + (p.investmentData?.rentalYield || 0), 0) / countryProperties.length
      : 0

    return {
      country: country.country,
      name: country.country,
      avgPrice: country._avg.price || 0,
      priceChange: 0, // This would need historical data
      avgROI: avgROI,
      rentalYield: avgRentalYield,
      goldenVisa: 0,
      propertyCount: country._count.id,
      marketTrend: 'Stable' as const,
      bestFor: ['Long-term Hold', 'Lifestyle', 'Value'],
      insights: [
        `Strong property market with ${country._count.id} properties`,
        `Average price: $${((country._avg.price || 0) / 1000).toFixed(0)}K`,
        `Expected ROI: ${avgROI.toFixed(1)}%`,
        `Rental yield: ${avgRentalYield.toFixed(1)}%`
      ]
    }
  })

  const comparisonMetrics = [
    { metric: 'Average Property Price', key: 'avgPrice', format: 'currency' },
    { metric: 'Price Change (YoY)', key: 'priceChange', format: 'percentage' },
    { metric: 'Average ROI', key: 'avgROI', format: 'percentage' },
    { metric: 'Rental Yield', key: 'rentalYield', format: 'percentage' },
    { metric: 'Eligibility Threshold', key: 'goldenVisa', format: 'currency' },
  ]

  return (
    <MarketAnalysisClient 
      marketData={marketInsights}
      comparisonMetrics={comparisonMetrics}
    />
  )
}
