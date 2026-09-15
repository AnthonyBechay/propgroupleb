'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Coins, ExternalLink, FileText, Home, Image as ImageIcon, LayoutList,
  MapPin, Search, Sparkles,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { BuildingDocumentsManager } from '@/components/admin/BuildingDocumentsManager'
import { type OwnerRef } from '@/components/admin/OwnerPicker'
import { InlineNote } from '@/components/admin/ui/form'
import { PageHeader, SaveBar, SectionNav, type SectionLink } from '@/components/admin/ui/layout'
import { useUnsavedChanges } from '@/components/admin/ui/useUnsavedChanges'
import { countryFlag, siteFor } from '@/lib/market'
import { isKnownLocation } from '@/lib/lebanon-locations'
import { isResidential, showsBuildingSpecs } from '@/lib/property-types'
import {
  BasicsSection, DocumentsSection, HighlightsSection, InvestmentSection,
  LocationSection, MediaSection, PaymentPlansSection, SeoSection, SpecsSection,
} from './BuildingSections'
import {
  EMPTY_FIRST_LISTING, EMPTY_FIRST_UNIT, FirstUnitSection, listingTotal,
  type FirstListing, type FirstUnit,
} from './FirstUnitSection'
import { UnitsManager } from './UnitsManager'
import { buildingPayload, emptyBuildingForm, type BuildingFormState } from './building-form-state'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  buildingId?: string
}

/**
 * One property, one page — for creating it and for editing it.
 *
 * There used to be two screens that shared a subject and nothing else. Creating
 * was a four-step wizard; editing was a long scroll behind a tab bar, with the
 * units on the *other* tab and only reachable after the first save. So the
 * thing you learned while adding a property told you nothing about how to
 * change it, and pricing was a second visit to a second screen.
 *
 * Now both render the same sections in the same order. The only difference is
 * the one that is real: before the first save there is no record for units and
 * documents to hang off, so that slot holds the first unit inline; afterwards
 * the same slot holds the full units manager. Nothing moves.
 */
export function PropertyForm({ initialData, buildingId }: Props) {
  const router = useRouter()
  const isEdit = !!buildingId
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const units: any[] = useMemo(
    () => (Array.isArray(initialData?.units) ? initialData.units : []),
    [initialData],
  )
  const soleUnit = units.length === 1 ? units[0] : null

  const [form, setForm] = useState<BuildingFormState>(() => emptyBuildingForm(initialData))
  const [owner, setOwner] = useState<OwnerRef | null>(
    initialData?.ownerLead
      ? {
          id: initialData.ownerLead.id,
          name: initialData.ownerLead.name,
          phone: initialData.ownerLead.phone ?? initialData.ownerLead.whatsapp ?? null,
        }
      : null,
  )
  // Only used while creating — afterwards the units manager owns this.
  const [firstUnit, setFirstUnit] = useState<FirstUnit>(EMPTY_FIRST_UNIT)
  const [firstListing, setFirstListing] = useState<FirstListing>(EMPTY_FIRST_LISTING)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const snapshot = () => JSON.stringify({ form, ownerId: owner?.id ?? null, firstUnit, firstListing })
  const baseline = useRef(snapshot())
  const dirty = snapshot() !== baseline.current
  useUnsavedChanges(
    dirty && !saving,
    isEdit
      ? 'You have unsaved changes. Leave this page and lose them?'
      : 'This property has not been created yet. Leave and lose it?',
  )

  const set = (patch: Partial<BuildingFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }

  // Which sections apply comes from the shared type registry, once — so the
  // form, the filters and the public pages always agree.
  const kindsInPlay = units.length > 0 ? units.map((u) => u.kind) : [form.unitKind]
  const showBuildingSpecs = kindsInPlay.some((k) => showsBuildingSpecs(k))
  const residential = kindsInPlay.some((k) => isResidential(k))

  const sections: SectionLink[] = [
    { id: 'basics', label: 'The basics', icon: Building2 },
    { id: 'location', label: 'Where it is', icon: MapPin },
    { id: 'unit', label: isEdit ? 'Units & pricing' : 'Unit & price', icon: isEdit ? LayoutList : Home },
    ...(showBuildingSpecs ? [{ id: 'specs', label: 'The building', icon: Building2 }] : []),
    { id: 'media', label: 'Photos & video', icon: ImageIcon },
    { id: 'highlights', label: 'Selling points', icon: Sparkles },
    { id: 'investment', label: 'Investment', icon: Coins },
    { id: 'payment', label: 'Payment plans', icon: Coins },
    ...(isEdit ? [{ id: 'documents', label: 'Documents', icon: FileText }] : []),
    { id: 'seo', label: 'Search engines', icon: Search },
  ]

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'A property needs a title before it can be saved.'

    // The curated gazetteer only covers Lebanon. Enforcing it everywhere made
    // every imported Batumi property impossible to save.
    if (form.country === 'LEBANON' && !isKnownLocation({ city: form.city, neighborhood: form.neighborhood })) {
      errs.location = 'Pick a location from the search list — Lebanese locations come from a fixed gazetteer.'
    } else if (form.country !== 'LEBANON' && !form.city.trim()) {
      errs.location = 'Enter a city.'
    }

    if (!isEdit && firstListing.enabled) {
      const area = firstUnit.areaSqm !== '' ? Number(firstUnit.areaSqm) : 0
      if (!firstListing.price || Number(firstListing.price) <= 0) {
        errs.price = 'Enter a price, or switch off "Put it on the market now".'
      } else if (firstListing.priceMode === 'PER_SQM' && area <= 0) {
        errs.price = 'Set the area first — a price per m² needs one.'
      }
    }

    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      const first = errs.title ? 'basics' : errs.location ? 'location' : 'unit'
      document.getElementById(first)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return false
    }
    return true
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (inFlight.current) return
    setError(null)
    if (!validate()) return

    inFlight.current = true
    setSaving(true)

    const payload = {
      ...buildingPayload(form, { showBuildingSpecs }),
      ownerLeadId: owner?.id ?? null,
    }

    try {
      const res = await fetch(
        isEdit ? `${apiUrl}/api/buildings/${buildingId}` : `${apiUrl}/api/buildings`,
        {
          method: isEdit ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message || data.error || 'Could not save this property.')
        inFlight.current = false
        setSaving(false)
        return
      }

      if (isEdit) {
        await syncSoleUnitKind()
        baseline.current = snapshot()
        inFlight.current = false
        setSaving(false)
        setSaved(true)
        toast({ title: 'Saved', description: `${form.title} is up to date.` })
        setTimeout(() => setSaved(false), 2500)
        router.refresh()
        return
      }

      const newId = (data.data ?? data)?.id
      if (!newId) {
        setError('The property was not created.')
        inFlight.current = false
        setSaving(false)
        return
      }

      await createFirstUnitAndListing(newId)

      toast({
        title: 'Property created',
        description: firstListing.enabled
          ? `${form.title} is on the market.`
          : `${form.title} was saved without a price.`,
      })
      // Land on the property itself, not the list. There is almost always
      // something else to add, and it is the same page you were just on.
      baseline.current = snapshot()
      router.push(`/admin/buildings/${newId}`)
      router.refresh()
    } catch {
      setError('Network error — nothing was saved.')
      inFlight.current = false
      setSaving(false)
    }
  }

  /**
   * The property type lives on the unit, not the building. A property with no
   * unit yet gets one, which also repairs older records saved without one.
   */
  async function syncSoleUnitKind() {
    if (units.length > 1 || !form.unitKind) return
    try {
      if (soleUnit) {
        if (form.unitKind !== soleUnit.kind) {
          await fetch(`${apiUrl}/api/units/${soleUnit.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: form.unitKind }),
          })
        }
      } else {
        await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: form.unitKind, lifecycle: 'VACANT' }),
        })
      }
    } catch {
      // The property itself is saved; the type change is best-effort.
    }
  }

  async function createFirstUnitAndListing(newBuildingId: string) {
    const area = firstUnit.areaSqm !== '' ? Number(firstUnit.areaSqm) : 0
    const lifecycle = firstListing.enabled
      ? (firstListing.intent === 'FOR_RENT' ? 'FOR_RENT' : 'FOR_SALE')
      : 'VACANT'

    const uRes = await fetch(`${apiUrl}/api/buildings/${newBuildingId}/units`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: form.unitKind,
        bedrooms: firstUnit.bedrooms !== '' ? Number(firstUnit.bedrooms) : null,
        bathrooms: firstUnit.bathrooms !== '' ? Number(firstUnit.bathrooms) : null,
        areaSqm: area || null,
        floor: firstUnit.floor !== '' ? Number(firstUnit.floor) : null,
        // Photos live on the property, not duplicated onto the unit.
        lifecycle,
      }),
    })
    const createdUnit = (await uRes.json().catch(() => ({}))).data ?? {}
    if (!firstListing.enabled || !createdUnit?.id) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = {
      subjectType: 'UNIT',
      unitId: createdUnit.id,
      buildingId: newBuildingId,
      intent: firstListing.intent,
      price: listingTotal(firstUnit, firstListing),
      currency: firstListing.currency,
      status: firstListing.status,
      visibility: 'PUBLIC',
      negotiable: firstListing.negotiable,
      highlights: [],
    }
    if (firstListing.intent === 'FOR_RENT') body.rentPeriod = firstListing.rentPeriod

    const lRes = await fetch(`${apiUrl}/api/listings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!lRes.ok) {
      // The property exists and the unit exists; only the price didn't land.
      // Saying so is better than a silent catch — without a listing the site
      // shows this property with no price at all.
      toast({
        title: 'Saved, but without a price',
        description: 'The listing could not be created. Add it from Units & pricing.',
        variant: 'destructive',
      })
    }
  }

  // ── AI SEO ──────────────────────────────────────────────────────────────────

  async function generateSeo() {
    setAiLoading(true)
    setAiError(null)
    try {
      // Editing reads the saved record; creating sends what is on screen,
      // because there is nothing saved to read.
      const body = isEdit
        ? { type: 'building', id: buildingId }
        : {
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
          }

      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAiError(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      setForm((prev) => ({
        ...prev,
        metaTitle: s.metaTitle ?? prev.metaTitle,
        metaDescription: s.metaDescription ?? prev.metaDescription,
        // Only fill the summary if nobody has written one.
        shortDescription: prev.shortDescription || s.shortDescription || prev.shortDescription,
      }))
      toast({ title: 'SEO written', description: 'Review it, then save.' })
    } catch {
      setAiError('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hidden = form.visibility === 'HIDDEN'

  return (
    <div>
      <PageHeader
        title={isEdit ? (initialData?.title ?? 'Property') : 'Add a property'}
        description={
          isEdit && initialData
            ? <>{countryFlag(form.country)} {[form.city, form.caza].filter(Boolean).join(', ') || 'No location set'} · shows on {siteFor(form.country)}</>
            : 'Everything the website will show about it. Only the title and a location are required.'
        }
        backHref="/admin/buildings"
        crumbs={[
          { label: 'Properties', href: '/admin/buildings' },
          { label: isEdit ? (initialData?.title ?? 'Property') : 'New' },
        ]}
        meta={isEdit ? (
          <>
            {initialData?.ref && (
              <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-500">
                {initialData.ref}
              </span>
            )}
            {hidden && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">Hidden</span>
            )}
            {form.featured && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Featured</span>
            )}
          </>
        ) : undefined}
        actions={
          isEdit && initialData?.slug && !hidden ? (
            <a
              href={`/listings/${initialData.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on site
            </a>
          ) : undefined
        }
      />

      <div className="flex gap-10">
        {/* `max-w-3xl`: the shell's container runs to 1600px and a text field
            stretched across all of it is unreadable. */}
        <form onSubmit={handleSubmit} className="min-w-0 max-w-3xl flex-1 space-y-6">
          {error && <InlineNote tone="error">{error}</InlineNote>}

          <BasicsSection
            f={form}
            set={set}
            owner={owner}
            onOwnerChange={(o) => { setOwner(o); setSaved(false) }}
            unitCount={units.length}
            errors={fieldErrors}
            disabled={saving}
          />

          <LocationSection f={form} set={set} errors={fieldErrors} disabled={saving} />

          {/* The same slot in both modes — inline before the first save,
              because units can't exist without a property to hang off. */}
          {isEdit ? (
            <UnitsManager
              buildingId={buildingId!}
              buildingImages={form.images}
              buildingTitle={form.title}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              buildingListings={(initialData?.listings ?? []) as any[]}
            />
          ) : (
            <FirstUnitSection
              unitKind={form.unitKind}
              unit={firstUnit}
              listing={firstListing}
              onUnit={(patch) => setFirstUnit((p) => ({ ...p, ...patch }))}
              onListing={(patch) => setFirstListing((p) => ({ ...p, ...patch }))}
              onLocationUrl={(url) => set({ locationUrl: url })}
              disabled={saving}
              error={fieldErrors.price}
            />
          )}

          {showBuildingSpecs && <SpecsSection f={form} set={set} residential={residential} disabled={saving} />}

          <MediaSection f={form} set={set} buildingId={buildingId} disabled={saving} />

          <HighlightsSection f={form} set={set} disabled={saving} />

          <InvestmentSection f={form} set={set} disabled={saving} />

          <PaymentPlansSection f={form} set={set} />

          {isEdit && buildingId && (
            <DocumentsSection>
              <BuildingDocumentsManager buildingId={buildingId} />
            </DocumentsSection>
          )}

          <SeoSection
            f={form}
            set={set}
            onGenerate={generateSeo}
            generating={aiLoading}
            generateError={aiError}
            generateDisabledReason={form.title.trim() ? null : 'Add a title first — the AI reads what you entered above.'}
            disabled={saving}
          />

          <SaveBar
            dirty={dirty}
            saving={saving}
            saved={saved}
            onSave={() => handleSubmit()}
            cancelHref="/admin/buildings"
            saveLabel={isEdit ? 'Save changes' : 'Create property'}
          />
        </form>

        <SectionNav sections={sections} />
      </div>
    </div>
  )
}
