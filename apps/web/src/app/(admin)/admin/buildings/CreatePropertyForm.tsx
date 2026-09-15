'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check, ChevronLeft, ChevronRight, FileText, Home, Loader2, Sparkles, Upload, X,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { type OwnerRef } from '@/components/admin/OwnerPicker'
import {
  Field, FieldGrid, InlineNote, MoneyInput, NumberInput, SegmentedControl,
  SelectInput, TextInput, Toggle,
} from '@/components/admin/ui/form'
import { FormSection, PageHeader } from '@/components/admin/ui/layout'
import { useUnsavedChanges } from '@/components/admin/ui/useUnsavedChanges'
import { isKnownLocation } from '@/lib/lebanon-locations'
import { isResidential, typeDef, typeLabel } from '@/lib/property-types'
import { cn } from '@/lib/utils'
import {
  BasicsSection, HighlightsSection, InvestmentSection, LocationSection,
  MediaSection, PaymentPlansSection, SeoSection, SpecsSection,
} from './BuildingSections'
import { buildingPayload, emptyBuildingForm, type BuildingFormState } from './building-form-state'

const DOC_TYPES = ['FLOOR_PLAN', 'BROCHURE', 'CONTRACT', 'LEGAL_DOCUMENT', 'CERTIFICATE', 'OTHER']
const DOC_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor plan', BROCHURE: 'Brochure', CONTRACT: 'Contract',
  LEGAL_DOCUMENT: 'Legal document', CERTIFICATE: 'Certificate', OTHER: 'Other',
}

interface DocEntry { file: File; title: string; type: string; isPublic: boolean }

const STEPS = [
  { id: 'property', label: 'Property', hint: 'What and where' },
  { id: 'details', label: 'Details', hint: 'Size and features' },
  { id: 'media', label: 'Photos', hint: 'Images and files' },
  { id: 'market', label: 'Price', hint: 'Put it on the market' },
] as const

type StepId = (typeof STEPS)[number]['id']

/**
 * Adding a property.
 *
 * This was a single 560-line scroll: nine cards, every field for every property
 * type, with the one required decision — the title — sharing a screen with
 * meta descriptions and golden-visa amounts. Typical stock needs four fields to
 * exist at all, so the form asked for sixty and buried the four.
 *
 * It is now four steps, and only the first is mandatory. From step two onward
 * "Create now" is live: get the property into the system, fill in the rest from
 * the edit screen when the photos actually arrive, which is how these listings
 * are really put together.
 */
export function CreatePropertyForm() {
  const router = useRouter()
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const docInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<StepId>('property')
  const [form, setForm] = useState<BuildingFormState>(() => emptyBuildingForm())
  const [owner, setOwner] = useState<OwnerRef | null>(null)
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [saving, setSaving] = useState(false)
  // A second click while the first create is in flight would make a second
  // property — `saving` is read from a stale closure, a ref is not.
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // The first unit's specs. A property with one unit *is* that unit, so these
  // are asked here rather than sending the admin to the Units tab afterwards.
  const [unit, setUnit] = useState({ bedrooms: '', bathrooms: '', areaSqm: '', floor: '' })

  // The listing, so a property can go on the market in the same pass.
  const [listing, setListing] = useState({
    enabled: true,
    intent: 'FOR_SALE',
    priceMode: 'TOTAL' as 'TOTAL' | 'PER_SQM',
    price: '',
    currency: 'USD',
    status: 'ACTIVE',
    negotiable: false,
  })

  const touched = !!form.title.trim() || form.images.length > 0 || !!listing.price
  useUnsavedChanges(touched && !saving, 'This property has not been created yet. Leave and lose it?')

  const set = (patch: Partial<BuildingFormState>) => setForm((p) => ({ ...p, ...patch }))

  const def = typeDef(form.unitKind)
  const isLand = form.unitKind === 'LAND_PARCEL'
  const showBuildingSpecs = def.inBuilding || form.unitKind === 'WHOLE_BUILDING'
  const residential = isResidential(form.unitKind)

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const isLastStep = stepIndex === STEPS.length - 1

  // ── Validation ──────────────────────────────────────────────────────────────

  /** Step one is the only gate — everything after it can be filled in later. */
  function validateProperty(): boolean {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'A property needs a title.'
    if (form.country === 'LEBANON' && !isKnownLocation({ city: form.city, neighborhood: form.neighborhood })) {
      errs.location = 'Pick a location from the search list — Lebanese locations come from a fixed gazetteer.'
    } else if (form.country !== 'LEBANON' && !form.city.trim()) {
      errs.location = 'Enter a city.'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateListing(): string | null {
    if (!listing.enabled) return null
    const area = unit.areaSqm !== '' ? Number(unit.areaSqm) : 0
    if (!listing.price || Number(listing.price) <= 0) return 'Enter a price, or switch the listing off.'
    if (listing.priceMode === 'PER_SQM' && area <= 0) return 'Set the area first — a price per m² needs one.'
    return null
  }

  function goto(next: StepId) {
    // Only step one blocks; the rest are navigable in any order.
    if (step === 'property' && !validateProperty()) {
      document.getElementById(fieldErrors.title ? 'basics' : 'location')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setError(null)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function submit() {
    if (inFlight.current) return
    setError(null)
    if (!validateProperty()) { setStep('property'); window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    const listingProblem = validateListing()
    if (listingProblem) { setError(listingProblem); setStep('market'); return }

    inFlight.current = true
    setSaving(true)
    const area = unit.areaSqm !== '' ? Number(unit.areaSqm) : 0
    const totalPrice = listing.priceMode === 'PER_SQM'
      ? (Number(listing.price) || 0) * area
      : (Number(listing.price) || 0)

    try {
      // 1) The property
      const bRes = await fetch(`${apiUrl}/api/buildings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...buildingPayload(form, { showBuildingSpecs }),
          ownerLeadId: owner?.id ?? null,
        }),
      })
      const bData = await bRes.json().catch(() => ({}))
      if (!bRes.ok) {
        setError(bData.message || bData.error || 'Could not create the property.')
        inFlight.current = false
        setSaving(false)
        return
      }
      const buildingId = (bData.data ?? bData)?.id
      if (!buildingId) { setError('The property was not created.'); inFlight.current = false; setSaving(false); return }

      // 2) Its first unit
      const lifecycle = listing.enabled
        ? (listing.intent === 'FOR_RENT' ? 'FOR_RENT' : 'FOR_SALE')
        : 'VACANT'
      const uRes = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: form.unitKind,
          bedrooms: def.beds && unit.bedrooms !== '' ? Number(unit.bedrooms) : null,
          bathrooms: def.baths && unit.bathrooms !== '' ? Number(unit.bathrooms) : null,
          areaSqm: area || null,
          floor: def.floor && unit.floor !== '' ? Number(unit.floor) : null,
          // Photos live on the property, not duplicated onto the unit.
          lifecycle,
        }),
      })
      const createdUnit = (await uRes.json().catch(() => ({}))).data ?? {}

      // 3) Its listing
      if (listing.enabled && createdUnit?.id) {
        await fetch(`${apiUrl}/api/listings`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectType: 'UNIT',
            unitId: createdUnit.id,
            buildingId,
            intent: listing.intent,
            price: totalPrice,
            currency: listing.currency,
            status: listing.status,
            visibility: 'PUBLIC',
            negotiable: listing.negotiable,
            highlights: [],
          }),
        }).catch(() => { /* the property exists; the listing can be added after */ })
      }

      // 4) Documents
      for (const d of docs) {
        try {
          const fd = new FormData()
          fd.append('file', d.file)
          fd.append('propertyId', buildingId)
          fd.append('title', d.title)
          fd.append('type', d.type)
          fd.append('isPublic', String(d.isPublic))
          await fetch(`${apiUrl}/api/documents`, { method: 'POST', credentials: 'include', body: fd })
        } catch { /* best effort */ }
      }

      toast({
        title: 'Property created',
        description: listing.enabled ? `${form.title} is on the market.` : `${form.title} was saved without a listing.`,
      })
      // Land on the property itself, not the list — there is almost always
      // something else to add, and the list gives no way back to what you just made.
      router.push(`/admin/buildings/${buildingId}`)
      router.refresh()
    } catch {
      setError('Network error — the property was not created.')
      inFlight.current = false
      setSaving(false)
    }
  }

  // ── AI SEO, from what's on the form (nothing is saved yet) ──────────────────

  async function generateSeo() {
    if (!form.title.trim()) { setAiError('Add a title first.'); return }
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'building',
          attributes: {
            title: form.title, neighborhood: form.neighborhood, city: form.city,
            caza: form.caza, mohafazat: form.mohafazat, country: form.country,
            kind: form.kind, status: form.status,
            totalFloors: form.totalFloors, builtYear: form.builtYear,
            hasGenerator: form.hasGenerator, hasElevator: form.hasElevator,
            hasPool: form.hasPool, hasGym: form.hasGym, hasConcierge: form.hasConcierge,
            hasSecurity: form.hasSecurity, hasGarden: form.hasGarden,
            hasRooftop: form.hasRooftop, hasSolarPower: form.hasSolarPower,
            hasCentralAC: form.hasCentralAC,
            highlightedFeatures: form.highlightedFeatures,
            description: form.description || form.shortDescription,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAiError(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      setForm((p) => ({
        ...p,
        metaTitle: s.metaTitle ?? p.metaTitle,
        metaDescription: s.metaDescription ?? p.metaDescription,
        shortDescription: p.shortDescription || s.shortDescription || p.shortDescription,
      }))
    } catch {
      setAiError('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const listingProblem = validateListing()

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Add property"
        description="Four steps. Only the first is required — the rest can wait."
        backHref="/admin/buildings"
        crumbs={[{ label: 'Properties', href: '/admin/buildings' }, { label: 'New' }]}
      />

      <Stepper current={stepIndex} onJump={(i) => goto(STEPS[i].id)} />

      {error && <InlineNote tone="error">{error}</InlineNote>}

      {step === 'property' && (
        <div className="space-y-5">
          <BasicsSection
            f={form}
            set={set}
            owner={owner}
            onOwnerChange={setOwner}
            unitCount={0}
            errors={fieldErrors}
            disabled={saving}
          />
          <LocationSection f={form} set={set} errors={fieldErrors} disabled={saving} />
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-5">
          {/* Land has no rooms or floors — its plot area is its only measurement. */}
          <FormSection
            id="unit"
            title={`${typeLabel(form.unitKind)} details`}
            description={hintFor(form.unitKind)}
            icon={<Home className="h-4 w-4" />}
          >
            <FieldGrid cols={4}>
              {def.beds && (
                <Field label="Bedrooms" optional>
                  <NumberInput
                    min="0" value={unit.bedrooms}
                    onChange={(e) => setUnit((u) => ({ ...u, bedrooms: e.target.value }))}
                    placeholder="2" disabled={saving}
                  />
                </Field>
              )}
              {def.baths && (
                <Field label="Bathrooms" optional>
                  <NumberInput
                    min="0" value={unit.bathrooms}
                    onChange={(e) => setUnit((u) => ({ ...u, bathrooms: e.target.value }))}
                    placeholder="1" disabled={saving}
                  />
                </Field>
              )}
              <Field
                label={def.areaLabel}
                optional={!listing.enabled || listing.priceMode !== 'PER_SQM'}
                required={listing.enabled && listing.priceMode === 'PER_SQM'}
              >
                <NumberInput
                  min="0" unit="m²" value={unit.areaSqm}
                  onChange={(e) => setUnit((u) => ({ ...u, areaSqm: e.target.value }))}
                  placeholder="120" disabled={saving}
                />
              </Field>
              {def.floor && (
                <Field label="Floor" optional>
                  <NumberInput
                    value={unit.floor}
                    onChange={(e) => setUnit((u) => ({ ...u, floor: e.target.value }))}
                    placeholder="3" disabled={saving}
                  />
                </Field>
              )}
            </FieldGrid>
            {isLand && (
              <p className="mt-3 text-xs text-slate-400">
                A land plot has no rooms or floors — the plot area is the only measurement it needs.
              </p>
            )}
          </FormSection>

          {showBuildingSpecs && <SpecsSection f={form} set={set} residential={residential} disabled={saving} />}
          <HighlightsSection f={form} set={set} disabled={saving} />
        </div>
      )}

      {step === 'media' && (
        <div className="space-y-5">
          {/* Photos are uploaded to storage as they're picked, before the
              property exists — so removing one here really does delete it. */}
          <MediaSection f={form} set={set} disabled={saving} />

          <FormSection
            id="documents"
            title="Documents"
            description="Floor plans, brochures, contracts. They upload once the property is created."
            icon={<FileText className="h-4 w-4" />}
          >
            <div className="space-y-3">
              {docs.length > 0 && (
                <ul className="space-y-2">
                  {docs.map((d, i) => (
                    <li key={i} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 sm:flex-row sm:items-center">
                      <TextInput
                        value={d.title}
                        onChange={(e) => setDocs((ds) => ds.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))}
                        placeholder="Document title"
                        className="flex-1"
                      />
                      <SelectInput
                        value={d.type}
                        onChange={(e) => setDocs((ds) => ds.map((x, idx) => (idx === i ? { ...x, type: e.target.value } : x)))}
                        className="sm:w-44"
                      >
                        {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                      </SelectInput>
                      <label className="flex items-center gap-1.5 whitespace-nowrap px-1 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={d.isPublic}
                          onChange={(e) => setDocs((ds) => ds.map((x, idx) => (idx === i ? { ...x, isPublic: e.target.checked } : x)))}
                          className="rounded border-slate-300"
                        />
                        Public
                      </label>
                      <button
                        type="button"
                        onClick={() => setDocs((ds) => ds.filter((_, idx) => idx !== i))}
                        aria-label="Remove document"
                        className="p-1.5 text-slate-400 transition-colors hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" /> Add documents
              </button>
              <p className="text-xs text-slate-400">
                PDF, images, Word or Excel. Public documents show on the property page; private ones stay in here.
              </p>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    setDocs((ds) => [
                      ...ds,
                      ...Array.from(e.target.files!).map((file) => ({
                        file,
                        title: file.name.replace(/\.[^.]+$/, ''),
                        type: 'OTHER',
                        isPublic: false,
                      })),
                    ])
                  }
                  e.target.value = ''
                }}
              />
            </div>
          </FormSection>
        </div>
      )}

      {step === 'market' && (
        <div className="space-y-5">
          <FormSection
            title="Put it on the market"
            description="Creates the listing buyers see. You can add or change listings at any time."
            aside={
              <Toggle
                checked={listing.enabled}
                onChange={(v) => setListing((l) => ({ ...l, enabled: v }))}
                label="List it now"
              />
            }
          >
            {listing.enabled ? (
              <div className="space-y-4">
                <FieldGrid cols={2}>
                  <Field label="Listing type">
                    <SegmentedControl
                      value={listing.intent}
                      onChange={(v) => setListing((l) => ({ ...l, intent: v }))}
                      options={[{ value: 'FOR_SALE', label: 'For sale' }, { value: 'FOR_RENT', label: 'For rent' }]}
                    />
                  </Field>
                  <Field label="How it is priced">
                    <SegmentedControl
                      value={listing.priceMode}
                      onChange={(v) => setListing((l) => ({ ...l, priceMode: v }))}
                      options={[
                        { value: 'TOTAL', label: 'Total price' },
                        { value: 'PER_SQM', label: 'Per m²' },
                      ]}
                    />
                  </Field>
                </FieldGrid>

                <FieldGrid cols={2}>
                  <Field
                    label={listing.priceMode === 'PER_SQM' ? 'Price per m²' : 'Price'}
                    required
                    error={listingProblem ?? undefined}
                  >
                    <MoneyInput
                      currency={listing.currency}
                      value={listing.price}
                      onChange={(e) => setListing((l) => ({ ...l, price: e.target.value }))}
                      placeholder={listing.priceMode === 'PER_SQM' ? '2500' : '250000'}
                      invalid={!!listingProblem}
                      disabled={saving}
                    />
                  </Field>
                  <Field label="Currency">
                    <SelectInput
                      value={listing.currency}
                      onChange={(e) => setListing((l) => ({ ...l, currency: e.target.value }))}
                      disabled={saving}
                    >
                      <option value="USD">USD</option>
                      <option value="LBP">LBP</option>
                    </SelectInput>
                  </Field>
                </FieldGrid>

                {listing.priceMode === 'PER_SQM' && unit.areaSqm && listing.price && (
                  <InlineNote tone="success">
                    Total: <strong>{listing.currency} {(Number(listing.price) * Number(unit.areaSqm)).toLocaleString()}</strong>
                    {' '}({unit.areaSqm} m² × {listing.currency} {Number(listing.price).toLocaleString()})
                  </InlineNote>
                )}

                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <Toggle
                    checked={listing.negotiable}
                    onChange={(v) => setListing((l) => ({ ...l, negotiable: v }))}
                    label="Price is negotiable"
                    hint="Shown to buyers as an invitation to make an offer."
                  />
                  <Field label="Publish" className="max-w-sm">
                    <SegmentedControl
                      value={listing.status}
                      onChange={(v) => setListing((l) => ({ ...l, status: v }))}
                      options={[
                        { value: 'ACTIVE', label: 'Live now' },
                        { value: 'DRAFT', label: 'Keep as draft' },
                      ]}
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                The property will be saved without a price. Add a listing from its Units &amp; listings tab whenever you&rsquo;re ready.
              </p>
            )}
          </FormSection>

          <PaymentPlansSection f={form} set={set} />
          <InvestmentSection f={form} set={set} disabled={saving} />
          <SeoSection
            f={form}
            set={set}
            onGenerate={generateSeo}
            generating={aiLoading}
            generateError={aiError}
            generateDisabledReason={form.title.trim() ? null : 'Add a title first — the AI reads what you entered above.'}
            disabled={saving}
          />
        </div>
      )}

      {/* Step controls */}
      <div className="sticky bottom-3 z-30 mb-[max(0.25rem,env(safe-area-inset-bottom))] rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)}
            disabled={stepIndex === 0 || saving}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {/* Escape hatch: the property matters, the other 50 fields can wait. */}
            {stepIndex > 0 && !isLastStep && (
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Create now
              </button>
            )}
            {isLastStep ? (
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-800 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Creating…' : 'Create property'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goto(STEPS[stepIndex + 1].id)}
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function hintFor(kind: string): string {
  switch (kind) {
    case 'PARKING': return 'A parking spot only needs its area and level.'
    case 'STORAGE': return 'A storage unit only needs its area and level.'
    case 'WHOLE_BUILDING': return 'The entire building is sold or rented as one.'
    case 'LAND_PARCEL': return 'Just the plot.'
    default: return typeDef(kind).group === 'COMMERCIAL'
      ? 'Commercial space — bedrooms don’t apply.'
      : 'The unit being sold or rented.'
  }
}

/** The progress rail. Steps already passed are clickable; later ones are not. */
function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.id} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => (done || active ? onJump(i) : undefined)}
              disabled={!done && !active}
              className={cn(
                'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : done
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-200 bg-slate-50 text-slate-400',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                {done ? <Check className="h-3.5 w-3.5" /> : <span className="tabular-nums">{i + 1}</span>}
                <span className="truncate">{s.label}</span>
              </span>
              <span className={cn('mt-0.5 hidden truncate text-[11px] sm:block', active ? 'text-white/70' : 'text-slate-400')}>
                {s.hint}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
