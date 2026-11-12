'use client'

import { useState } from 'react'
import { X, Loader2, Save, ChevronDown } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import {
  type Lead, type LeadType, UNIT_KINDS, UNIT_KIND_LABELS, TYPE_LABELS, TYPE_META,
  isSupplyType, SUB_STATUS_META, subStatusesFor, INTENT_TYPES,
} from './types'
import { LocationPicker } from './LocationPicker'
import type { Market } from '@/lib/crm-locations'

/**
 * Add / edit a CRM client. Mirrors the old spreadsheet columns (name, type,
 * asking for, phone, follow-up, notes) plus structured fields that power
 * matching against live listings.
 */
export function LeadFormModal({
  lead, onClose, onSaved, initialName = '', initialSource,
}: {
  lead?: Lead
  onClose: () => void
  /** Receives the saved client, so a caller mid-flow can carry on with it. */
  onSaved: (saved?: Lead) => void
  /** Name typed somewhere else — usually the new-deal picker. */
  initialName?: string
  /** Where they came from, when the caller already knows (a WhatsApp message). */
  initialSource?: string
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const isEdit = !!lead
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Adding somebody: the short form. Editing: everything, since that is what they came for.
  const [more, setMore] = useState(isEdit)

  const [f, setF] = useState({
    market: lead?.market ?? 'LEBANON',
    type: lead?.type ?? 'BUYER',
    // Everything they're here to do. type is always the first of these.
    intents: (lead?.intents?.length ? lead.intents : [lead?.type ?? 'BUYER']) as LeadType[],
    isInvestor: lead?.isInvestor ?? false,
    status: lead?.status ?? 'ACTIVE',
    source: lead?.source ?? initialSource ?? 'MANUAL',
    name: lead?.name ?? initialName,
    phone: lead?.phone ?? '',
    email: lead?.email ?? '',
    whatsapp: lead?.whatsapp ?? '',
    askingFor: lead?.askingFor ?? '',
    unitKinds: lead?.unitKinds ?? ([] as string[]),
    areas: lead?.areas ?? ([] as string[]),
    regions: lead?.regions ?? ([] as string[]),
    minBeds: lead?.minBeds?.toString() ?? '',
    budgetMin: lead?.budgetMin?.toString() ?? '',
    budgetMax: lead?.budgetMax?.toString() ?? '',
    currency: lead?.currency ?? 'USD',
    lastContactAt: lead?.lastContactAt ? lead.lastContactAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    nextContactAt: lead?.nextContactAt?.slice(0, 10) ?? '',
    nextContactNote: lead?.nextContactNote ?? '',
    subStatus: lead?.subStatus ?? '',
    notes: lead?.notes ?? '',
  })
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  // Sellers/landlords OFFER a property; buyers/renters LOOK for one. The two
  // need different questions — an asking price isn't a budget range, and beds
  // are a fact about their property rather than a minimum requirement.
  const isSupply = isSupplyType(f.type as LeadType)

  function toggleKind(k: string) {
    setF((p) => ({
      ...p,
      unitKinds: p.unitKinds.includes(k) ? p.unitKinds.filter((x) => x !== k) : [...p.unitKinds, k],
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) { setError('Client name is required'); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        market: f.market, type: f.type, intents: f.intents, status: f.status, source: f.source,
        isInvestor: f.isInvestor,
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        email: f.email.trim() || '',
        whatsapp: f.whatsapp.trim() || null,
        askingFor: f.askingFor.trim() || null,
        unitKinds: f.unitKinds,
        areas: f.areas,
        regions: f.regions,
        minBeds: f.minBeds !== '' ? Number(f.minBeds) : null,
        budgetMin: f.budgetMin !== '' ? Number(f.budgetMin) : null,
        // Supply leads have a single asking price (stored in budgetMin).
        budgetMax: !isSupply && f.budgetMax !== '' ? Number(f.budgetMax) : null,
        currency: f.currency,
        lastContactAt: f.lastContactAt || null,
        nextContactAt: f.nextContactAt ? new Date(f.nextContactAt).toISOString() : null,
        nextContactNote: f.nextContactNote.trim() || null,
        // NEEDS_OPTIONS is derived from the shortlist, so it's never sent from
        // here — the server would reject it anyway.
        subStatus: f.subStatus || null,
        notes: f.notes.trim() || null,
      }
      const res = await fetch(`${apiUrl}/api/crm${isEdit ? `/${lead!.id}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || j.error || 'Save failed')
        return
      }
      const saved = (await res.json().catch(() => ({}))).data
      onSaved(saved)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10'
  const lbl = 'block text-xs font-medium text-slate-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[92vh]"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900">{isEdit ? `Edit ${lead!.name}` : 'Add Client'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSupply ? 'Someone with a property to sell or rent out' : 'Someone looking for a property'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          {/* The five things you know after one phone call. Everything else is
              under "More details" — it used to be one screen of twenty fields,
              all of them in the way of adding somebody quickly. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Name *</label>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} className={inp} placeholder="e.g. Pierre Bassil" required autoFocus={!isEdit} />
            </div>
            <div>
              <label className={lbl}>Phone / WhatsApp</label>
              <input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={inp} placeholder="03212385 or +961…" inputMode="tel" />
            </div>
          </div>

            <div>
              <label className={lbl}>They want to</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {INTENT_TYPES.map((t) => {
                  const on = f.intents.includes(t)
                  const meta = TYPE_META[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      // Pick as many as apply: selling the family flat and
                      // looking for a smaller one is one client, not two.
                      onClick={() =>
                        setF((p) => {
                          const next = p.intents.includes(t)
                            ? p.intents.filter((x) => x !== t)
                            : [...p.intents, t]
                          // Never leave them with no intent at all.
                          const intents = (next.length ? next : [t]) as LeadType[]
                          return { ...p, intents, type: intents[0] }
                        })
                      }
                      className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        on ? `${meta.solid} border-transparent` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Pick everything that applies. The first one is their main intent
                {f.intents.length > 1 && <> — currently <strong>{TYPE_LABELS[f.type as LeadType]}</strong></>}.
              </p>
            </div>

            {/* An investor is a buyer with a motive, not a fifth category. */}
            {!isSupply && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={f.isInvestor}
                  onChange={(e) => set('isInvestor', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Buying for investment / yield, not to live in
              </label>
            )}


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Mainly looking in</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([['LEBANON', '🇱🇧 Lebanon'], ['INTERNATIONAL', '🌍 International']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={f.market === value}
                    onClick={() => setF((p) => (p.market === value ? p : { ...p, market: value as Market, regions: [], areas: [] }))}
                    className={`min-h-11 rounded-lg border px-2 text-sm font-medium transition-colors ${
                      f.market === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>{isSupply ? 'Asking price' : 'Budget up to'}</label>
              <MoneyInput
                value={isSupply ? f.budgetMin : f.budgetMax}
                onChange={(v) => set(isSupply ? 'budgetMin' : 'budgetMax', v)}
                currency={f.currency}
                className={inp}
              />
            </div>
          </div>

          <div>
            <label className={lbl}>{isSupply ? 'What they have' : 'What they asked for'}</label>
            <textarea
              value={f.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className={inp + ' resize-y'}
              placeholder={isSupply ? 'e.g. 3-bed in Achrafieh, 180 m², 5th floor, wants a quick sale' : 'e.g. 2-bed in Achrafieh, ready to move, or a studio in Batumi for rental'}
            />
          </div>

          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
            className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>More details <span className="font-normal text-slate-400">· areas, property types, follow-up, source</span></span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${more ? 'rotate-180' : ''}`} />
          </button>

          {more && (
            <div className="space-y-4">
          <Section title="For matching">
          <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              {isSupply ? 'Where is the property?' : 'Where are they looking?'}
            </p>
            <LocationPicker
              market={f.market as Market}
              regions={f.regions}
              areas={f.areas}
              onChange={(patch) => setF((p) => ({ ...p, ...patch }))}
            />
          </div>

          <div>
            <label className={lbl}>{isSupply ? 'What are they offering?' : 'Property types (for matching)'}</label>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKind(k)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    f.unitKinds.includes(k)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {UNIT_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>


            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {!isSupply && (
                <div>
                  <label className={lbl}>Budget from</label>
                  <MoneyInput value={f.budgetMin} onChange={(v) => set('budgetMin', v)} currency={f.currency} className={inp} />
                </div>
              )}
              <div>
                <label className={lbl}>Currency</label>
                <select value={f.currency} onChange={(e) => set('currency', e.target.value)} className={inp}>
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </select>
              </div>
              <div>
                <label className={lbl}>{isSupply ? 'Bedrooms' : 'Bedrooms, at least'}</label>
                <select value={f.minBeds} onChange={(e) => set('minBeds', e.target.value)} className={inp}>
                  <option value="">Any</option>
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={String(n)}>{n === 0 ? 'Studio' : n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Short label</label>
              <input
                value={f.askingFor}
                onChange={(e) => set('askingFor', e.target.value)}
                className={inp}
                placeholder="Shown on their card, e.g. Studio for investment"
              />
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Email</label>
                <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>WhatsApp, if different from the phone</label>
                <input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inp} inputMode="tel" />
              </div>
              <div>
                <label className={lbl}>Where they came from</label>
                <select value={f.source} onChange={(e) => set('source', e.target.value)} className={inp}>
                  <option value="MANUAL">Manual</option>
                  <option value="PHONE">Phone</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="FACEBOOK_AD">Facebook ads</option>
                  <option value="INQUIRY">Website inquiry</option>
                  <option value="FAVORITE">Saved property</option>
                  <option value="SUBMISSION">Owner submission</option>
                  <option value="WALK_IN">Walk-in</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Follow-up">
            <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Last contact</label>
              <input type="date" value={f.lastContactAt} onChange={(e) => set('lastContactAt', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Plan a follow-up</label>
              <input type="date" value={f.nextContactAt} onChange={(e) => set('nextContactAt', e.target.value)} className={inp} />
              <input
                value={f.nextContactNote}
                onChange={(e) => set('nextContactNote', e.target.value)}
                className={`${inp} mt-1.5`}
                placeholder="What for? (optional)"
              />
              <p className="text-[11px] text-slate-500 mt-1">Only dates you set here appear as follow-ups.</p>
            </div>
          </div>

            <div>
              <label className={lbl}>Waiting on</label>
              <select value={f.subStatus} onChange={(e) => set('subStatus', e.target.value)} className={inp}>
                <option value="">Not set</option>
                {subStatusesFor(f.type as LeadType).map((k) => (
                  <option key={k} value={k}>{SUB_STATUS_META[k].label}</option>
                ))}
              </select>
            </div>

            {isEdit && (
            <div>
              <label className={lbl}>Relationship</label>
              <select value={f.status} onChange={(e) => set('status', e.target.value)} className={inp}>
                <option value="ACTIVE">Active — working with them</option>
                <option value="VIEWING">Viewing</option>
                <option value="NEGOTIATING">Negotiating</option>
                <option value="WON">Past client — has bought or sold with us</option>
                <option value="LOST">Went elsewhere</option>
                <option value="ARCHIVED">Parked — don't surface them for now</option>
              </select>
              {/* The board derives this from live deals; setting it by hand is
                  the exception, so say what it actually means. */}
              <p className="text-[11px] text-slate-500 mt-1">
                Usually set for you by their deals. A live deal makes them Active again.
              </p>
            </div>
            )}
          </Section>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * A titled group of fields. The form was one flat wall of twenty inputs.
 *
 * Must live out here: declared inside LeadFormModal it was a new component on
 * every render, so React remounted every input in it on each keystroke and
 * focus was lost after one letter.
 */
/**
 * A money field you can type the way you say it: "5k", "250k", "1.2m".
 *
 * A plain text field on purpose. As a number field the browser stepped the
 * value whenever the mouse wheel passed over it, so a budget typed as 5000 was
 * saved as 4999 without anyone seeing it change. Shown with thousands
 * separators once you leave it, so 250000 and 2500000 cannot be mistaken.
 */
function parseMoney(text: string): string {
  const t = text.trim().toLowerCase().replace(/[,\s$]/g, '')
  const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?$/)
  if (!m) return t.replace(/[^\d.]/g, '')
  const n = Number(m[1]) * (m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1)
  return String(Math.round(n))
}

function MoneyInput({
  value, onChange, currency, className,
}: { value: string; onChange: (v: string) => void; currency: string; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value && Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : value)
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{currency === 'LBP' ? 'LBP' : '$'}</span>
      <input
        value={shown}
        inputMode="decimal"
        autoComplete="off"
        onFocus={() => setDraft(value)}
        onChange={(e) => { setDraft(e.target.value); onChange(parseMoney(e.target.value)) }}
        onBlur={() => setDraft(null)}
        placeholder="e.g. 250k"
        className={`${className ?? ''} ${currency === 'LBP' ? 'pl-12' : 'pl-7'}`}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  )
}
