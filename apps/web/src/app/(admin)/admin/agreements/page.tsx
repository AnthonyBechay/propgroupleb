'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FileSignature, Plus, Trash2 } from 'lucide-react'
import { apiClient, type ViewingAgreementRow } from '@/lib/api/client'
import { useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { DeleteAgreementDialog, StatusPill } from '@/components/admin/AgreementDialogs'
import { EmptyState, PageHeader } from '@/components/admin/ui/layout'
import { FilterSearch, SegmentedControl } from '@/components/admin/ui/form'
import { useAuth } from '@/contexts/AuthContext'
import { canDeleteAgreements } from '@/lib/permissions'
import { cn } from '@/lib/utils'

type StatusFilter = 'ALL' | 'SIGNED' | 'VOID'

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'SIGNED', label: 'Signed' },
  { value: 'VOID', label: 'Void' },
]

/** Every signed viewing agreement, newest first. */
export default function AgreementsPage() {
  const { user } = useAuth()
  const canDelete = canDeleteAgreements(user?.role)

  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [page, setPage] = useState(1)

  const [target, setTarget] = useState<ViewingAgreementRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setTerm(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, error, loading, reload } = useAdminData(
    () => apiClient.listViewingAgreements({
      search: term,
      status: status === 'ALL' ? undefined : status,
      page,
      limit: 25,
    }),
    [term, status, page],
  )
  const rows: ViewingAgreementRow[] = data?.data ?? []
  const pages = data?.pagination?.pages ?? 1
  const total = data?.pagination?.total

  const doDelete = async () => {
    if (!target) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await apiClient.deleteViewingAgreement(target.id)
      setTarget(null)
      // The last row of a page: step back rather than show an empty page.
      if (rows.length === 1 && page > 1) setPage((p) => p - 1)
      else reload()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete it')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-2 sm:py-4">
      <PageHeader
        title="Viewing agreements"
        description="Signed by clients before a viewing: no direct dealing, and PropGroup's fee if they buy."
        meta={total != null ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{total}</span> : null}
        actions={
          <Link href="/admin/agreements/new" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto">
            <Plus className="h-4 w-4" /> New agreement
          </Link>
        }
      />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search client, phone, VA- reference, agent…"
          className="flex-1"
        />
        <SegmentedControl
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={STATUS_OPTIONS}
        />
      </div>

      {loading && !data ? (
        <LoadState />
      ) : error ? (
        <LoadState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<FileSignature className="h-10 w-10" />}
          title={term || status !== 'ALL' ? 'No agreement matches.' : 'No agreements signed yet.'}
          description={term || status !== 'ALL' ? 'Try another search or status.' : 'Start one before your next viewing.'}
        />
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.map((r) => {
            const props = (r.properties ?? []).map((p) => p.ref || p.title)
            if (r.propertyNote) props.push(r.propertyNote)
            const isVoid = r.status === 'VOID'
            return (
              <li key={r.id} className="flex items-stretch">
                <Link href={`/admin/agreements/${r.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      isVoid ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700',
                    )}
                    aria-hidden="true"
                  >
                    {initials(r.clientName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <span className={cn('truncate', isVoid && 'text-slate-500 line-through decoration-slate-300')}>{r.clientName}</span>
                      <StatusPill status={r.status} />
                    </p>
                    <p className="truncate text-xs text-slate-600">{props.join(' · ') || '—'}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-400">
                      <span className="font-mono">{r.ref}</span>
                      <span>{new Date(r.signedAt).toLocaleDateString([], { dateStyle: 'medium' })}</span>
                      {r.feeLabel && <span>Fee {r.feeLabel}</span>}
                      {r.agentName && <span className="hidden sm:inline">{r.agentName}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setTarget(r) }}
                    aria-label={`Delete agreement ${r.ref}`}
                    title="Delete"
                    className="flex w-12 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
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

      <DeleteAgreementDialog
        agreement={target}
        busy={deleting}
        error={deleteError}
        onConfirm={doDelete}
        onClose={() => !deleting && setTarget(null)}
      />
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  return letters.toUpperCase() || '?'
}
