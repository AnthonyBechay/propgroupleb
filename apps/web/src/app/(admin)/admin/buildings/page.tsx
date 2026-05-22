import { normalizeApiUrl } from '@/lib/utils/api-url'
import { BuildingsAdminClient } from './BuildingsAdminClient'

export default async function AdminBuildingsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

  let buildings: any[] = []
  let developers: any[] = []

  try {
    const [buildingsRes, devsRes] = await Promise.all([
      fetch(`${apiUrl}/api/buildings?limit=200`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/buildings/developers`, { cache: 'no-store' }),
    ])

    if (buildingsRes.ok) {
      const d = await buildingsRes.json()
      buildings = d.data ?? []
    }
    if (devsRes.ok) {
      const d = await devsRes.json()
      developers = d.data ?? []
    }
  } catch (e) {
    console.error('[AdminBuildings]', e)
  }

  return <BuildingsAdminClient initialBuildings={buildings} developers={developers} />
}
