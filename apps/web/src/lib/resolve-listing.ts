import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * The public listing slug for whatever a link carries: a listing slug, a
 * property slug (current or pre-rename), a property id or a PG- code.
 * Null when nothing public matches. Server-side only (used by page routes).
 */
export async function resolveListingSlug(key: string): Promise<string | null> {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  try {
    const res = await fetch(`${apiUrl}/api/listings/resolve/${encodeURIComponent(key)}`, {
      next: { revalidate: 60 },
      headers: { 'X-Prefetch': '1' },
    })
    if (!res.ok) return null
    const j = await res.json()
    return typeof j?.data?.slug === 'string' ? j.data.slug : null
  } catch {
    return null
  }
}
