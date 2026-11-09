'use client'

import { useSearchParams } from 'next/navigation'
import { adminGetAllBuildings, useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { ListingForm } from '../ListingForm'

// Loaded in the browser so the staff cookie goes with it — see use-admin-data.ts.
// Without it, hidden properties were missing from the property picker.
export default function NewListingPage() {
  const sp = useSearchParams()
  const { data: buildings, error, loading, reload } = useAdminData(adminGetAllBuildings, [])
  if (loading || error || !buildings) return <LoadState error={error} onRetry={reload} />

  const subjectType = sp.get('subjectType')
  const preselect = {
    buildingId: sp.get('buildingId') ?? '',
    unitId: sp.get('unitId') ?? '',
    subjectType: (subjectType === 'UNIT' || subjectType === 'BUILDING' ? subjectType : '') as 'UNIT' | 'BUILDING' | '',
  }
  return <ListingForm buildings={buildings} preselect={preselect} />
}
