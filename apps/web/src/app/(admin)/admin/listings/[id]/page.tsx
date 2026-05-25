import { ListingForm } from '../ListingForm'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { cookies } from 'next/headers'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditListingPage({ params }: Props) {
  const { id } = await params
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const headers: Record<string, string> = {}
  if (token) headers['Cookie'] = `token=${token}`

  let listing = null
  let buildings: any[] = []

  try {
    const [listingRes, buildingsRes] = await Promise.all([
      fetch(`${apiUrl}/api/listings/${id}`, { headers, cache: 'no-store' }),
      fetch(`${apiUrl}/api/buildings?limit=200&visibility=all`, { headers, cache: 'no-store' }),
    ])
    if (listingRes.ok) {
      const data = await listingRes.json()
      listing = data.data ?? data
    }
    if (buildingsRes.ok) {
      const data = await buildingsRes.json()
      buildings = data.data ?? []
    }
  } catch { /* use empty */ }

  return <ListingForm initialData={listing} listingId={id} buildings={buildings} />
}
