import { normalizeApiUrl } from '@/lib/utils/api-url'
import { BuildingsAdminClient } from './BuildingsAdminClient'

export default async function AdminBuildingsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

  let buildings: any[] = []

  try {
    const res = await fetch(`${apiUrl}/api/buildings?limit=200&visibility=all`, { cache: 'no-store' })
    if (res.ok) {
      const d = await res.json()
      buildings = d.data ?? []
    }
  } catch (e) {
    console.error('[AdminBuildings]', e)
  }

  return <BuildingsAdminClient initialBuildings={buildings} />
}
