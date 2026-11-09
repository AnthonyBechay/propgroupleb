'use client'

import { useParams } from 'next/navigation'
import { adminGet, adminGetAllBuildings, useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { ListingForm } from '../ListingForm'

// Loaded in the browser so the staff cookie goes with it — see use-admin-data.ts.
// Never render the form without the record: an empty edit form saves blanks.
export default function EditListingPage() {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, reload } = useAdminData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => Promise.all([adminGet<any>(`/api/listings/${id}`), adminGetAllBuildings()]),
    [id],
  )
  if (loading || error || !data) return <LoadState error={error} onRetry={reload} label="Loading listing…" />
  const [listing, buildings] = data
  return <ListingForm key={listing.id} initialData={listing} listingId={id} buildings={buildings} />
}
