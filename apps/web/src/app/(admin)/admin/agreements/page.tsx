'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FileSignature, Plus, Search } from 'lucide-react'
import { apiClient, type ViewingAgreementRow } from '@/lib/api/client'
import { useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'

/** Every signed viewing agreement, newest first. */
export default function AgreementsPage() {
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => { setTerm(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, error, loading, reload } = useAdminData(
    () => apiClient.listViewingAgreements({ search: term, page, limit: 25 }),
    [term, page],
  )
  const rows: ViewingAgreementRow[] = data?.data ?? []
  const pages = data?.pagination?.pages ?? 1

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Viewing agreements</h1>
          <p className="mt-1 text-sm text-slate-600">Signed by clients before a viewing: no direct dealing, and PropGroup&apos;s fee if they buy.</p>
        </div>
        <Link href="/admin/agreements/new" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-900 px-5 font-medium text-white hover:bg-slate-800">
          <Plus className="h-4 w-4" /> New agreement
        </Link>
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client, phone, VA- reference, agent…"
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {loading && !data ? (
        <LoadState />
      ) : error ? (
        <LoadState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="mt-12 text-center text-slate-500">
          <FileSignature className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm">{term ? 'No agreement matches that search.' : 'No agreements signed yet.'}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.map((r) => {
            const props = (r.properties ?? []).map((p) => p.ref || p.title)
            if (r.propertyNote) props.push(r.propertyNote)
            return (
              <li key={r.id}>
                <Link href={`/admin/agreements/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{r.clientName}</span>
                      {r.status === 'VOID' && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">VOID</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{props.join(' · ') || '—'}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <span className="font-mono">{r.ref}</span> · {new Date(r.signedAt).toLocaleDateString([], { dateStyle: 'medium' })}
                      {r.agentName ? ` · ${r.agentName}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 disabled:opacity-40">Previous</button>
          <span className="text-slate-500">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
