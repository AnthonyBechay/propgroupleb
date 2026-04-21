// Server-side data fetching for the public home page.
//
// HISTORY: this file used to export six `unstable_cache`-wrapped helpers
// (getPropertyById, getPropertiesWithFilters, getDevelopers, getLocationGuides,
// getUserFavorites, getPropertyStatistics). They were dead code — nothing
// imported them — and their cache tags were typo'd (e.g. `property-property`
// instead of `property-${id}`), making them un-invalidatable. Keeping them
// around was a risk: any future caller would inherit a 5–60 min stale cache
// with no way to bust it, so admin edits would not appear on refresh.
//
// They were removed wholesale. Only `getFeaturedProperties` remains — it is
// unwrapped on purpose so the home page always reads fresh data from
// Postgres, respecting the page-level `revalidate` directive without
// introducing a second, hidden cache layer.
import { prisma } from '@/lib/prisma'

export async function getFeaturedProperties(limit: number = 6) {
  return prisma.property.findMany({
    where: {
      featured: true,
      visibility: 'PUBLIC',
      availabilityStatus: { not: 'OFF_MARKET' },
    },
    take: limit,
    orderBy: [
      { createdAt: 'desc' },
    ],
    include: {
      investmentData: true,
      developer: true,
      locationGuide: {
        select: {
          id: true,
          title: true,
          country: true,
        }
      },
    },
  })
}
