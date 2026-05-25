import { ListingForm } from '../ListingForm'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { cookies } from 'next/headers'

export default async function NewListingPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const headers: Record<string, string> = {}
  if (token) headers['Cookie'] = `token=${token}`

  let buildings: any[] = []
  try {
    const res = await fetch(`${apiUrl}/api/buildings?limit=200&visibility=all`, { headers, cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      buildings = data.data ?? []
    }
  } catch { /* leave empty */ }

  return <ListingForm buildings={buildings} />
}
