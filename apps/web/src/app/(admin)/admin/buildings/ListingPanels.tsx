'use client'

import { useEffect, useState } from 'react'
import { Archive, ExternalLink, Loader2, Sparkles, Tag, X } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/admin/ui/ConfirmDialog'
import {
  Field, FieldGrid, InlineNote, MoneyInput, SegmentedControl, SelectInput,
  TextInput, Textarea, Toggle,
} from '@/components/admin/ui/form'

const RENT_PERIODS = [
  { value: 'MONTHLY', label: 'Per month' },
  { value: 'QUARTERLY', label: 'Per quarter' },
  { value: 'YEARLY', label: 'Per year' },
]

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Put a unit on the market, without leaving the property.
 *
 * Two things it could not do before: mark a price negotiable — the column
 * exists and only the create-property wizard ever set it — and price per m²,
 * which is how every off-plan Georgian unit is actually quoted, so the admin
 * had to do the multiplication in their head and type the product.
 */
export function ListingQuickForm({
  buildingId, unitId, unitLabel, defaultIntent = 'FOR_SALE', areaSqm, onSuccess, onCancel,
}: {
  buildingId: string
  unitId: string
  unitLabel: string
  defaultIntent?: string
  areaSqm?: number | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [f, setF] = useState({
    intent: defaultIntent,
    priceMode: 'TOTAL' as 'TOTAL' | 'PER_SQM',
    price: '',
    currency: 'USD',
    rentPeriod: 'MONTHLY',
    status: 'DRAFT',
    negotiable: false,
    headline: '',
  })
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const area = areaSqm ?? 0
  const perSqm = f.priceMode === 'PER_SQM'
  const total = perSqm ? (Number(f.price) || 0) * area : Number(f.price) || 0

  async function generateHeadline() {
    setAiLoading(true)
    setErr(null)
    try {
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'unit', id: unitId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      if (s.headline) set({ headline: s.headline })
    } catch {
      setErr('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  async function submit() {
    if (!f.price || Number(f.price) <= 0) { setErr('Enter a price.'); return }
    if (perSqm && area <= 0) { setErr('This unit has no area, so it can’t be priced per m². Set its area first.'); return }
    setSaving(true)
    setErr(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        subjectType: 'UNIT',
        unitId,
        buildingId,
        intent: f.intent,
        price: total,
        currency: f.currency,
        status: f.status,
        visibility: 'PUBLIC',
        negotiable: f.negotiable,
        headline: f.headline || null,
        highlights: [],
      }
      if (f.intent === 'FOR_RENT') payload.rentPeriod = f.rentPeriod
      const res = await fetch(`${apiUrl}/api/listings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d.message || 'Could not create the listing.')
        return
      }
      toast({
        title: 'Listing created',
        description: f.status === 'ACTIVE' ? `${unitLabel} is live on the website.` : `${unitLabel} was saved as a draft.`,
      })
      onSuccess()
    } catch {
      setErr('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-700">
          <Tag className="h-3.5 w-3.5" /> New listing · {unitLabel}
        </p>
        <button type="button" onClick={onCancel} aria-label="Close" className="text-slate-400 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {err && <InlineNote tone="error">{err}</InlineNote>}

      <FieldGrid cols={2}>
        <Field label="Listing type">
          <SegmentedControl
            value={f.intent}
            onChange={(v) => set({ intent: v })}
            options={[{ value: 'FOR_SALE', label: 'For sale' }, { value: 'FOR_RENT', label: 'For rent' }]}
          />
        </Field>
        {area > 0 && f.intent === 'FOR_SALE' && (
          <Field label="How it is priced">
            <SegmentedControl
              value={f.priceMode}
              onChange={(v) => set({ priceMode: v })}
              options={[{ value: 'TOTAL', label: 'Total' }, { value: 'PER_SQM', label: 'Per m²' }]}
            />
          </Field>
        )}
      </FieldGrid>

      <FieldGrid cols={4}>
        <Field label={perSqm ? 'Price per m²' : 'Price'} required span={2}>
          <MoneyInput
            currency={f.currency}
            value={f.price}
            onChange={(e) => set({ price: e.target.value })}
            placeholder={perSqm ? '2500' : '250000'}
            disabled={saving}
          />
        </Field>
        <Field label="Currency">
          <SelectInput value={f.currency} onChange={(e) => set({ currency: e.target.value })} disabled={saving}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </SelectInput>
        </Field>
        {f.intent === 'FOR_RENT' && (
          <Field label="Period">
            <SelectInput value={f.rentPeriod} onChange={(e) => set({ rentPeriod: e.target.value })} disabled={saving}>
              {RENT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </SelectInput>
          </Field>
        )}
      </FieldGrid>

      {perSqm && area > 0 && f.price && (
        <InlineNote tone="success">
          Listed at <strong>{f.currency} {total.toLocaleString()}</strong>
          {' '}({area} m² × {f.currency} {Number(f.price).toLocaleString()})
        </InlineNote>
      )}

      <Field
        label="Headline"
        optional
        hint="Shown on cards. Falls back to the unit or property name."
      >
        <div className="flex gap-2">
          <TextInput
            value={f.headline}
            onChange={(e) => set({ headline: e.target.value })}
            placeholder="e.g. Spacious 2BR with sea view in Verdun"
            disabled={saving}
          />
          <button
            type="button"
            onClick={generateHeadline}
            disabled={aiLoading || saving}
            title="Write one from this unit’s details"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>
      </Field>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <Toggle
          checked={f.negotiable}
          onChange={(v) => set({ negotiable: v })}
          label="Price is negotiable"
          hint="Invites buyers to make an offer."
        />
        <Field label="Publish" className="max-w-sm">
          <SegmentedControl
            value={f.status}
            onChange={(v) => set({ status: v })}
            options={[{ value: 'DRAFT', label: 'Keep as draft' }, { value: 'ACTIVE', label: 'Publish now' }]}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-600 px-5 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create listing
        </button>
      </div>
    </div>
  )
}

// ── Edit ──────────────────────────────────────────────────────────────────────

export function ListingEditPanel({
  listingId, listingLabel, unitId, onSuccess, onCancel,
}: {
  listingId: string
  listingLabel: string
  unitId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  const [form, setForm] = useState({
    status: '', visibility: 'PUBLIC', price: '', currency: 'USD',
    rentPeriod: '', headline: '', description: '', intent: '', negotiable: false,
  })
  const set = (patch: Partial<typeof form>) => setForm((p) => ({ ...p, ...patch }))

  useEffect(() => {
    fetch(`${apiUrl}/api/listings/${listingId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const l = d.data ?? d
        setForm({
          status: l.status ?? 'DRAFT',
          visibility: l.visibility ?? 'PUBLIC',
          price: l.price != null ? String(l.price) : '',
          currency: l.currency ?? 'USD',
          rentPeriod: l.rentPeriod ?? 'MONTHLY',
          headline: l.headline ?? '',
          description: l.description ?? '',
          intent: l.intent ?? '',
          negotiable: !!l.negotiable,
        })
      })
      .catch(() => setErr('Could not load this listing.'))
      .finally(() => setLoading(false))
  }, [apiUrl, listingId])

  async function generateCopy() {
    setAiLoading(true)
    setErr(null)
    try {
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'unit', id: unitId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      set({ headline: s.headline ?? form.headline, description: s.description ?? form.description })
    } catch {
      setErr('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  async function submit() {
    if (!form.price || Number(form.price) <= 0) { setErr('Enter a price.'); return }
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch(`${apiUrl}/api/listings/${listingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: form.status,
          visibility: form.visibility,
          price: parseFloat(form.price),
          currency: form.currency,
          negotiable: form.negotiable,
          headline: form.headline || null,
          description: form.description || null,
          rentPeriod: form.intent === 'FOR_RENT' && form.rentPeriod ? form.rentPeriod : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d.message || 'Could not save.')
        return
      }
      toast({ title: 'Listing saved' })
      onSuccess()
    } catch {
      setErr('Network error.')
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    setSaving(true)
    try {
      await fetch(`${apiUrl}/api/listings/${listingId}`, { method: 'DELETE', credentials: 'include' })
      toast({ title: 'Listing archived', description: 'It is no longer on the website.' })
      setConfirmArchive(false)
      onSuccess()
    } catch {
      setErr('Could not archive it.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading listing…
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">
          <Tag className="h-3.5 w-3.5" /> Editing listing · {listingLabel}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/listings/${listingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-700"
          >
            <ExternalLink className="h-3 w-3" /> Full editor
          </a>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {err && <InlineNote tone="error">{err}</InlineNote>}

      <FieldGrid cols={4}>
        <Field label="Price" required span={2}>
          <MoneyInput
            currency={form.currency}
            value={form.price}
            onChange={(e) => set({ price: e.target.value })}
            disabled={saving}
          />
        </Field>
        <Field label="Currency">
          <SelectInput value={form.currency} onChange={(e) => set({ currency: e.target.value })} disabled={saving}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </SelectInput>
        </Field>
        {form.intent === 'FOR_RENT' && (
          <Field label="Period">
            <SelectInput value={form.rentPeriod} onChange={(e) => set({ rentPeriod: e.target.value })} disabled={saving}>
              {RENT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </SelectInput>
          </Field>
        )}
      </FieldGrid>

      <FieldGrid cols={2}>
        <Field label="Status" hint="Where this listing is in its sale.">
          <SelectInput value={form.status} onChange={(e) => set({ status: e.target.value })} disabled={saving}>
            <option value="DRAFT">Draft — not on the website</option>
            <option value="ACTIVE">Active — live</option>
            <option value="UNDER_OFFER">Under offer</option>
            <option value="CLOSED">Closed</option>
          </SelectInput>
        </Field>
        <Field label="Who can see it">
          <SelectInput value={form.visibility} onChange={(e) => set({ visibility: e.target.value })} disabled={saving}>
            <option value="PUBLIC">Public</option>
            <option value="ELITE_ONLY">Elite only</option>
            <option value="HIDDEN">Hidden</option>
          </SelectInput>
        </Field>
      </FieldGrid>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Toggle
          checked={form.negotiable}
          onChange={(v) => set({ negotiable: v })}
          label="Price is negotiable"
          hint="Could be switched on when the listing was created, but never off — the update silently dropped it."
        />
      </div>

      <Field label="Headline" optional>
        <div className="flex gap-2">
          <TextInput
            value={form.headline}
            onChange={(e) => set({ headline: e.target.value })}
            placeholder="Short headline shown on cards"
            disabled={saving}
          />
          <button
            type="button"
            onClick={generateCopy}
            disabled={aiLoading || saving}
            title="Write a headline and description from this unit’s details"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>
      </Field>

      <Field label="Description" optional hint="Adds to the property description on this listing only.">
        <Textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          placeholder="Anything specific to this unit…"
          disabled={saving}
        />
      </Field>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setConfirmArchive(true)}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-600 px-5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save listing
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        tone="danger"
        busy={saving}
        title="Archive this listing?"
        description="It comes off the website. The unit and the property stay exactly as they are."
        consequences={['Anyone holding a link to it will stop seeing it.', 'You can create a new listing for this unit at any time.']}
        confirmLabel="Archive"
        onConfirm={archive}
        onClose={() => !saving && setConfirmArchive(false)}
      />
    </div>
  )
}
