import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { PageHeader } from '@/components/admin/ui/layout'
import { ProposalView } from '@/components/proposal/ProposalView'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

/**
 * The export screen for one property.
 *
 * Server-rendered from the building detail payload — which already carries
 * units, options, listings, investment data and the public documents in one
 * query, so the document has everything it needs without a second round trip.
 */
export default async function ProposalPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  let building = null
  try {
    const res = await fetch(`${apiUrl}/api/buildings/${id}`, {
      headers: token ? { Cookie: `token=${token}` } : {},
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      building = data.data ?? data
    }
  } catch {
    // Fall through to notFound — an export screen with no property is nothing.
  }

  if (!building) notFound()

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
      <ProposalView building={building} initialUnitId={sp.unitId ?? null} />
    </div>
  )
}
