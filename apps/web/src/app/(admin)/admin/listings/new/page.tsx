import { ListingForm } from '../ListingForm'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { cookies } from 'next/headers'

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function NewListingPage({ searchParams }: Props) {
  const sp = await searchParams
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

  const preselect = {
    buildingId: sp.buildingId ?? '',
    unitId: sp.unitId ?? '',
    subjectType: (sp.subjectType === 'UNIT' ? 'UNIT' : sp.subjectType === 'BUILDING' ? 'BUILDING' : '') as 'UNIT' | 'BUILDING' | '',
  }

  return <ListingForm buildings={buildings} preselect={preselect} />
}
