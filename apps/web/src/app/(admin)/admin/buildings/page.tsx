import { normalizeApiUrl } from '@/lib/utils/api-url'
import { cookies } from 'next/headers'
import { BuildingsAdminClient } from './BuildingsAdminClient'

// The API caps a page at 100, so walk every page rather than trust one request.
const PAGE_SIZE = 100
const MAX_PAGES = 20

export default async function AdminBuildingsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  // A server fetch carries no browser cookie unless we forward it. Without it the
  // API treats this as a public visitor and returns PUBLIC buildings only, so a
  // property set to Hidden vanished from this list with no way back to it.
  const token = (await cookies()).get('token')?.value
  const headers: Record<string, string> = token ? { Cookie: `token=${token}` } : {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let buildings: any[] = []

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(
        `${apiUrl}/api/buildings?limit=${PAGE_SIZE}&page=${page}&visibility=all&country=all`,
        { headers, cache: 'no-store' },
      )
      if (!res.ok) break
      const d = await res.json()
      const rows = d.data ?? []
      buildings = buildings.concat(rows)
      const totalPages = d.pagination?.totalPages ?? d.pagination?.pages
      if (rows.length < PAGE_SIZE || (totalPages && page >= totalPages)) break
    }
  } catch (e) {
    console.error('[AdminBuildings]', e)
  }

  return <BuildingsAdminClient initialBuildings={buildings} />
}
