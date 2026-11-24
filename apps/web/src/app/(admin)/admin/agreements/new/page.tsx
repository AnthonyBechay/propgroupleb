'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Building2, Check, CheckCircle2, FileSignature, Loader2, Plus, Search, UserPlus, Users, X,
} from 'lucide-react'
import { apiClient, type CrmClientHit, type ViewingFeeInput, type ViewingTerms } from '@/lib/api/client'
import { adminGet, API_URL } from '@/lib/api/use-admin-data'
import { LoadState } from '@/components/admin/ui/LoadState'
import { SignaturePad, type SignaturePadHandle } from '@/components/admin/SignaturePad'
import { AgreementShareButtons } from '@/components/admin/AgreementShareButtons'
import { countryFlag } from '@/lib/market'
import { cn } from '@/lib/utils'

/**
 * Viewing agreement — filled in by the agent, then handed to the client to
 * read and sign on the same phone or tablet.
 *
 * Two steps on purpose: the agent's step has CRM search, the fee and internal
 * notes the client shouldn't be fiddling with; the client's step is just the
 * agreement in large type, addressed to them by name, two ticks and a signature.
 *
 * The client is either picked from the CRM, or typed in — and then, by
 * default, added to the CRM as a new client. A typed phone number that already
 * belongs to a client links to them instead of creating a duplicate (server).
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

type FeeMode = 'STANDARD' | 'PERCENT' | 'FIXED'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPicked(b: any): PickedProperty {
  return { id: b.id, ref: b.ref ?? null, title: b.title, city: b.neighborhood || b.city || null, country: b.country ?? null }
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const field =
  'w-full min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200'
const label = 'mb-1 block text-sm font-medium text-slate-700'
const card = 'mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6'
const cardTitle = 'text-sm font-semibold uppercase tracking-wide text-slate-500'

export default function NewAgreementPage() {
  return (
    <Suspense fallback={<LoadState />}>
      <NewAgreement />
    </Suspense>
  )
}

function NewAgreement() {
  const params = useSearchParams()
  const [defaults, setDefaults] = useState<ViewingTerms | null>(null)
  const [defaultsError, setDefaultsError] = useState<string | null>(null)
  const [step, setStep] = useState<'details' | 'sign' | 'done'>('details')

  // ── Client ──
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing')
  const [lead, setLead] = useState<CrmClientHit | null>(null)
  const [createLead, setCreateLead] = useState(true)
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientIdNumber, setClientIdNumber] = useState('')

  // ── Viewing ──
  const [properties, setProperties] = useState<PickedProperty[]>([])
  const [propertyNote, setPropertyNote] = useState('')
  const [viewingAt, setViewingAt] = useState(() => toLocalInput(new Date()))
  const [notes, setNotes] = useState('')

  // ── Fee ──
  const [feeMode, setFeeMode] = useState<FeeMode>('STANDARD')
  const [feePercent, setFeePercent] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [feeCurrency, setFeeCurrency] = useState('USD')

  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)

  // ── Client's step ──
  const [terms, setTerms] = useState<ViewingTerms | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [noPrior, setNoPrior] = useState(true)
  const [priorNote, setPriorNote] = useState('')
  const [signed, setSigned] = useState(false)
  const pad = useRef<SignaturePadHandle>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; ref: string; leadId: string | null; leadCreated: boolean } | null>(null)

  const loadDefaults = () => {
    setDefaultsError(null)
    apiClient.getViewingTerms()
      .then((r) => setDefaults(r.data ?? null))
      .catch((e) => setDefaultsError(e instanceof Error ? e.message : 'Could not load the agreement'))
  }
  useEffect(loadDefaults, [])

  // Prefill from a client's card and from a property page.
  useEffect(() => {
    const lid = params.get('leadId')
    if (lid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adminGet<any>(`/api/crm/${lid}`).then((l) => {
        if (l?.id) pickLead({ id: l.id, name: l.name, phone: l.phone, whatsapp: l.whatsapp, email: l.email, market: l.market, status: l.status })
      }).catch(() => {})
    }
    const bid = params.get('buildingId')
    if (bid) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adminGet<any>(`/api/buildings/${bid}`).then((b) => {
        if (b?.id) setProperties((list) => (list.some((p) => p.id === b.id) ? list : [...list, toPicked(b)]))
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  // Each step starts at the top: the client should land on the title.
  useEffect(() => { window.scrollTo({ top: 0 }) }, [step])

  // A half-filled agreement shouldn't vanish on a stray swipe-back.
  const dirty = step !== 'done' && (clientName.trim() !== '' || properties.length > 0 || propertyNote.trim() !== '')
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function pickLead(l: CrmClientHit) {
    setLead(l)
    setClientMode('existing')
    setClientName(l.name || '')
    setClientPhone(l.phone || l.whatsapp || '')
    setClientEmail(l.email || '')
  }

  function startNewClient(name = '') {
    setLead(null)
    setClientMode('new')
    setClientName(name)
    setClientPhone('')
    setClientEmail('')
  }

  const feeInput = (): ViewingFeeInput | null => {
    if (feeMode === 'STANDARD') return { feeType: 'PERCENT' }
    if (feeMode === 'PERCENT') {
      const v = Number(feePercent.replace(',', '.'))
      return Number.isFinite(v) && v > 0 ? { feeType: 'PERCENT', feeValue: v } : null
    }
    const v = Number(feeAmount.replace(/[\s,]/g, ''))
    return Number.isFinite(v) && v > 0 ? { feeType: 'FIXED', feeValue: v, feeCurrency } : null
  }

  const goToSign = async () => {
    if (clientMode === 'existing' && !lead) return setDetailsError('Pick the client from the CRM, or switch to "New client"')
    if (clientName.trim().length < 2) return setDetailsError("Enter the client's full name")
    if (clientEmail && !/^\S+@\S+\.\S+$/.test(clientEmail)) return setDetailsError('That email address looks wrong')
    if (properties.length === 0 && !propertyNote.trim()) return setDetailsError('Add at least one property being shown')
    const fee = feeInput()
    if (!fee) return setDetailsError(feeMode === 'FIXED' ? 'Enter the fixed fee amount' : 'Enter the fee percentage')
    setDetailsError(null)
    setPreparing(true)
    try {
      // The server writes the terms for this fee — the client reads exactly
      // the text that will be stored.
      const r = await apiClient.getViewingTerms(fee)
      setTerms(r.data ?? null)
      setAccepted(false)
      setSigned(false)
      setStep('sign')
    } catch (e) {
      setDetailsError(e instanceof Error ? e.message : 'Could not prepare the agreement')
    } finally {
      setPreparing(false)
    }
  }

  const submit = async () => {
    if (!terms) return
    const fee = feeInput()
    const signatureData = pad.current?.toDataURL()
    if (!accepted) return setSignError('Please tick that you have read and accept the agreement')
    if (!signatureData) return setSignError('Please sign in the box')
    if (!fee) return setSignError('The fee is missing — go back to the details')
    setSignError(null)
    setSubmitting(true)
    try {
      const r = await apiClient.signViewingAgreement({
        leadId: clientMode === 'existing' ? lead?.id : undefined,
        createLead: clientMode === 'new' && createLead,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        clientIdNumber: clientIdNumber.trim() || undefined,
        buildingIds: properties.map((p) => p.id),
        propertyNote: propertyNote.trim() || undefined,
        viewingAt: new Date(viewingAt).toISOString(),
        notes: notes.trim() || undefined,
        ...fee,
        termsVersion: terms.version,
        acceptedTerms: true,
        noPriorIntroduction: noPrior,
        priorIntroductionNote: noPrior ? undefined : priorNote.trim() || undefined,
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
    startNewClient('')
    setClientMode('existing')
    setClientIdNumber(''); setCreateLead(true)
    setProperties([]); setPropertyNote(''); setNotes('')
    setViewingAt(toLocalInput(new Date()))
    setFeeMode('STANDARD'); setFeePercent(''); setFeeAmount('')
    setTerms(null); setAccepted(false); setNoPrior(true); setPriorNote(''); setSigned(false); setResult(null)
  }

  if (!defaults) return <LoadState error={defaultsError} onRetry={loadDefaults} label="Loading the agreement…" />
  const standardLabel = defaults.feeLabel

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div className="mx-auto max-w-lg px-1 py-8 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Signed by {clientName}</h1>
        <p className="mt-2 text-slate-600">Reference</p>
        <p className="mt-1 font-mono text-xl font-semibold tracking-wide text-slate-900">{result.ref}</p>
        {result.leadId && (
          <p className="mt-3 text-sm text-slate-500">
            {result.leadCreated ? 'Added to the CRM as a new client, with the agreement on their record.' : "Saved on the client's CRM record."}
          </p>
        )}

        <AgreementShareButtons
          className="mt-8 text-left"
          agreement={{ id: result.id, ref: result.ref, clientName, clientPhone: clientPhone || null }}
        />

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={`/admin/agreements/${result.id}`} className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-medium text-slate-700 hover:bg-slate-100">
            Open the agreement
          </Link>
          <button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 font-medium text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" /> New agreement
          </button>
        </div>
      </div>
    )
  }

  // ── Client reads and signs ────────────────────────────────────────────────
  if (step === 'sign' && terms) {
    return (
      <div className="mx-auto max-w-2xl pb-16 pt-2 sm:pt-6">
        <button type="button" onClick={() => setStep('details')} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to details (agent)
        </button>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">PropGroup · Property viewing agreement</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">{clientName}</h1>
          <p className="mt-2 text-base text-slate-600">
            Please read before the viewing. In short: you deal with the owner only through PropGroup, and if you buy,
            PropGroup&apos;s fee is <strong className="text-slate-900">{terms.feeLabel}</strong>
            {terms.fee.type === 'PERCENT' ? ' of the purchase price' : ''}.
          </p>

          <dl className="mt-5 grid gap-x-6 gap-y-3 rounded-xl bg-slate-50 p-4 text-base sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Client</dt><dd className="font-medium text-slate-900">{clientName}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">Date</dt><dd className="font-medium text-slate-900">{new Date(viewingAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
            {clientPhone && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt><dd className="font-medium text-slate-900">{clientPhone}</dd></div>}
            <div><dt className="text-xs uppercase tracking-wide text-slate-500">PropGroup&apos;s fee</dt><dd className="font-medium text-slate-900">{terms.feeLabel}</dd></div>
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
            I, <strong>{clientName}</strong>, have read and accept this agreement, including PropGroup&apos;s fee of {terms.feeLabel} if I buy.
          </Tick>
          <Tick checked={noPrior} onChange={setNoPrior}>
            No other agent or the owner introduced me to these properties before today.
          </Tick>
          {!noPrior && (
            <div className="rounded-xl bg-amber-50 p-4">
              <label htmlFor="va-prior" className="block text-sm font-medium text-amber-900">Who introduced you, and to which property?</label>
              <textarea id="va-prior" value={priorNote} onChange={(e) => setPriorNote(e.target.value)} className={`${field} mt-2 min-h-20 py-2`} placeholder="e.g. Another agency showed me PG-1042 in March" />
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Signature of {clientName}</h2>
          <SignaturePad ref={pad} onChange={(empty) => setSigned(!empty)} />
        </section>

        {signError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{signError}</p>}

        {/* Sticky on a phone so the client never has to hunt for it under the pad. */}
        <div className="sticky bottom-0 -mx-3 mt-6 border-t border-slate-200 bg-slate-50/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !accepted || !signed}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-lg font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />}
            Sign agreement
          </button>
          {(!accepted || !signed) && (
            <p className="mt-2 text-center text-xs text-slate-500">
              {!accepted ? 'Tick the box above to accept' : 'Sign in the box above'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Agent fills the details ───────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl pb-16 pt-2 sm:pt-6">
      <Link href="/admin/agreements" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Agreements
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900">New viewing agreement</h1>
      <p className="mt-1 text-sm text-slate-600">Fill this in, then hand the phone or tablet to the client to read and sign.</p>

      {/* ── Client ── */}
      <section className={card}>
        <h2 className={cardTitle}>Client</h2>
        <Segmented
          value={clientMode}
          onChange={(v) => (v === 'new' ? startNewClient(lead ? '' : clientName) : setClientMode('existing'))}
          options={[
            { value: 'existing', label: 'From the CRM', icon: Users },
            { value: 'new', label: 'New client', icon: UserPlus },
          ]}
        />

        {clientMode === 'existing' && !lead && <ClientSearch onPick={pickLead} onCreate={(name) => startNewClient(name)} />}

        {clientMode === 'existing' && lead && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <Check className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900">{lead.name}</p>
              <p className="truncate text-sm text-slate-600">{[lead.phone || lead.whatsapp, lead.email].filter(Boolean).join(' · ') || 'No contact details on file'}</p>
            </div>
            <button type="button" onClick={() => { setLead(null); setClientName(''); setClientPhone(''); setClientEmail('') }} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-white">
              Change
            </button>
          </div>
        )}

        {(clientMode === 'new' || lead) && (
          <>
            {lead && <p className="text-xs text-slate-500">As it will appear on the agreement — correct it here if needed. The CRM record is not changed.</p>}
            <div>
              <label className={label} htmlFor="va-name">Full name *</label>
              <input id="va-name" className={field} value={clientName} onChange={(e) => setClientName(e.target.value)} autoComplete="off" autoCapitalize="words" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="va-phone">Phone</label>
                <input id="va-phone" className={field} type="tel" inputMode="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+961 71 123 456" autoComplete="off" />
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
            {clientMode === 'new' && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-slate-900" checked={createLead} onChange={(e) => setCreateLead(e.target.checked)} />
                <span>
                  <span className="font-medium text-slate-900">Add to the CRM as a new client</span>
                  <span className="block text-xs text-slate-500">If the phone number already belongs to a client, the agreement goes on their record instead — no duplicate is created.</span>
                </span>
              </label>
            )}
          </>
        )}
      </section>

      {/* ── What is shown ── */}
      <section className={card}>
        <h2 className={cardTitle}>What you are showing</h2>
        <PropertySearch
          picked={properties}
          onPick={(p) => setProperties((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]))}
        />
        {properties.length > 0 && (
          <ul className="space-y-2">
            {properties.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-3 pr-1">
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                  <p className="truncate text-xs text-slate-500">{[p.ref, p.city, p.country && countryFlag(p.country)].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" aria-label={`Remove ${p.title}`} onClick={() => setProperties((l) => l.filter((x) => x.id !== p.id))} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700">
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

      {/* ── Fee ── */}
      <section className={card}>
        <h2 className={cardTitle}>PropGroup&apos;s fee if they buy</h2>
        <Segmented
          value={feeMode}
          onChange={setFeeMode}
          options={[
            { value: 'STANDARD', label: `${standardLabel} standard` },
            { value: 'PERCENT', label: 'Other %' },
            { value: 'FIXED', label: 'Fixed amount' },
          ]}
        />
        {feeMode === 'PERCENT' && (
          <div>
            <label className={label} htmlFor="va-pct">Percentage of the purchase price</label>
            <div className="relative">
              <input id="va-pct" className={`${field} pr-10`} inputMode="decimal" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} placeholder="e.g. 3" autoComplete="off" />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
            </div>
          </div>
        )}
        {feeMode === 'FIXED' && (
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <label className={label} htmlFor="va-amt">Amount</label>
              <input id="va-amt" className={field} inputMode="decimal" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="e.g. 5000" autoComplete="off" />
            </div>
            <div className="w-28">
              <label className={label} htmlFor="va-cur">Currency</label>
              <select id="va-cur" className={field} value={feeCurrency} onChange={(e) => setFeeCurrency(e.target.value)}>
                {defaults.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {feeMode === 'FIXED'
            ? 'The client owes this sum whatever the final price.'
            : 'Charged on the final purchase price.'} The terms the client reads are written for this fee.
        </p>
      </section>

      <section className={card}>
        <div>
          <label className={label} htmlFor="va-notes">Internal notes <span className="font-normal text-slate-400">(not shown to the client)</span></label>
          <textarea id="va-notes" className={`${field} min-h-24 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      {detailsError && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{detailsError}</p>}

      <div className="sticky bottom-0 -mx-3 mt-6 border-t border-slate-200 bg-slate-50/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          onClick={goToSign}
          disabled={preparing}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-lg font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {preparing ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />}
          Hand to {clientName.trim().split(/\s+/)[0] || 'client'} to sign
        </button>
      </div>
    </div>
  )
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
}) {
  return (
    <div role="radiogroup" className="grid gap-1 rounded-xl bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const Icon = o.icon
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium leading-tight',
              on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span>{o.label}</span>
          </button>
        )
      })}
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

/** Find a CRM client by name, phone or email. */
function ClientSearch({ onPick, onCreate }: { onPick: (l: CrmClientHit) => void; onCreate: (name: string) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<CrmClientHit[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setHits([]); setSearched(''); return }
    let live = true
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await apiClient.searchCrmClients(term)
        if (live) { setHits(r.data ?? []); setSearched(term) }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (live) setLoading(false)
      }
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  const looksLikePhone = /^[+\d][\d\s-]{4,}$/.test(q.trim())

  return (
    <div>
      <label className={label} htmlFor="va-client-search">Search by name, phone or email</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="va-client-search" className={`${field} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Rami, +961 71…" autoComplete="off" />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {(hits.length > 0 || searched) && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => onPick(h)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{h.name}</p>
                  <p className="truncate text-xs text-slate-500">{[h.phone || h.whatsapp, h.email].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
          {searched && (
            <li>
              <button
                type="button"
                onClick={() => onCreate(looksLikePhone ? '' : searched)}
                className="flex min-h-12 w-full items-center gap-3 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                <UserPlus className="h-4 w-4 shrink-0 text-slate-500" />
                {hits.length === 0 ? 'No client found — ' : 'Not them? '}
                {looksLikePhone ? 'add a new client' : <>add “{searched}” as a new client</>}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

function PropertySearch({ picked, onPick }: { picked: PickedProperty[]; onPick: (p: PickedProperty) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PickedProperty[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')
  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setHits([]); setSearched(''); return }
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
        setSearched(term)
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
                    <p className="truncate text-xs text-slate-500">{[h.ref, h.city, h.country && countryFlag(h.country)].filter(Boolean).join(' · ')}</p>
                  </div>
                  {already ? <Check className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-slate-400" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {searched && hits.length === 0 && !loading && (
        <p className="mt-2 text-sm text-slate-500">No property matches “{searched}”. Describe it in the box below instead.</p>
      )}
    </div>
  )
}
