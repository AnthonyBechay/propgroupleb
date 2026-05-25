import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function LegacyPropertyPage({ params }: Props) {
  const { slug } = await params
  // Legacy /property/:slug — try to forward to the new listing slug, fallback to /listings
  redirect(`/listings/${slug}`)
}
