import { prisma } from '@/lib/prisma'
import { MarketAnalysisClient } from '@/app/portal/market-analysis/MarketAnalysisClient'

/**
 * Market-analysis data prep + render, shared by the portal (logged-in users)
 * and the public SEO tool page. Server component — aggregates live listing data.
 *
 * Both pages that use this render on demand (there is no DATABASE_URL at build
 * time), so this runs on every request. It used to run by pulling **every**
 * public building and **every** active listing into Node and reducing them in
 * JavaScript — an unbounded table scan, two full result sets over the wire, and
 * a loop, all to produce three numbers and a count per region. Postgres does
 * the same work in the query, returns a handful of rows, and stops growing with
 * the catalogue.
 */
export async function MarketAnalysisSection() {
  const [byRegion, saleStats, rentStats] = await Promise.all([
    prisma.building.groupBy({
      by: ['mohafazat'],
      where: { visibility: 'PUBLIC' },
      _count: { _all: true },
    }),
    prisma.listing.aggregate({
      where: { status: 'ACTIVE', visibility: 'PUBLIC', currency: 'USD', intent: 'FOR_SALE' },
      _avg: { price: true },
    }),
    prisma.listing.aggregate({
      where: { status: 'ACTIVE', visibility: 'PUBLIC', currency: 'USD', intent: 'FOR_RENT' },
      _avg: { price: true },
    }),
  ])

  // `price` is a Prisma Decimal; `_avg` gives back a Decimal or null.
  const avgSalePrice = Number(saleStats._avg.price ?? 0)
  const avgRentPrice = Number(rentStats._avg.price ?? 0)

  const marketInsights = byRegion.map((row) => {
    const region = row.mohafazat ?? 'Unknown'
    const count = row._count._all
    return {
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
    }
  })

  const comparisonMetrics = [
    { metric: 'Average Property Price', key: 'avgPrice', format: 'currency' },
    { metric: 'Price Change (YoY)', key: 'priceChange', format: 'percentage' },
    { metric: 'Average ROI', key: 'avgROI', format: 'percentage' },
    { metric: 'Rental Yield', key: 'rentalYield', format: 'percentage' },
  ]

  return <MarketAnalysisClient marketData={marketInsights} comparisonMetrics={comparisonMetrics} />
}
