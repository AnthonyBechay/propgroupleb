'use client'

import { useParams } from 'next/navigation'
import { adminGet, useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { PropertyForm } from '../PropertyForm'

// Loaded in the browser so the staff cookie goes with it — see use-admin-data.ts.
// Never render the form without the record: an empty edit form saves blanks
// over the property.
export default function EditBuildingPage() {
  const { id } = useParams<{ id: string }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, loading, reload } = useAdminData(() => adminGet<any>(`/api/buildings/${id}`), [id])
  if (loading || error || !data) return <LoadState error={error} onRetry={reload} label="Loading property…" />
  return <PropertyForm key={data.id} initialData={data} buildingId={id} />
}
