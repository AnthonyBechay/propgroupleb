'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileSignature, Plus } from 'lucide-react'
import { apiClient, type ViewingAgreementRow } from '@/lib/api/client'

/**
 * The viewing agreements this client signed, on their card — so before
 * arguing a fee with someone you can see in one place what they agreed to.
 */
export function ClientAgreements({ leadId }: { leadId: string }) {
  const [rows, setRows] = useState<ViewingAgreementRow[] | null>(null)

  useEffect(() => {
    let live = true
    apiClient.listViewingAgreements({ leadId, limit: 20 })
      .then((r) => live && setRows(r.data ?? []))
      .catch(() => live && setRows([]))
    return () => { live = false }
  }, [leadId])

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="mb-3 flex items-center gap-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
          <FileSignature className="h-3.5 w-3.5" /> Viewing agreements
          {rows && rows.length > 0 && <span className="text-slate-400 font-normal normal-case">({rows.length})</span>}
        </p>
        <Link
          href={`/admin/agreements/new?leadId=${leadId}`}
          className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </div>
      {rows === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">None signed yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const shown = [...(r.properties ?? []).map((p) => p.ref || p.title), ...(r.propertyNote ? [r.propertyNote] : [])]
            return (
              <li key={r.id}>
                <Link href={`/admin/agreements/${r.id}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 hover:bg-slate-50">
                  <span className="font-mono text-[10px] font-semibold text-slate-500 shrink-0">{r.ref}</span>
                  <span className="text-sm text-slate-800 truncate flex-1">{shown.join(', ') || '—'}</span>
                  {r.status === 'VOID' ? (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">VOID</span>
                  ) : (
                    <span className="text-[11px] text-slate-500 shrink-0">{r.feeLabel} · {new Date(r.signedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
