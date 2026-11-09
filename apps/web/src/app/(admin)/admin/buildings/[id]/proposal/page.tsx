'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { adminGet, useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { PageHeader } from '@/components/admin/ui/layout'
import { ProposalView } from '@/components/proposal/ProposalView'

/**
 * The export screen for one property, from the building detail payload — which
 * carries units, options, listings, investment data and the public documents in
 * one query. Loaded in the browser so the staff cookie goes with it.
 */
export default function ProposalPage() {
  const { id } = useParams<{ id: string }>()
  const unitId = useSearchParams().get('unitId')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: building, error, loading, reload } = useAdminData(() => adminGet<any>(`/api/buildings/${id}`), [id])
  if (loading || error || !building) return <LoadState error={error} onRetry={reload} label="Loading property…" />

  return (
    <div>
      <div data-pg-no-print>
        <PageHeader
          title="Export"
          description="Preview it, send it as a link, or save it as a PDF."
          backHref={`/admin/buildings/${id}`}
          crumbs={[
            { label: 'Properties', href: '/admin/buildings' },
            { label: building.title ?? 'Property', href: `/admin/buildings/${id}` },
            { label: 'Export' },
          ]}
        />
      </div>
      <ProposalView building={building} initialUnitId={unitId} />
    </div>
  )
}
