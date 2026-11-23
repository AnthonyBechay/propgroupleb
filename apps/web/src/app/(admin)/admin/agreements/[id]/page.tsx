'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, Loader2, Printer } from 'lucide-react'
import { apiClient, type ViewingAgreement } from '@/lib/api/client'
import { useAdminData } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { useAuth } from '@/contexts/AuthContext'
import { canVoidAgreements } from '@/lib/permissions'

/**
 * One signed agreement, laid out as the document the client signed. "Print"
 * uses the browser's print dialog, which on a phone or tablet also offers
 * "Save as PDF" — the copy to send the client.
 */
export default function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuth()
  const { data, error, loading, reload, setData } = useAdminData(
    async () => (await apiClient.getViewingAgreement(id)).data as ViewingAgreement,
    [id],
  )
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)

  if (loading || !data) return <LoadState error={error} onRetry={reload} />
  const a = data

  const doVoid = async () => {
    if (!reason.trim()) return setVoidError('Give a reason')
    setBusy(true)
    setVoidError(null)
    try {
      await apiClient.voidViewingAgreement(a.id, reason.trim())
      setData({ ...a, status: 'VOID', voidReason: reason.trim(), voidedAt: new Date().toISOString() })
      setVoiding(false)
    } catch (e) {
      setVoidError(e instanceof Error ? e.message : 'Could not void it')
    } finally {
      setBusy(false)
    }
  }

  const sections = a.termsText.split(/\n\n/).map((block) => {
    const [title, ...rest] = block.split('\n')
    return { title, body: rest.join('\n') }
  })

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:pt-6">
      {/* Print only the document, not the back-office chrome around it. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #agreement-doc, #agreement-doc * { visibility: visible !important; }
        #agreement-doc { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; }
      }`}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/admin/agreements" className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Agreements
        </Link>
        <div className="flex gap-2">
          {a.status === 'SIGNED' && canVoidAgreements(user?.role) && (
            <button type="button" onClick={() => setVoiding((v) => !v)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50">
              <Ban className="h-4 w-4" /> Void
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
            <Printer className="h-4 w-4" /> Print / PDF
          </button>
        </div>
      </div>

      {voiding && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 print:hidden">
          <label htmlFor="void-reason" className="block text-sm font-medium text-red-800">Why is this agreement void?</label>
          <input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-red-200 bg-white px-3 text-sm" placeholder="e.g. Signed with the wrong property" />
          {voidError && <p className="mt-2 text-sm text-red-700">{voidError}</p>}
          <p className="mt-2 text-xs text-red-700">The record is kept, marked void. This cannot be undone.</p>
          <button type="button" disabled={busy} onClick={doVoid} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Void agreement
          </button>
        </div>
      )}

      <article id="agreement-doc" className="relative rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm sm:p-8">
        {a.status === 'VOID' && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            VOID{a.voidedAt ? ` since ${new Date(a.voidedAt).toLocaleDateString()}` : ''}{a.voidReason ? ` — ${a.voidReason}` : ''}
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PropGroup</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Property viewing agreement</h1>
          </div>
          <p className="font-mono text-sm font-semibold text-slate-700">{a.ref}</p>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <Item label="Client">{a.clientName}</Item>
          <Item label="Viewing">{new Date(a.viewingAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Item>
          {a.clientPhone && <Item label="Phone">{a.clientPhone}</Item>}
          {a.clientEmail && <Item label="Email">{a.clientEmail}</Item>}
          {a.clientIdNumber && <Item label="ID / passport">{a.clientIdNumber}</Item>}
          <Item label="Agent">{a.agentName || '—'}</Item>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Properties shown</dt>
            <dd className="mt-1 space-y-1 font-medium text-slate-900">
              {(a.properties ?? []).map((p) => (
                <div key={p.buildingId}>
                  {p.ref && <span className="mr-2 font-mono text-xs text-slate-500">{p.ref}</span>}
                  {p.title}{p.city ? ` — ${p.city}` : ''}
                </div>
              ))}
              {a.propertyNote && <div>{a.propertyNote}</div>}
            </dd>
          </div>
        </dl>

        <ol className="mt-6 space-y-4">
          {sections.map((s) => (
            <li key={s.title}>
              <h2 className="text-sm font-semibold text-slate-900">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 space-y-1 text-sm">
          <p>☑ The client read and accepted this agreement, including the {Number(a.feePercent)}% fee.</p>
          <p>{a.noPriorIntroduction ? '☑ No earlier introduction to these properties declared.' : '☐ The client declared an earlier introduction to one or more of these properties.'}</p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Client signature</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.signatureData} alt={`Signature of ${a.clientName}`} className="mt-1 h-28 w-full rounded-lg border border-slate-200 bg-white object-contain" />
            <p className="mt-1 text-sm font-medium text-slate-900">{a.clientName}</p>
          </div>
          <div className="text-xs text-slate-500">
            <p className="uppercase tracking-wide">Signed</p>
            <p className="mt-1 text-sm text-slate-800">{new Date(a.signedAt).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</p>
            <p className="mt-3">Terms version {a.termsVersion}</p>
            {a.signedIp && <p>IP {a.signedIp}</p>}
            <p className="mt-1 break-all font-mono text-[10px] text-slate-400">SHA-256 {a.documentHash}</p>
          </div>
        </div>
      </article>

      {(a.lead || a.notes) && (
        <section className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm print:hidden">
          {a.lead && (
            <p>CRM client: <Link className="font-medium text-slate-900 underline" href={`/admin/clients?lead=${a.lead.id}`}>{a.lead.name}</Link></p>
          )}
          {a.notes && <p className="whitespace-pre-wrap text-slate-600"><span className="font-medium text-slate-800">Internal notes: </span>{a.notes}</p>}
        </section>
      )}
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{children}</dd>
    </div>
  )
}
