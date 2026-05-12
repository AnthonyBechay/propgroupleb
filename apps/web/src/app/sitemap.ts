import type { MetadataRoute } from 'next'
import { normalizeApiUrl } from '@/lib/utils/api-url'

// Re-render sitemap.xml hourly at request time, not at build.
//
// Without this, Next.js statically generates sitemap.xml at `next build`
// time using the env vars and network reachability of the build container.
// In Coolify-style deploys the build runs before api.propgrp.com is itself
// up (or before DNS propagates inside the build container), so the
// `fetchProperties()` call returns [] and the empty result gets baked in
// permanently. Confirmed in production: sitemap.xml shipped with only the
// 7 static marketing routes despite the codebase iterating over the API.
//
// `revalidate = 3600` makes it ISR — first request after a deploy
// re-evaluates with the live runtime env (including NEXT_PUBLIC_API_URL),
// then caches for an hour. Property updates surface within the next
// revalidation window without rebuilding the container.
export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Static marketing routes we always want indexed.
const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '', priority: 1.0, changeFrequency: 'weekly' },
  { path: 'properties', priority: 0.95, changeFrequency: 'daily' },
  { path: 'invest-in-lebanon', priority: 0.95, changeFrequency: 'weekly' },
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
