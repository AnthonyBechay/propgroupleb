import { redirect } from 'next/navigation'
import { resolveListingSlug } from '@/lib/resolve-listing'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Legacy /property/:slug (or :id). The slug here is a PROPERTY's, and
 * /listings/ only knows listing slugs, so forwarding it unchanged was a 404.
 * Resolve it to that property's public listing first.
 */
export default async function LegacyPropertyPage({ params }: Props) {
  const { slug } = await params
  const target = await resolveListingSlug(slug)
  redirect(target ? `/listings/${target}` : '/listings')
}
