'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Building2, Check, CheckCircle2, FileSignature, Loader2, Plus, Search, X } from 'lucide-react'
import { apiClient, type ViewingTerms } from '@/lib/api/client'
import { adminGet, API_URL } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { SignaturePad, type SignaturePadHandle } from '@/components/admin/SignaturePad'
import { countryFlag } from '@/lib/market'

/**
 * Viewing agreement — filled by the agent, then handed to the client to read
 * and sign on the same phone or tablet.
 *
 * Two steps on purpose: the agent's step has search boxes and internal notes
 * the client shouldn't be fiddling with; the client's step is just the
 * agreement, two ticks and a signature, in large type.
 *
 * Prefill: ?leadId=… (a CRM client) and ?buildingId=… (a property).
 */

interface PickedProperty {
  id: string
  ref: string | null
  title: string
  city: string | null
  country: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPicked(b: any): PickedProperty {
  return { id: b.id, ref: b.ref ?? null, title: b.title, city: b.neighborhood || b.city || null, country: b.country ?? null }
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const field =
  'w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200'
const label = 'mb-1 block text-sm font-medium text-slate-700'

export default function NewAgreementPage() {
  return (
    <Suspense fallback={<LoadState />}>
      <NewAgreement />
    </Suspense>
  )
}

function NewAgreement() {
  const params = useSearchParams()
  const [terms, setTerms] = useState<ViewingTerms | null>(null)
  const [termsError, setTermsError] = useState<string | null>(null)

  const [step, setStep] = useState<'details' | 'sign' | 'done'>('details')

  // Agent's step
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientIdNumber, setClientIdNumber] = useState('')
  const [leadId, setLeadId] = useState<string | null>(params.get('leadId'))
  const [properties, setProperties] = useState<PickedProperty[]>([])
  const [propertyNote, setPropertyNote] = useState('')
  const [viewingAt, setViewingAt] = useState(() => toLocalInput(new Date()))
  const [notes, setNotes] = useState('')
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // Client's step
  const [accepted, setAccepted] = useState(false)
  const [noPrior, setNoPrior] = useState(true)
  const [signed, setSigned] = useState(false)
  const pad = useRef<SignaturePadHandle>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; ref: string; leadId: string | null } | null>(null)

  const loadTerms = () => {
    setTermsError(null)
    apiClient.getViewingTerms()
      .then((r) => setTerms(r.data ?? null))
      .catch((e) => setTermsError(e instanceof Error ? e.message : 'Could not load the terms'))
  }
  useEffect(loadTerms, [])

  // Prefill from the CRM and from a property page.
  useEffect(() => {
    const lid = params.get('leadId')
    if (lid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adminGet<any>(`/api/crm/${lid}`).then((lead) => {
        setClientName((v) => v || lead?.name || '')
        setClientPhone((v) => v || lead?.phone || lead?.whatsapp || '')
        setClientEmail((v) => v || lead?.email || '')
      }).catch(() => setLeadId(null))
    }
    const bid = params.get('buildingId')
    if (bid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adminGet<any>(`/api/buildings/${bid}`).then((b) => {
        if (b?.id) setProperties((list) => (list.some((p) => p.id === b.id) ? list : [...list, toPicked(b)]))
      }).catch(() => {})
    }
  }, [params])

  // Scroll to the top on each step: on a phone the client should land on the
  // agreement's title, not halfway down it.
  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  const goToSign = () => {
    if (clientName.trim().length < 2) return setDetailsError("Enter the client's full name")
    if (properties.length === 0 && !propertyNote.trim()) return setDetailsError('Add at least one property being shown')
    if (clientEmail && !/^\S+@\S+\.\S+$/.test(clientEmail)) return setDetailsError('That email address looks wrong')
    setDetailsError(null)
    setStep('sign')
  }

  const submit = async () => {
    if (!terms) return
    const signatureData = pad.current?.toDataURL()
    if (!accepted) return setSignError('Please tick that you have read and accept the agreement')
    if (!signatureData) return setSignError('Please sign in the box')
    setSignError(null)
    setSubmitting(true)
    try {
      const r = await apiClient.signViewingAgreement({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        clientIdNumber: clientIdNumber.trim() || undefined,
        leadId: leadId || undefined,
        buildingIds: properties.map((p) => p.id),
        propertyNote: propertyNote.trim() || undefined,
        viewingAt: new Date(viewingAt).toISOString(),
        notes: notes.trim() || undefined,
        termsVersion: terms.version,
        acceptedTerms: true,
        noPriorIntroduction: noPrior,
        signatureData,
      })
      setResult(r.data ?? null)
      setStep('done')
    } catch (e) {
      setSignError(e instanceof Error ? e.message : 'Could not save the agreement. Nothing was signed — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep('details')
    setClientName(''); setClientPhone(''); setClientEmail(''); setClientIdNumber('')
    setLeadId(null); setProperties([]); setPropertyNote(''); setNotes('')
    setViewingAt(toLocalInput(new Date()))
    setAccepted(false); setNoPrior(true); setSigned(false); setResult(null)
  }

  if (!terms) return <LoadState error={termsError} onRetry={loadTerms} label="Loading the agreement…" />

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Agreement signed</h1>
        <p className="mt-2 text-slate-600">Thank you, {clientName.split(' ')[0]}. Reference</p>
        <p className="mt-1 font-mono text-xl font-semibold tracking-wide text-slate-900">{result.ref}</p>
        {result.leadId && <p className="mt-3 text-sm text-slate-500">Saved on the client&apos;s CRM record.</p>}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/admin/agreements/${result.id}`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-800 hover:bg-slate-50">
            View / print copy
          </Link>
          <button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 font-medium text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" /> New agreement
          </button>
        </div>
      </div>
    )
  }

  // ── Client signs ──────────────────────────────────────────────────────────
  if (step === 'sign') {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:pt-8">
        <button type="button" onClick={() => setStep('details')} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to details (agent)
        </button>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PropGroup</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">Property viewing agreement</h1>
          <p className="mt-2 text-base text-slate-600">
            Please read before the viewing. In short: you deal with the owner only through PropGroup, and if you buy,
            PropGroup&apos;s fee is <strong className="text-slate-900">{terms.feePercent}%</strong> of the purchase price.
          </p>

          <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-base sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Client</dt><dd className="font-medium text-slate-900">{clientName}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Date</dt><dd className="font-medium text-slate-900">{new Date(viewingAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Properties shown</dt>
              <dd className="mt-1 space-y-1 text-slate-900">
                {properties.map((p) => (
                  <div key={p.id} className="font-medium">
                    {p.ref && <span className="mr-2 font-mono text-sm text-slate-500">{p.ref}</span>}
                    {p.title}{p.city ? ` — ${p.city}` : ''}
                  </div>
                ))}
                {propertyNote && <div className="font-medium">{propertyNote}</div>}
              </dd>
            </div>
          </dl>

          <ol className="mt-6 space-y-5">
            {terms.sections.map((s, i) => (
              <li key={s.title}>
                <h2 className="text-base font-semibold text-slate-900">{i + 1}. {s.title}</h2>
                <p className="mt-1 text-base leading-relaxed text-slate-700">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-slate-400">Terms version {terms.version}</p>
        </article>

        <section className="mt-6 space-y-3">
          <Tick checked={accepted} onChange={setAccepted}>
            I have read and accept this agreement, including PropGroup&apos;s {terms.feePercent}% fee if I buy.
          </Tick>
          <Tick checked={noPrior} onChange={setNoPrior}>
            No other agent or the owner introduced me to these properties before today.
          </Tick>
          {!noPrior && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Please tell the agent who introduced you, so it can be noted on the agreement.
            </p>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Signature — {clientName}</h2>
          <SignaturePad ref={pad} onChange={(empty) => setSigned(!empty)} />
        </section>

        {signError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{signError}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !accepted || !signed}
          className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-lg font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />}
          Sign agreement
        </button>
      </div>
    )
  }

  // ── Agent fills the details ───────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-4 sm:pt-8">
      <Link href="/admin/agreements" className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Agreements
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">New viewing agreement</h1>
      <p className="mt-1 text-sm text-slate-600">Fill this in, then hand the phone or tablet to the client to read and sign.</p>

      <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Client</h2>
        <div>
          <label className={label} htmlFor="va-name">Full name *</label>
          <input id="va-name" className={field} value={clientName} onChange={(e) => setClientName(e.target.value)} autoComplete="off" autoCapitalize="words" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="va-phone">Phone</label>
            <input id="va-phone" className={field} type="tel" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+961 …" autoComplete="off" />
          </div>
          <div>
            <label className={label} htmlFor="va-email">Email</label>
            <input id="va-email" className={field} type="email" inputMode="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} autoComplete="off" autoCapitalize="none" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="va-id">ID / passport number <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="va-id" className={field} value={clientIdNumber} onChange={(e) => setClientIdNumber(e.target.value)} autoComplete="off" />
        </div>
        {leadId && (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <Check className="h-4 w-4" /> Linked to the CRM client
            <button type="button" className="ml-1 text-slate-400 underline" onClick={() => setLeadId(null)}>unlink</button>
          </p>
        )}
        {!leadId && <p className="text-xs text-slate-500">If the phone number matches a client in the CRM, the agreement is attached to them automatically.</p>}
      </section>

      <section className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What you are showing</h2>
        <PropertySearch
          picked={properties}
          onPick={(p) => setProperties((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]))}
        />
        {properties.length > 0 && (
          <ul className="space-y-2">
            {properties.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">{[p.ref, p.city, p.country && `${countryFlag(p.country)}`].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" aria-label={`Remove ${p.title}`} onClick={() => setProperties((l) => l.filter((x) => x.id !== p.id))} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <label className={label} htmlFor="va-note">Not in the catalogue? Describe it</label>
          <input id="va-note" className={field} value={propertyNote} onChange={(e) => setPropertyNote(e.target.value)} placeholder="e.g. 3-bed apartment, Mar Mikhael, 4th floor" />
        </div>
        <div>
          <label className={label} htmlFor="va-when">Viewing date and time</label>
          <input id="va-when" className={field} type="datetime-local" value={viewingAt} onChange={(e) => setViewingAt(e.target.value)} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <label className={label} htmlFor="va-notes">Internal notes <span className="font-normal text-slate-400">(not shown to the client)</span></label>
        <textarea id="va-notes" className={`${field} min-h-24 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      {detailsError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{detailsError}</p>}

      <button
        type="button"
        onClick={goToSign}
        className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-lg font-semibold text-white hover:bg-slate-800"
      >
        <FileSignature className="h-5 w-5" /> Hand to client to sign
      </button>
    </div>
  )
}

function Tick({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-base text-slate-800 has-[:checked]:border-slate-900">
      <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-slate-900" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

function PropertySearch({ picked, onPick }: { picked: PickedProperty[]; onPick: (p: PickedProperty) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PickedProperty[]>([])
  const [loading, setLoading] = useState(false)
  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setHits([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `${API_URL}/api/buildings?search=${encodeURIComponent(term)}&limit=8&visibility=all&country=all`,
          { credentials: 'include', cache: 'no-store', signal: ctrl.signal },
        )
        const body = await res.json()
        setHits((body.data ?? []).map(toPicked))
      } catch { /* aborted or offline — keep the last results */ }
      finally { setLoading(false) }
    }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  return (
    <div>
      <label className={label} htmlFor="va-search">Search a property by name, area or PG code</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="va-search" className={`${field} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="PG-1042, Achrafieh, Batumi…" autoComplete="off" />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {hits.map((h) => {
            const already = pickedIds.has(h.id)
            return (
              <li key={h.id}>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => { onPick(h); setQ('') }}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{h.title}</p>
                    <p className="text-xs text-slate-500">{[h.ref, h.city, h.country && countryFlag(h.country)].filter(Boolean).join(' · ')}</p>
                  </div>
                  {already ? <Check className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-slate-400" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
