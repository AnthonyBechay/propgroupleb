import { fetchHomeListings } from '@/lib/data'
import { ListingCard } from '@/components/listing/ListingCard'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export async function FeaturedProjects() {
  let listings: Awaited<ReturnType<typeof fetchHomeListings>> = []
  try {
    listings = await fetchHomeListings(12)
  } catch {
    return null
  }

  if (!listings || listings.length === 0) {
    return null
  }

  return (
    <section className="py-10 sm:py-14 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header — intentionally understated; listings ARE the content */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-800">Latest Properties</h2>
          <Link
            href="/listings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            View all listings
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Listings grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-7xl mx-auto">
          {listings.map((listing, idx) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              priority={idx < 6}
            />
          ))}
        </div>

        {/* View all — bottom link */}
        <div className="text-center mt-10">
          <Link
            href="/listings"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700 transition-colors"
          >
            View all listings
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
