'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bed, Building2, Copy, Layers, LayoutList, Loader2, Pencil, Plus, Square, Tag,
  Trash2, X,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/admin/ui/ConfirmDialog'
import { InlineNote } from '@/components/admin/ui/form'
import { EmptyState, FormSection } from '@/components/admin/ui/layout'
import { PriceSummary } from '@/components/admin/ui/PriceSummary'
import { ALL_PROPERTY_KINDS, typeDef, typeLabel } from '@/lib/property-types'
import { buildingRefOf, unitRef } from '@/lib/reference'
import { cn } from '@/lib/utils'
import { UnitOptions } from './UnitOptions'
import { UnitFormPanel, buildUnitPayload, emptyUnit, unitFormFrom, type UnitFormState } from './UnitFormPanel'
import { ListingEditPanel, ListingQuickForm } from './ListingPanels'

// ── Constants ─────────────────────────────────────────────────────────────────

export const LIFECYCLE_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'VACANT', label: 'Vacant' },
  { value: 'FOR_SALE', label: 'For sale' },
  { value: 'FOR_RENT', label: 'For rent' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'RENTED', label: 'Rented' },
  { value: 'OWNER_OCCUPIED', label: 'Owner occupied' },
  { value: 'OFF_MARKET', label: 'Off market' },
]

export const LIFECYCLE_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-500',
  VACANT: 'bg-zinc-100 text-zinc-600',
  FOR_SALE: 'bg-emerald-100 text-emerald-700',
  FOR_RENT: 'bg-sky-100 text-sky-700',
  RESERVED: 'bg-amber-100 text-amber-700',
  SOLD: 'bg-zinc-200 text-zinc-600',
  RENTED: 'bg-zinc-200 text-zinc-600',
  OWNER_OCCUPIED: 'bg-purple-100 text-purple-700',
  OFF_MARKET: 'bg-zinc-100 text-zinc-400',
}

const LISTING_INTENT_COLORS: Record<string, string> = {
  FOR_SALE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FOR_RENT: 'bg-sky-100 text-sky-700 border-sky-200',
}

const LISTING_STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  DRAFT: 'bg-zinc-400',
  UNDER_OFFER: 'bg-amber-500',
  CLOSED: 'bg-red-400',
  ARCHIVED: 'bg-zinc-300',
}

export const KIND_OPTIONS = ALL_PROPERTY_KINDS.map((value) => ({ value, label: typeLabel(value) }))

/** The cheapest total across a unit's finish options, or null. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function optionFrom(unit: any): number | null {
  const area = Number(unit?.areaSqm) || 0
  if (area <= 0) return null
  const totals = (unit.options ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((o: any) => Number(o.pricePerSqm) * area)
    .filter((n: number) => Number.isFinite(n) && n > 0)
  return totals.length ? Math.round(Math.min(...totals)) : null
}

export function formatPrice(price: number, currency: string) {
  if (currency === 'LBP') return `${(price / 1_000_000).toFixed(1)}M LBP`
  return `$${Number(price).toLocaleString()}`
}

type PanelMode = 'unit-edit' | 'listing-create' | 'listing-edit'

/**
 * The units inside a property, and the listings on them.
 *
 * The unit form here captured nine of the twenty-odd columns a unit has. The
 * rest — how it is furnished, freehold or leasehold, what it looks out at, its
 * features, its parking, any internal note — are accepted by the API, printed
 * on the public listing page, and had no input anywhere in the back office.
 *
 * It also gained the two things a development actually needs: adding a floor's
 * worth of units in one go, and duplicating one that is already right.
 */
export function UnitsManager({
  buildingId, buildingImages = [], buildingTitle, buildingListings = [],
}: {
  buildingId: string
  buildingImages?: string[]
  buildingTitle?: string
  /** Legacy whole-building listings, so the price summary counts them. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildingListings?: any[]
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [expanded, setExpanded] = useState<{ id: string; mode: PanelMode; listingId?: string } | null>(null)
  const [adding, setAdding] = useState<null | 'one' | 'many'>(null)
  const [saving, setSaving] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchUnits = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await res.json()
      setUnits(data.data ?? data ?? [])
    } catch {
      setError('Could not load the units.')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, buildingId])

  useEffect(() => { fetchUnits() }, [fetchUnits])

  const stats = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listings = units.flatMap((u: any) => u.listings ?? [])
    return {
      total: listings.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      active: listings.filter((l: any) => l.status === 'ACTIVE').length,
    }
  }, [units])

  // Units priced both ways at once — the listing wins, the options are dead.
  const conflicted = useMemo(
    () => units
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((u: any) =>
        (u.options?.length ?? 0) > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        && (u.listings ?? []).some((l: any) => ['ACTIVE', 'UNDER_OFFER'].includes(l.status)))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => u.name || (u.unitNumber ? `Unit ${u.unitNumber}` : 'A unit')),
    [units],
  )

  function openPanel(unitId: string, mode: PanelMode, listingId?: string) {
    setExpanded((prev) =>
      prev?.id === unitId && prev.mode === mode && prev.listingId === listingId
        ? null
        : { id: unitId, mode, listingId })
    setAdding(null)
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  async function createUnit(f: UnitFormState) {
    setSaving(true)
    try {
      const res = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildUnitPayload(f)),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.message || 'Could not create the unit.')
        return
      }
      setAdding(null)
      toast({ title: 'Unit added' })
      await fetchUnits()
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Create a run of units in one pass.
   *
   * A twelve-floor development meant filling the same form twelve times,
   * changing one digit each time. Everything but the number is shared, so it is
   * asked once.
   */
  async function createMany(template: UnitFormState, count: number, startAt: number, prefix: string) {
    setSaving(true)
    const payload = buildUnitPayload(template)
    let made = 0
    const failures: number[] = []
    for (let i = 0; i < count; i++) {
      const n = startAt + i
      try {
        const res = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, unitNumber: `${prefix}${n}`, name: template.name || null }),
        })
        if (res.ok) made++
        else failures.push(n)
      } catch {
        failures.push(n)
      }
    }
    setSaving(false)
    setAdding(null)
    await fetchUnits()
    toast({
      title: `${made} unit${made === 1 ? '' : 's'} added`,
      description: failures.length ? `${failures.length} failed: ${failures.join(', ')}` : undefined,
      variant: failures.length ? 'destructive' : 'default',
    })
  }

  async function updateUnit(unitId: string, f: UnitFormState) {
    setSaving(true)
    setNotice(null)
    try {
      const res = await fetch(`${apiUrl}/api/units/${unitId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildUnitPayload(f)),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.message || 'Could not update the unit.')
        return
      }
      // Surface the cascade ("1 listing updated to match") so the admin sees
      // that changing a lifecycle also closed or updated listings.
      if (d.message && /listing/i.test(d.message)) {
        setNotice(d.message)
        setTimeout(() => setNotice(null), 6000)
      }
      setExpanded(null)
      toast({ title: 'Unit saved' })
      await fetchUnits()
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  /** Copy a unit that is already right, so only the number has to change. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function duplicateUnit(unit: any) {
    setSaving(true)
    try {
      const payload = buildUnitPayload(unitFormFrom(unit))
      const res = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          unitNumber: payload.unitNumber ? `${payload.unitNumber} copy` : null,
          // A copy never inherits a live market state — it has no listing yet.
          lifecycle: 'DRAFT',
        }),
      })
      if (!res.ok) { setError('Could not duplicate the unit.'); return }
      toast({ title: 'Unit duplicated', description: 'It starts as a draft — give it a number.' })
      await fetchUnits()
    } finally {
      setSaving(false)
    }
  }

  async function deleteUnit() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`${apiUrl}/api/units/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' })
      toast({ title: 'Unit deleted' })
      setDeleteTarget(null)
      await fetchUnits()
    } catch {
      setError('Could not delete the unit.')
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <FormSection id="unit" title="Units & pricing" icon={<LayoutList className="h-4 w-4" />}>
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading units…</span>
        </div>
      </FormSection>
    )
  }

  return (
    <FormSection
      id="unit"
      title="Units & pricing"
      description={
        units.length === 0
          ? 'A property needs at least one unit — the unit is what carries the price.'
          : `${units.length} unit${units.length === 1 ? '' : 's'}${
              stats.total > 0 ? ` · ${stats.active} of ${stats.total} listing${stats.total === 1 ? '' : 's'} live` : ''
            }`
      }
      icon={<LayoutList className="h-4 w-4" />}
      aside={
        <div className="flex flex-wrap items-center gap-2">
          {/* The round trip closes here. A listing now links back to its
              property, and the property links out to its listings — before
              this, neither direction existed and the two lived as separate
              lists of the same thing. */}
          {stats.total > 0 && (
            <Link
              href={`/admin/listings?buildingId=${buildingId}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <Tag className="h-3.5 w-3.5" /> All {stats.total} listing{stats.total === 1 ? '' : 's'}
            </Link>
          )}
          {/* "List the whole building" is gone. A whole-building listing
              (`subjectType: BUILDING`) duplicates something the model already
              expresses better: a unit of kind WHOLE_BUILDING. Two ways to say
              one thing meant price could come from either, and a property could
              carry both at once. Existing ones still work and still edit. */}
          <button
            type="button"
            onClick={() => { setAdding((a) => (a === 'many' ? null : 'many')); setExpanded(null) }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Layers className="h-3.5 w-3.5" /> Add several
          </button>
          <button
            type="button"
            onClick={() => { setAdding((a) => (a === 'one' ? null : 'one')); setExpanded(null) }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add unit
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* What the public site will actually print. See PriceSummary. */}
        <PriceSummary units={units} buildingListings={buildingListings} />

        {/* A unit can be priced two ways and only one of them wins. Nothing
            said so, so a Georgian unit carrying finish options plus a listing
            quoted the listing and silently ignored every option price. */}
        {conflicted.length > 0 && (
          <InlineNote tone="warning">
            {conflicted.length === 1
              ? <><strong>{conflicted[0]}</strong> has both a live listing and finish options.</>
              : <><strong>{conflicted.length} units</strong> have both a live listing and finish options.</>}
            {' '}The website quotes the listing and ignores the per-m² options. Keep one: a listing
            for a fixed price, finish options when the buyer picks a specification.
          </InlineNote>
        )}

        {error && (
          <InlineNote tone="error">
            <div className="flex items-start justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          </InlineNote>
        )}
        {notice && (
          <InlineNote tone="success">
            <div className="flex items-start justify-between gap-2">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          </InlineNote>
        )}

        {adding === 'one' && (
          <UnitFormPanel
            initial={emptyUnit()}
            buildingId={buildingId}
            onSave={createUnit}
            onCancel={() => setAdding(null)}
            saving={saving}
          />
        )}
        {adding === 'many' && (
          <BulkAddUnits
            buildingId={buildingId}
            saving={saving}
            onCancel={() => setAdding(null)}
            onCreate={createMany}
          />
        )}

        {units.length === 0 && !adding && (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No units yet"
            description="A property needs at least one unit before it can be listed — for a single apartment or a villa, that unit is the property itself."
            action={
              <button
                type="button"
                onClick={() => setAdding('one')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" /> Add the first unit
              </button>
            }
          />
        )}

        {units.length > 0 && (
          <ul className="space-y-2.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {units.map((unit: any) => {
              const panelUnit = expanded?.id === unit.id
              const editOpen = panelUnit && expanded?.mode === 'unit-edit'
              const createOpen = panelUnit && expanded?.mode === 'listing-create'
              const editListingId = panelUnit && expanded?.mode === 'listing-edit' ? expanded.listingId : null
              const label = unit.name || (unit.unitNumber ? `Unit ${unit.unitNumber}` : null) || `Unit ${unit.id.slice(0, 6)}`
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const listings: any[] = unit.listings ?? []
              const ref = unitRef(unit, units.length, unit.ref ? buildingRefOf(unit.ref) : null)
              const cover = unit.images?.[0] ?? buildingImages[0]
              const def = typeDef(unit.kind)

              return (
                <li
                  key={unit.id}
                  className={cn(
                    'overflow-hidden rounded-xl border bg-white transition-colors',
                    panelUnit ? 'border-slate-300 shadow-sm' : 'border-slate-200',
                  )}
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
                    {cover && (
                      <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={normalizeFileUrl(cover)} alt="" className="h-full w-full object-cover" />
                        {unit.images?.length > 0 && (
                          <span className="absolute bottom-0 right-0 bg-slate-900/80 px-1 text-[9px] font-medium text-white">
                            {unit.images.length}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ref && (
                          <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                            {ref}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-slate-900">{label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {typeLabel(unit.kind)}
                        </span>
                        {unit.lifecycle && (
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            LIFECYCLE_COLORS[unit.lifecycle] ?? 'bg-slate-100 text-slate-500',
                          )}>
                            {LIFECYCLE_OPTIONS.find((o) => o.value === unit.lifecycle)?.label ?? unit.lifecycle}
                          </span>
                        )}
                        {unit.isUnitType && (
                          <span
                            className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
                            title="A repeatable type, not one specific apartment"
                          >
                            Type
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {unit.floor != null && (
                          <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> Floor {unit.floor}</span>
                        )}
                        {def.beds && unit.bedrooms != null && (
                          <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {unit.bedrooms} bed</span>
                        )}
                        {unit.areaSqm != null && (
                          <span className="flex items-center gap-1"><Square className="h-3 w-3" /> {unit.areaSqm} m²</span>
                        )}
                        {unit.ownerUserId && <span className="text-emerald-600">Assigned to a user</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {listings.map((l: any) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => openPanel(unit.id, 'listing-edit', l.id)}
                          title="Edit this listing here"
                          className={cn(
                            'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all',
                            editListingId === l.id ? 'ring-2 ring-amber-400 ring-offset-1' : 'hover:opacity-80',
                            LISTING_INTENT_COLORS[l.intent] ?? 'border-slate-200 bg-slate-100 text-slate-600',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', LISTING_STATUS_DOT[l.status] ?? 'bg-slate-400')} />
                          {l.intent === 'FOR_SALE' ? 'Sale' : 'Rent'}
                          {l.price ? ` · ${formatPrice(l.price, l.currency)}` : ''}
                        </button>
                      ))}

                      {/* Finish options are the other way a unit is priced, and
                          they showed only as a word in the row's subtitle — you
                          had to open Edit to discover that a Georgian unit's
                          entire price lives in them. */}
                      {unit.options?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => openPanel(unit.id, 'unit-edit')}
                          title="Finish options — the price per m² a buyer chooses between"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          {unit.options.length} finish{unit.options.length === 1 ? '' : 'es'}
                          {optionFrom(unit) != null && ` · from ${formatPrice(optionFrom(unit)!, unit.options[0].currency ?? 'USD')}`}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openPanel(unit.id, 'listing-create')}
                        title="Put this unit on the market"
                        className={cn(
                          'inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
                          createOpen
                            ? 'border-sky-600 bg-sky-600 text-white'
                            : 'border-sky-200 text-sky-600 hover:bg-sky-50',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {listings.length === 0 ? 'List it' : 'Another'}
                      </button>

                      <div className="ml-auto flex items-center gap-0.5 border-l border-slate-100 pl-1.5 sm:ml-0">
                        <RowAction
                          label={editOpen ? 'Close' : 'Edit unit'}
                          active={editOpen}
                          onClick={() => openPanel(unit.id, 'unit-edit')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </RowAction>
                        <RowAction label="Duplicate" onClick={() => duplicateUnit(unit)} disabled={saving}>
                          <Copy className="h-3.5 w-3.5" />
                        </RowAction>
                        <RowAction label="Delete unit" danger onClick={() => setDeleteTarget(unit)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </RowAction>
                      </div>
                    </div>
                  </div>

                  {editOpen && (
                    <div className="space-y-4 border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
                      <UnitFormPanel
                        initial={unitFormFrom(unit)}
                        buildingId={buildingId}
                        unitId={unit.id}
                        ownerAssigned={!!unit.ownerUserId}
                        onSave={(f) => updateUnit(unit.id, f)}
                        onCancel={() => setExpanded(null)}
                        saving={saving}
                      />
                      {/* Finish / payment options — how off-plan projects are
                          actually priced, and what the Georgia import carries. */}
                      <UnitOptions
                        buildingId={buildingId}
                        unitId={unit.id}
                        options={unit.options ?? []}
                        areaSqm={unit.areaSqm}
                        onChanged={fetchUnits}
                      />
                    </div>
                  )}

                  {createOpen && (
                    <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
                      <ListingQuickForm
                        buildingId={buildingId}
                        unitId={unit.id}
                        unitLabel={label}
                        defaultIntent={unit.lifecycle === 'FOR_RENT' ? 'FOR_RENT' : 'FOR_SALE'}
                        areaSqm={unit.areaSqm}
                        onSuccess={async () => { setExpanded(null); await fetchUnits() }}
                        onCancel={() => setExpanded(null)}
                      />
                    </div>
                  )}

                  {editListingId && (
                    <div className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5">
                      <ListingEditPanel
                        listingId={editListingId}
                        listingLabel={label}
                        unitId={unit.id}
                        onSuccess={async () => { setExpanded(null); await fetchUnits() }}
                        onCancel={() => setExpanded(null)}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          tone="danger"
          busy={deleting}
          title={`Delete ${deleteTarget?.name || (deleteTarget?.unitNumber ? `unit ${deleteTarget.unitNumber}` : 'this unit')}?`}
          description={buildingTitle ? `In ${buildingTitle}.` : undefined}
          consequences={[
            deleteTarget?.listings?.length
              ? `Its ${deleteTarget.listings.length} listing${deleteTarget.listings.length === 1 ? '' : 's'} will be removed from the website.`
              : 'It has no listings.',
            deleteTarget?.options?.length
              ? `${deleteTarget.options.length} finish option${deleteTarget.options.length === 1 ? '' : 's'} will go with it.`
              : null,
            'This cannot be undone.',
          ].filter(Boolean) as string[]}
          confirmLabel="Delete unit"
          onConfirm={deleteUnit}
          onClose={() => !deleting && setDeleteTarget(null)}
        />
      </div>
    </FormSection>
  )
}

function RowAction({
  label, onClick, children, danger, active, disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40',
        active
          ? 'bg-slate-200 text-slate-900'
          : danger
            ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  )
}

// ── Bulk add ──────────────────────────────────────────────────────────────────

/**
 * "Floors 1–12, two-bed, 95 m²" in one action.
 *
 * The shared facts are edited in the normal unit form; this only adds the
 * numbering, so there is nothing new to learn and nothing to keep in sync.
 */
function BulkAddUnits({
  buildingId, saving, onCancel, onCreate,
}: {
  buildingId: string
  saving: boolean
  onCancel: () => void
  onCreate: (template: UnitFormState, count: number, startAt: number, prefix: string) => void
}) {
  const [count, setCount] = useState('5')
  const [startAt, setStartAt] = useState('1')
  const [prefix, setPrefix] = useState('')

  const n = Math.min(Math.max(parseInt(count || '0', 10) || 0, 0), 50)
  const from = parseInt(startAt || '1', 10) || 1
  const preview = n > 0
    ? Array.from({ length: Math.min(n, 3) }, (_, i) => `${prefix}${from + i}`).join(', ') + (n > 3 ? `, … ${prefix}${from + n - 1}` : '')
    : '—'

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-slate-800">Add several units at once</p>
        <p className="mt-0.5 text-xs text-slate-500">
          They all share the details below and differ only by number. Adjust any of them afterwards.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">How many</span>
          <input
            type="number" min="1" max="50" value={count}
            onChange={(e) => setCount(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Start at</span>
          <input
            type="number" value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Prefix</span>
          <input
            value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="A-"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <div className="col-span-2 sm:col-span-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Numbers</span>
          <p className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500">
            {preview}
          </p>
        </div>
      </div>

      {n > 20 && (
        <InlineNote tone="warning">
          {n} units will be created one at a time — give it a moment.
        </InlineNote>
      )}

      <UnitFormPanel
        initial={emptyUnit()}
        buildingId={buildingId}
        hideNumbering
        saveLabel={n > 0 ? `Create ${n} unit${n === 1 ? '' : 's'}` : 'Create units'}
        saving={saving}
        onCancel={onCancel}
        onSave={(f) => n > 0 && onCreate(f, n, from, prefix)}
      />
    </div>
  )
}

