import { BuildingForm } from '../BuildingForm'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { cookies } from 'next/headers'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditBuildingPage({ params }: Props) {
  const { id } = await params
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  let building = null
  try {
    const res = await fetch(`${apiUrl}/api/buildings/${id}`, {
      headers: token ? { Cookie: `token=${token}` } : {},
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      building = data.data ?? data
    }
  } catch {
    // show empty form if fetch fails
  }

  return <BuildingForm initialData={building} buildingId={id} />
}
