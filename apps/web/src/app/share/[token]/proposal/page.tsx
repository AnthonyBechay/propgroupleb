import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ProposalView } from '@/components/proposal/ProposalView'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

/**
 * The printable proposal behind a share link.
 *
 * The share page itself stays as it is — a web page, built for browsing. This
 * is the same property as the document you would have handed over in person,
 * so the recipient can save the PDF themselves rather than asking for one.
 *
 * It resolves through the same public `/api/share/:token` endpoint, so a
 * revoked or expired token gives a 404 here exactly as it does there, and a
 * unit-scoped link produces a unit-scoped document.
 */
export default async function SharedProposalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  let payload: { property: unknown; share?: { unitId?: string | null } } | null = null
  try {
    const res = await fetch(`${API_BASE_URL}/api/share/${token}`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      payload = json.data ?? json
    }
  } catch {
    // Treated as not found — a share link either resolves or it doesn't.
  }

  if (!payload?.property) notFound()

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-[240mm]">
        <div data-pg-no-print className="mb-4">
          <Link
            href={`/share/${token}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the property
          </Link>
        </div>
        <ProposalView
          building={payload.property}
          showShare={false}
          initialUnitId={payload.share?.unitId ?? null}
        />
      </div>
    </main>
  )
}
