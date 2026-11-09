'use client'

import { adminGetAllBuildings, useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { BuildingsAdminClient } from './BuildingsAdminClient'

// Loaded in the browser so the staff cookie goes with it — see use-admin-data.ts.
export default function AdminBuildingsPage() {
  const { data, error, loading, reload } = useAdminData(adminGetAllBuildings, [])
  if (loading || error || !data) return <LoadState error={error} onRetry={reload} label="Loading properties…" />
  return <BuildingsAdminClient initialBuildings={data} />
}
