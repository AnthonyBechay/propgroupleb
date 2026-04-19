import type { MetadataRoute } from 'next'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === 'production' ? 'https://bechays.com' : 'http://localhost:3000')

// Static marketing routes we always want indexed.
const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: 'properties', priority: 0.95, changeFrequency: 'daily' },
  { path: 'invest-in-batumi', priority: 0.95, changeFrequency: 'weekly' },
  { path: 'invest-in-georgia', priority: 0.9, changeFrequency: 'weekly' },
  { path: 'contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: 'get-started', priority: 0.7, changeFrequency: 'monthly' },
  { path: 'about', priority: 0.5, changeFrequency: 'monthly' },
]

type ApiProperty = {
  slug?: string
  id?: string
  updatedAt?: string
}

async function fetchProperties(): Promise<ApiProperty[]> {
  try {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    if (!apiUrl) return []
    // Generous limit — sitemap can hold 50k URLs, we just need all public projects.
    const res = await fetch(`${apiUrl}/api/properties?limit=5000&page=1`, {
      // Revalidate hourly — property inventory doesn't change multiple times per minute
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    const list = Array.isArray(json?.data) ? json.data : []
    return list
  } catch {
    return []
  }
}

type LocationGuide = { slug?: string; updatedAt?: string }

async function fetchLocationGuides(): Promise<LocationGuide[]> {
  try {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    if (!apiUrl) return []
    const res = await fetch(`${apiUrl}/api/location-guides`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json?.data) ? json.data : []
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(r => ({
    url: r.path ? `${SITE_URL}/${r.path}` : SITE_URL,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }))

  const [properties, guides] = await Promise.all([fetchProperties(), fetchLocationGuides()])

  const propertyEntries: MetadataRoute.Sitemap = properties
    .filter(p => p.slug)
    .map(p => ({
      url: `${SITE_URL}/property/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    }))

  const guideEntries: MetadataRoute.Sitemap = guides
    .filter(g => g.slug)
    .map(g => ({
      url: `${SITE_URL}/locations/${g.slug}`,
      lastModified: g.updatedAt ? new Date(g.updatedAt) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))

  return [...staticEntries, ...propertyEntries, ...guideEntries]
}
