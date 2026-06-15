import { prisma } from '@/lib/prisma'
import { MarketAnalysisClient } from '@/app/portal/market-analysis/MarketAnalysisClient'

/**
 * Market-analysis data prep + render, shared by the portal (logged-in users)
 * and the public SEO tool page. Server component — aggregates live listing data.
 */
export async function MarketAnalysisSection() {
  const buildings = await prisma.building.findMany({
    where: { visibility: 'PUBLIC' },
    select: { mohafazat: true, city: true, kind: true, status: true },
  })

  const regionMap: Record<string, { count: number }> = {}
  buildings.forEach((b) => {
    const key = b.mohafazat ?? 'Unknown'
    if (!regionMap[key]) regionMap[key] = { count: 0 }
    regionMap[key].count++
  })

  const listings = await prisma.listing.findMany({
    where: { status: 'ACTIVE', visibility: 'PUBLIC', currency: 'USD' },
    select: { price: true, intent: true },
  })

  const saleListings = listings.filter((l) => l.intent === 'FOR_SALE')
  const rentListings = listings.filter((l) => l.intent === 'FOR_RENT')

  const avgSalePrice = saleListings.length > 0
    ? saleListings.reduce((s, l) => s + Number(l.price), 0) / saleListings.length
    : 0
  const avgRentPrice = rentListings.length > 0
    ? rentListings.reduce((s, l) => s + Number(l.price), 0) / rentListings.length
    : 0

  const marketInsights = Object.entries(regionMap).map(([region, { count }]) => ({
    country: region,
    name: region.replace(/_/g, ' '),
    avgPrice: avgSalePrice,
    priceChange: 0,
    avgROI: 0,
    rentalYield: 0,
    goldenVisa: 0,
    propertyCount: count,
    marketTrend: 'Stable' as const,
    bestFor: ['Lifestyle', 'Long-term Hold'],
    insights: [
      `${count} building${count !== 1 ? 's' : ''} available`,
      avgSalePrice > 0 ? `Avg sale price: $${(avgSalePrice / 1000).toFixed(0)}K` : 'Prices vary',
      avgRentPrice > 0 ? `Avg rent: $${avgRentPrice.toLocaleString()}/mo` : '',
    ].filter(Boolean),
  }))

  const comparisonMetrics = [
    { metric: 'Average Property Price', key: 'avgPrice', format: 'currency' },
    { metric: 'Price Change (YoY)', key: 'priceChange', format: 'percentage' },
    { metric: 'Average ROI', key: 'avgROI', format: 'percentage' },
    { metric: 'Rental Yield', key: 'rentalYield', format: 'percentage' },
  ]

  return <MarketAnalysisClient marketData={marketInsights} comparisonMetrics={comparisonMetrics} />
}
