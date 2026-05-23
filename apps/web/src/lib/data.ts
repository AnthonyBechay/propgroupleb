// Server-side data fetching for the public home page.
//
// Fetches listings from the backend API over HTTP so this file
// never imports Prisma (which would break since `Property` was
// renamed to `Building`+`Listing`).  The response shape matches
// the paginated envelope returned by GET /api/listings.
import { normalizeApiUrl } from '@/lib/utils/api-url'
import type { Listing } from '@/types'

export async function fetchHomeListings(limit = 12): Promise<Listing[]> {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

  try {
    const sp = new URLSearchParams({ status: 'ACTIVE', limit: String(limit), page: '1' })
    const res = await fetch(`${apiUrl}/api/listings?${sp.toString()}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data ?? []) as Listing[]
  } catch {
    return []
  }
}
