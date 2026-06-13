import { ListingsCatalog } from '@/components/listing/ListingsCatalog'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  title: 'PropGroup — Properties for Sale & Rent in Lebanon',
  description:
    'Browse apartments, villas, offices, and commercial spaces for sale and rent across Lebanon. Filter by region, type, price, and bedrooms — invest smart with PropGroup.',
  alternates: { canonical: SITE_URL },
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams
  return <ListingsCatalog searchParams={params} basePath="/" />
}
