'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, Sparkles, Tag } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import {
  ChipsInput, Field, FieldGrid, InlineNote, MoneyInput, SegmentedControl,
  SelectInput, TextInput, Textarea, Toggle,
} from '@/components/admin/ui/form'
import { FormSection, PageHeader, SaveBar } from '@/components/admin/ui/layout'
import { useUnsavedChanges } from '@/components/admin/ui/useUnsavedChanges'
import { countryFlag } from '@/lib/market'
import { typeLabel } from '@/lib/property-types'

interface Preselect {
  buildingId?: string
  unitId?: string
  subjectType?: 'UNIT' | 'BUILDING' | ''
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  listingId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildings: any[]
  preselect?: Preselect
}

const RENT_PERIODS = [
  { value: 'MONTHLY', label: 'Per month' },
  { value: 'QUARTERLY', label: 'Per quarter' },
  { value: 'YEARLY', label: 'Per year' },
]

const HIGHLIGHT_SUGGESTIONS = [
  'Newly renovated', 'Move-in ready', 'Motivated seller', 'Below market',
  'Corner unit', 'Quiet street', 'Near schools', 'Parking included',
]

/**
 * The full listing editor.
 *
 * Two gaps it closes: `negotiable` was never on this form at all — only the
 * create-property wizard could set it, and the API's update schema then dropped
 * it, so a listing's negotiability was fixed at birth. And a listing's price
 * could be typed with no idea what it looked like on a card, which is the one
 * thing a listing is.
 */
export function ListingForm({ initialData, listingId, buildings, preselect }: Props) {
  const router = useRouter()
  const isEdit = !!listingId
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  const [saving, setSaving] = useState(false)
  // Guards against the same save firing twice in one tick — see BuildingForm.
  const inFlight = useRef(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [units, setUnits] = useState<any[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const [form, setForm] = useState({
    subjectType: initialData?.subjectType ?? (preselect?.subjectType || 'BUILDING'),
    buildingId: initialData?.buildingId ?? initialData?.building?.id ?? preselect?.buildingId ?? '',
    unitId: initialData?.unitId ?? initialData?.unit?.id ?? preselect?.unitId ?? '',
    intent: initialData?.intent ?? 'FOR_SALE',
    status: initialData?.status ?? 'DRAFT',
    visibility: initialData?.visibility ?? 'PUBLIC',
    price: initialData?.price != null ? String(initialData.price) : '',
    currency: initialData?.currency ?? 'USD',
    rentPeriod: initialData?.rentPeriod ?? 'MONTHLY',
    negotiable: !!initialData?.negotiable,
    headline: initialData?.headline ?? '',
    description: initialData?.description ?? '',
    highlights: (initialData?.highlights ?? []) as string[],
  })

  const set = (patch: Partial<typeof form>) => { setForm((p) => ({ ...p, ...patch })); setSaved(false) }

  const baseline = useRef(JSON.stringify(form))
  const dirty = JSON.stringify(form) !== baseline.current
  useUnsavedChanges(dirty && !saving)

  // Load units when the building changes (for a unit-level listing).
  useEffect(() => {
    if (!form.buildingId || form.subjectType !== 'UNIT') { setUnits([]); return }
    setLoadingUnits(true)
    fetch(`${apiUrl}/api/buildings/${form.buildingId}/units`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUnits(d.data ?? []))
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false))
  }, [form.buildingId, form.subjectType, apiUrl])

  const selectedBuilding = buildings.find((b) => b.id === form.buildingId) ?? initialData?.building
  const selectedUnit = units.find((u) => u.id === form.unitId) ?? initialData?.unit

  async function generateCopy() {
    const targetId = form.unitId || form.buildingId
    if (!targetId) { setError('Pick what this listing is for first.'); return }
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.unitId ? 'unit' : 'building', id: targetId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      set({
        headline: s.headline ?? form.headline,
        description: s.description ?? form.description,
      })
    } catch {
      setError('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (inFlight.current) return

    const problem =
      !form.price || Number(form.price) <= 0 ? 'A listing needs a price greater than zero.'
      : !form.buildingId ? 'Pick the property this listing is for.'
      : form.subjectType === 'UNIT' && !form.unitId ? 'Pick the unit this listing is for.'
      : null
    if (problem) { setError(problem); return }

    inFlight.current = true
    setSaving(true)
    setError(null)

    const shared = {
      status: form.status,
      visibility: form.visibility,
      price: parseFloat(form.price),
      currency: form.currency,
      negotiable: form.negotiable,
      rentPeriod: form.intent === 'FOR_RENT' ? form.rentPeriod : null,
      headline: form.headline || null,
      description: form.description || null,
      highlights: form.highlights,
    }

    const body = isEdit
      ? shared
      : {
          ...shared,
          subjectType: form.subjectType,
          buildingId: form.subjectType === 'BUILDING' ? form.buildingId : null,
          unitId: form.subjectType === 'UNIT' ? form.unitId : null,
          intent: form.intent,
        }

    try {
      const res = await fetch(
        isEdit ? `${apiUrl}/api/listings/${listingId}` : `${apiUrl}/api/listings`,
        {
          method: isEdit ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || data.error || 'Could not save this listing.')
        inFlight.current = false
        setSaving(false)
        return
      }
      baseline.current = JSON.stringify(form)
      toast({
        title: isEdit ? 'Listing saved' : 'Listing created',
        description: form.status === 'ACTIVE' ? 'It is live on the website.' : 'It is saved as a draft.',
      })
      router.push('/admin/listings')
      router.refresh()
    } catch {
      setError('Network error — nothing was saved.')
      inFlight.current = false
      setSaving(false)
    }
  }

  const cardTitle = form.headline
    || selectedUnit?.name
    || (selectedUnit?.unitNumber ? `Unit ${selectedUnit.unitNumber}` : null)
    || selectedBuilding?.title
    || 'Untitled listing'

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isEdit ? 'Edit listing' : 'New listing'}
        description={isEdit ? initialData?.headline : 'Put a property or one of its units on the market.'}
        backHref="/admin/listings"
        crumbs={[{ label: 'Listings', href: '/admin/listings' }, { label: isEdit ? 'Edit' : 'New' }]}
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <InlineNote tone="error">{error}</InlineNote>}

        {/* What it sells */}
        {!isEdit ? (
          <FormSection
            title="What is being listed"
            description="A listing sells either a whole property or one unit inside it."
            icon={<Building2 className="h-4 w-4" />}
          >
            <div className="space-y-4">
              <Field label="Listing covers">
                <SegmentedControl
                  value={form.subjectType}
                  onChange={(v) => set({ subjectType: v, unitId: '' })}
                  options={[
                    { value: 'BUILDING', label: 'The whole property' },
                    { value: 'UNIT', label: 'One unit' },
                  ]}
                />
              </Field>

              <Field label="Property" required>
                <SelectInput
                  value={form.buildingId}
                  onChange={(e) => set({ buildingId: e.target.value, unitId: '' })}
                  required
                  disabled={saving}
                >
                  <option value="">Choose a property…</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.ref ? `${b.ref} · ` : ''}{b.title}{b.city ? ` — ${b.city}` : ''}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              {form.subjectType === 'UNIT' && form.buildingId && (
                <Field label="Unit" required>
                  {loadingUnits ? (
                    <div className="flex min-h-11 items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading units…
                    </div>
                  ) : units.length === 0 ? (
                    <InlineNote tone="warning">
                      This property has no units yet.{' '}
                      <Link href={`/admin/buildings/${form.buildingId}`} className="font-medium underline">
                        Add one first
                      </Link>{' '}
                      — a unit is what a listing attaches to.
                    </InlineNote>
                  ) : (
                    <SelectInput
                      value={form.unitId}
                      onChange={(e) => set({ unitId: e.target.value })}
                      required
                      disabled={saving}
                    >
                      <option value="">Choose a unit…</option>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {units.map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? (u.unitNumber ? `Unit ${u.unitNumber}` : u.id.slice(0, 6))}
                          {u.kind ? ` · ${typeLabel(u.kind)}` : ''}
                          {u.bedrooms != null ? ` · ${u.bedrooms} bed` : ''}
                          {u.areaSqm ? ` · ${u.areaSqm} m²` : ''}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>
              )}
            </div>
          </FormSection>
        ) : (
          initialData?.building && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-400">{countryFlag(initialData.building.country)}</span>{' '}
              <span className="font-medium text-slate-900">{initialData.building.title}</span>
              {initialData.unit && (
                <span className="ml-2 text-slate-500">
                  › {initialData.unit.name ?? `Unit ${initialData.unit.unitNumber ?? ''}`}
                </span>
              )}
              {initialData.building.city && <span className="ml-2 text-slate-400">· {initialData.building.city}</span>}
              <p className="mt-0.5 text-xs text-slate-400">
                What a listing sells can&rsquo;t be changed — create a new one instead.
              </p>
            </div>
          )
        )}

        {/* Price */}
        <FormSection title="Price" icon={<Tag className="h-4 w-4" />}>
          <div className="space-y-4">
            {!isEdit && (
              <Field label="Sale or rent">
                <SegmentedControl
                  value={form.intent}
                  onChange={(v) => set({ intent: v })}
                  options={[{ value: 'FOR_SALE', label: 'For sale' }, { value: 'FOR_RENT', label: 'For rent' }]}
                />
              </Field>
            )}

            <FieldGrid cols={4}>
              <Field label="Price" required span={2}>
                <MoneyInput
                  currency={form.currency}
                  value={form.price}
                  onChange={(e) => set({ price: e.target.value })}
                  placeholder="250000"
                  step="any"
                  required
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

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <Toggle
                checked={form.negotiable}
                onChange={(v) => set({ negotiable: v })}
                label="Price is negotiable"
                hint="Shown to buyers as an invitation to make an offer."
                disabled={saving}
              />
            </div>
          </div>
        </FormSection>

        {/* Publishing */}
        <FormSection title="Publishing" description="Where this listing is in its sale, and who can see it.">
          <FieldGrid cols={2}>
            <Field label="Status">
              <SelectInput value={form.status} onChange={(e) => set({ status: e.target.value })} disabled={saving}>
                <option value="DRAFT">Draft — not on the website</option>
                <option value="ACTIVE">Active — live</option>
                <option value="UNDER_OFFER">Under offer</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
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
          {form.status === 'ACTIVE' && form.visibility === 'HIDDEN' && (
            <InlineNote tone="warning" className="mt-3">
              Active but hidden — nobody will see it. Set visibility to Public to actually publish.
            </InlineNote>
          )}
        </FormSection>

        {/* Copy */}
        <FormSection
          title="What buyers read"
          description="Overrides the property's own words for this listing only."
          aside={
            <button
              type="button"
              onClick={generateCopy}
              disabled={aiLoading || saving || !form.buildingId}
              title={form.buildingId ? 'Write from the property’s details' : 'Pick a property first'}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiLoading ? 'Writing…' : 'Write with AI'}
            </button>
          }
        >
          <div className="space-y-4">
            <Field
              label="Headline"
              optional
              hint="Falls back to the unit or property name if you leave it blank."
            >
              <TextInput
                value={form.headline}
                onChange={(e) => set({ headline: e.target.value })}
                placeholder="e.g. Spacious 3BR with sea view in Verdun"
                disabled={saving}
              />
            </Field>

            <Field label="Description" optional>
              <Textarea
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                rows={5}
                placeholder="Anything specific to this listing…"
                disabled={saving}
              />
            </Field>

            <Field label="Highlights" optional hint="Short bullets shown beside the price.">
              <ChipsInput
                value={form.highlights}
                onChange={(highlights) => set({ highlights })}
                placeholder="e.g. Newly renovated…"
                suggestions={HIGHLIGHT_SUGGESTIONS}
                disabled={saving}
              />
            </Field>

            {/* A listing is a card. Showing the card removes the guesswork. */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                How the card reads
              </p>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="truncate text-sm font-semibold text-slate-900">{cardTitle}</p>
                <p className="mt-0.5 text-sm font-bold text-slate-800">
                  {form.price
                    ? `${form.currency === 'USD' ? '$' : ''}${Number(form.price).toLocaleString()}${form.currency !== 'USD' ? ` ${form.currency}` : ''}`
                    : 'No price'}
                  {form.intent === 'FOR_RENT' && (
                    <span className="font-normal text-slate-500">
                      {' '}/ {RENT_PERIODS.find((p) => p.value === form.rentPeriod)?.label.replace('Per ', '') ?? 'month'}
                    </span>
                  )}
                  {form.negotiable && <span className="ml-1.5 text-xs font-medium text-emerald-600">negotiable</span>}
                </p>
                {selectedBuilding && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {[selectedBuilding.city, selectedBuilding.caza].filter(Boolean).join(', ')}
                  </p>
                )}
                {form.highlights.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {form.highlights.slice(0, 3).map((h) => (
                      <span key={h} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{h}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </FormSection>

        <SaveBar
          dirty={dirty}
          saving={saving}
          saved={saved}
          onSave={() => handleSubmit()}
          cancelHref="/admin/listings"
          saveLabel={isEdit ? 'Save listing' : 'Create listing'}
        />
      </form>
    </div>
  )
}
