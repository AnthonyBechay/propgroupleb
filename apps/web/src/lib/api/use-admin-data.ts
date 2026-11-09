'use client'

import { useCallback, useEffect, useState } from 'react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * Staff data has to be fetched from the browser.
 *
 * The login cookie is set by the API (api.propgrouplb.com) with no Domain, so it
 * belongs to that host alone. The browser sends it on `credentials: 'include'`;
 * the website's own Next server never receives it. A server component that
 * "forwards the cookie" therefore forwards nothing, and the API answers as if
 * to the public: hidden properties 404, and lists hold PUBLIC rows only.
 *
 * That is how a hidden property vanished from the admin list, and how its edit
 * page opened with an empty form whose save then added a blank unit each time.
 * Admin pages load through this hook instead.
 */
export const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store' })
  if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : `Could not load (HTTP ${res.status})`)
  const body = await res.json()
  return (body.data ?? body) as T
}

/** Every building, both markets, hidden ones included. The API caps a page at 100. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function adminGetAllBuildings(): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let all: any[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${API_URL}/api/buildings?limit=100&page=${page}&visibility=all&country=all`,
      { credentials: 'include', cache: 'no-store' },
    )
    if (!res.ok) throw new Error(`Could not load properties (HTTP ${res.status})`)
    const body = await res.json()
    const rows = body.data ?? []
    all = all.concat(rows)
    if (rows.length < 100 || page >= (body.pagination?.pages ?? page)) break
  }
  return all
}

export function useAdminData<T>(load: (() => Promise<T>) | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load ?? (async () => null as T), deps)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await run())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => { reload() }, [reload])

  return { data, error, loading, reload, setData }
}
