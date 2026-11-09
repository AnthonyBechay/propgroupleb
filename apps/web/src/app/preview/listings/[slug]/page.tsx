'use client'

import { useParams } from 'next/navigation'
import { adminGet, useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { ListingDetailView } from '@/components/listing/ListingDetailView'
import type { Listing } from '@/types'

/**
 * Staff-only preview of a listing exactly as the public page renders it, even
 * while its property is hidden. Loaded in the browser so the staff cookie goes
 * with it (see use-admin-data.ts); a visitor gets the public answer, which for a
 * hidden listing is "not found". Not indexed: robots.ts disallows /preview/.
 */
export default function ListingPreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, error, loading, reload } = useAdminData(
    () => adminGet<Listing>(`/api/listings/slug/${encodeURIComponent(slug)}`),
    [slug],
  )
  if (loading || error || !data) {
    return (
      <LoadState
        error={error === 'Not found' ? 'Not found. Previews are for signed-in staff; sign in to the back office first.' : error}
        onRetry={reload}
        label="Loading preview…"
      />
    )
  }
  return <ListingDetailView listing={data} preview />
}
