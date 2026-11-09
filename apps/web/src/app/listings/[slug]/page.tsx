import { notFound } from 'next/navigation'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import type { Listing } from '@/types'
import { ListingIntent } from '@/types'
import {
  ListingDetailView,
  SITE_URL,
  locationString,
  UNIT_KIND_LABELS,
  BUILDING_KIND_LABELS,
} from '@/components/listing/ListingDetailView'

export const revalidate = 20

interface PageProps {
  params: Promise<{ slug: string }>
}

async function fetchListing(slug: string): Promise<Listing | null> {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  try {
    const res = await fetch(`${apiUrl}/api/listings/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 20 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.data ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const listing = await fetchListing(slug)
  if (!listing) return { title: 'Listing Not Found', robots: { index: false, follow: false } }

  const building = listing.building ?? listing.unit?.building
  const loc = locationString(building)
  const baseTitle = listing.headline ?? building?.title ?? 'Property'
  // Prefer the (AI-generated) building meta, then fall back to derived copy.
  const title = building?.metaTitle ?? `${baseTitle} — ${loc}`
  const description =
    building?.metaDescription ??
    listing.description ??
    building?.shortDescription ??
    `${baseTitle} for ${listing.intent === ListingIntent.FOR_RENT ? 'rent' : 'sale'} in ${loc}. Explore details, photos and pricing on PropGroup.`

  const canonical = `${SITE_URL}/listings/${slug}`
  const rawImage = building?.images?.[0] ?? listing.unit?.images?.[0]
  const ogImage = rawImage ? normalizeFileUrl(rawImage) : `${SITE_URL}/og-image.png`

  const kindLabel = listing.unit ? UNIT_KIND_LABELS[listing.unit.kind] : building ? BUILDING_KIND_LABELS[building.kind] : 'Property'
  const keywords = [
    `${kindLabel} for ${listing.intent === ListingIntent.FOR_RENT ? 'rent' : 'sale'}`,
    building?.city ? `${kindLabel} ${building.city}` : null,
    loc,
    'Lebanon real estate',
  ].filter(Boolean) as string[]

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: 'PropGroup',
      images: [{ url: ogImage, width: 1200, height: 630, alt: baseTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { slug } = await params
  const listing = await fetchListing(slug)
  if (!listing) notFound()
  return <ListingDetailView listing={listing} />
}
