import { redirect } from 'next/navigation'

// The catalog now lives on the homepage (`/`). This route is kept as a
// permanent redirect so old links / bookmarks / search-engine results for
// `/listings` still resolve, while the homepage stays the single canonical
// catalog (no duplicate-content split). Detail pages at `/listings/[slug]`
// are unaffected.
interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ListingsRedirect({ searchParams }: PageProps) {
  const params = await searchParams
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) sp.set(k, Array.isArray(v) ? v[0] : v)
  }
  const qs = sp.toString()
  redirect(qs ? `/?${qs}` : '/')
}
