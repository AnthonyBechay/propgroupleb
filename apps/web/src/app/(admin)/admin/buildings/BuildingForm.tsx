'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Coins, FileText, Image as ImageIcon, MapPin, Search, Sparkles,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { BuildingDocumentsManager } from '@/components/admin/BuildingDocumentsManager'
import { OwnerPicker, type OwnerRef } from '@/components/admin/OwnerPicker'
import { InlineNote } from '@/components/admin/ui/form'
import { PageHeader, SaveBar, SectionNav, type SectionLink } from '@/components/admin/ui/layout'
import { useUnsavedChanges } from '@/components/admin/ui/useUnsavedChanges'
import { isKnownLocation } from '@/lib/lebanon-locations'
import { isResidential, showsBuildingSpecs } from '@/lib/property-types'
import {
  BasicsSection, DocumentsSection, HighlightsSection, InvestmentSection,
  LocationSection, MediaSection, PaymentPlansSection, SeoSection, SpecsSection,
} from './BuildingSections'
import {
  buildingPayload, emptyBuildingForm, type BuildingFormState,
} from './building-form-state'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: any
  buildingId?: string
  /** Hides the self-contained page header when a parent supplies its own. */
  embedded?: boolean
}

/**
 * Editing a property.
 *
 * What changed, beyond the fields themselves:
 *  - **Save follows you.** The button used to be at the very bottom, past nine
 *    sections; fixing a typo in the title meant scrolling the whole form to
 *    commit it, and the confirmation appeared down there too. The bar is now
 *    sticky, says whether anything is unsaved, and takes ⌘S.
 *  - **Leaving warns you.** Nothing stood between a half-typed description and
 *    the browser's back gesture.
 *  - **The sections are navigable.** Nine stacked cards with no index.
 */
export function BuildingForm({ initialData, buildingId, embedded }: Props) {
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

  const [saving, setSaving] = useState(false)
  // `saving` is read from a closure, so two triggers in one tick (⌘S plus a
  // click, or an impatient double-click) both see `false`. The ref is current.
  const inFlight = useRef(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // The snapshot the form is compared against to decide "unsaved changes". It
  // is replaced on a successful save rather than on every render, so the bar
  // reflects what the server has, not what the last keystroke did.
  const baseline = useRef(JSON.stringify({ form, ownerId: owner?.id ?? null }))
  const dirty = JSON.stringify({ form, ownerId: owner?.id ?? null }) !== baseline.current

  useUnsavedChanges(dirty && !saving)

  const set = (patch: Partial<BuildingFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setSaved(false)
  }

  // Which sections apply is decided by the property type, once, from the shared
  // registry — so the form, the filters and the public pages always agree.
  const kindsInPlay = units.length > 0 ? units.map((u) => u.kind) : [form.unitKind]
  const showBuildingSpecs = kindsInPlay.some((k) => showsBuildingSpecs(k))
  const residential = kindsInPlay.some((k) => isResidential(k))

  const sections: SectionLink[] = [
    { id: 'basics', label: 'The basics', icon: Building2 },
    { id: 'location', label: 'Where it is', icon: MapPin },
    ...(showBuildingSpecs ? [{ id: 'specs', label: 'The building', icon: Building2 }] : []),
    { id: 'highlights', label: 'Selling points', icon: Sparkles },
    { id: 'media', label: 'Photos & video', icon: ImageIcon },
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

    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      const first = errs.title ? 'basics' : 'location'
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

      // The property type lives on the unit, so save it there too. A property
      // with no unit yet gets one, which also repairs older records saved
      // without one.
      if (isEdit && units.length <= 1 && form.unitKind) {
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

      baseline.current = JSON.stringify({ form, ownerId: owner?.id ?? null })
      inFlight.current = false
      setSaving(false)
      setSaved(true)
      toast({ title: 'Saved', description: `${form.title} is up to date.` })
      setTimeout(() => setSaved(false), 2500)

      if (embedded) {
        router.refresh()
      } else {
        router.push('/admin/buildings')
        router.refresh()
      }
    } catch {
      setError('Network error — the property was not saved.')
      inFlight.current = false
      setSaving(false)
    }
  }

  // ── AI SEO ──────────────────────────────────────────────────────────────────

  async function generateSeo() {
    if (!buildingId) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'building', id: buildingId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setAiError(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      setForm((prev) => ({
        ...prev,
        metaTitle: s.metaTitle ?? prev.metaTitle,
        metaDescription: s.metaDescription ?? prev.metaDescription,
        // Only fill the summary if the admin hasn't written one.
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

  const body = (
    // `max-w-3xl` because the shell's container is 1600px wide and a text
    // field stretched across all of it is unreadable — the section nav takes
    // the space to the right instead.
    <form onSubmit={handleSubmit} className="min-w-0 max-w-3xl flex-1 space-y-5">
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

      {showBuildingSpecs && <SpecsSection f={form} set={set} residential={residential} disabled={saving} />}

      <HighlightsSection f={form} set={set} disabled={saving} />

      {/* Removing a photo here deletes it from storage immediately, because the
          property already points at it and a stale reference renders as a
          broken image on the live site. */}
      <MediaSection f={form} set={set} buildingId={buildingId} disabled={saving} />

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
        generateDisabledReason={isEdit ? null : 'Save the property first — the AI reads its saved details.'}
        disabled={saving}
      />

      <SaveBar
        dirty={dirty}
        saving={saving}
        saved={saved}
        onSave={() => handleSubmit()}
        cancelHref={embedded ? undefined : '/admin/buildings'}
        saveLabel={isEdit ? 'Save changes' : 'Create property'}
      />
    </form>
  )

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title={isEdit ? 'Edit property' : 'Add property'}
          description={isEdit ? initialData?.title : 'Everything the website will show about it.'}
          backHref="/admin/buildings"
          crumbs={[{ label: 'Properties', href: '/admin/buildings' }, { label: isEdit ? 'Edit' : 'New' }]}
        />
      )}
      <div className="flex gap-8">
        {body}
        <SectionNav sections={sections} />
      </div>
    </div>
  )
}
