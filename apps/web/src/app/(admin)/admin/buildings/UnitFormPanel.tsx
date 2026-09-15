'use client'

import { useState } from 'react'
import { Loader2, UserCheck } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ImageManager } from '@/components/admin/ui/ImageManager'
import {
  ChipsInput, Field, FieldGrid, InlineNote, NumberInput, PillSelect,
  SelectInput, TextInput, Textarea, Toggle,
} from '@/components/admin/ui/form'
import { typeDef, typeLabel } from '@/lib/property-types'
import {
  FEATURE_SUGGESTIONS, FURNISHING_OPTIONS, OWNERSHIP_OPTIONS, VIEW_OPTIONS,
} from '@/lib/unit-attributes'
import { KIND_OPTIONS, LIFECYCLE_OPTIONS } from './UnitsManager'

// ── State ─────────────────────────────────────────────────────────────────────

export interface UnitFormState {
  kind: string
  name: string
  unitNumber: string
  floor: string
  bedrooms: string
  bathrooms: string
  areaSqm: string
  parkingSpaces: string
  lifecycle: string
  isUnitType: boolean
  furnishing: string
  ownership: string
  views: string[]
  features: string[]
  notes: string
  images: string[]
}

export function emptyUnit(): UnitFormState {
  return {
    kind: 'APARTMENT', name: '', unitNumber: '', floor: '',
    bedrooms: '', bathrooms: '', areaSqm: '', parkingSpaces: '',
    lifecycle: 'VACANT', isUnitType: false,
    furnishing: '', ownership: '', views: [], features: [], notes: '',
    images: [],
  }
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unitFormFrom(unit: any): UnitFormState {
  return {
    kind: unit.kind ?? 'APARTMENT',
    name: unit.name ?? '',
    unitNumber: unit.unitNumber ?? '',
    floor: str(unit.floor),
    bedrooms: str(unit.bedrooms),
    bathrooms: str(unit.bathrooms),
    areaSqm: str(unit.areaSqm),
    parkingSpaces: str(unit.parkingSpaces),
    lifecycle: unit.lifecycle ?? 'VACANT',
    isUnitType: !!unit.isUnitType,
    furnishing: unit.furnishing ?? '',
    ownership: unit.ownership ?? '',
    views: unit.views ?? [],
    features: unit.features ?? [],
    notes: unit.notes ?? '',
    images: unit.images ?? [],
  }
}

/**
 * Drop the fields that don't apply to the chosen type, so a stale value from a
 * previous type isn't saved — a land plot that was briefly an apartment must
 * not keep three bedrooms.
 */
export function buildUnitPayload(f: UnitFormState) {
  const def = typeDef(f.kind)
  return {
    kind: f.kind || undefined,
    name: f.name || null,
    unitNumber: f.unitNumber || null,
    floor: def.floor && f.floor !== '' ? Number(f.floor) : null,
    bedrooms: def.beds && f.bedrooms !== '' ? Number(f.bedrooms) : null,
    bathrooms: def.baths && f.bathrooms !== '' ? Number(f.bathrooms) : null,
    areaSqm: f.areaSqm !== '' ? Number(f.areaSqm) : null,
    parkingSpaces: f.parkingSpaces !== '' ? Number(f.parkingSpaces) : null,
    isUnitType: f.isUnitType,
    lifecycle: f.lifecycle || undefined,
    // Empty select means "not specified", which is null, not "".
    furnishing: f.furnishing || null,
    ownership: f.ownership || null,
    views: f.views,
    features: f.features,
    notes: f.notes || null,
    images: f.images,
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

/**
 * Everything a unit is.
 *
 * The old panel asked for nine fields. `furnishing`, `ownership`, `views`,
 * `features`, `parkingSpaces` and `notes` are all real columns that
 * `PUT /api/units/:id` has always accepted — and features and views are printed
 * on the public listing page and in the PDF proposal. There was simply no input
 * for any of them, so for anything not imported from Georgia they were empty.
 */
export function UnitFormPanel({
  initial, buildingId, unitId, ownerAssigned, onSave, onCancel, saving,
  hideNumbering, saveLabel,
}: {
  initial: UnitFormState
  buildingId: string
  unitId?: string
  ownerAssigned?: boolean
  onSave: (f: UnitFormState) => void
  onCancel: () => void
  saving: boolean
  /** Bulk add supplies the numbering itself. */
  hideNumbering?: boolean
  saveLabel?: string
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [f, setF] = useState<UnitFormState>(initial)
  const set = (patch: Partial<UnitFormState>) => setF((p) => ({ ...p, ...patch }))

  const def = typeDef(f.kind)
  const rentable = ['FOR_RENT', 'RENTED'].includes(f.lifecycle)

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      {/* What it is */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">What it is</p>
        <FieldGrid cols={4}>
          <Field label="Type" span={hideNumbering ? 2 : 1}>
            <SelectInput value={f.kind} onChange={(e) => set({ kind: e.target.value })} disabled={saving}>
              {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          </Field>
          <Field
            label="Name"
            optional
            span={2}
            hint="Shown on the website when the listing has no headline."
          >
            <TextInput
              value={f.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. 2BR Type A"
              disabled={saving}
            />
          </Field>
          {!hideNumbering && (
            <Field label="Unit no." optional>
              <TextInput
                value={f.unitNumber}
                onChange={(e) => set({ unitNumber: e.target.value })}
                placeholder="301"
                disabled={saving}
              />
            </Field>
          )}
        </FieldGrid>
      </div>

      {/* Size */}
      <div className="space-y-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Size</p>
        <FieldGrid cols={4}>
          {def.beds && (
            <Field label="Bedrooms" optional>
              <NumberInput
                min="0" value={f.bedrooms}
                onChange={(e) => set({ bedrooms: e.target.value })}
                placeholder="2" disabled={saving}
              />
            </Field>
          )}
          {def.baths && (
            <Field label="Bathrooms" optional>
              <NumberInput
                min="0" value={f.bathrooms}
                onChange={(e) => set({ bathrooms: e.target.value })}
                placeholder="1" disabled={saving}
              />
            </Field>
          )}
          <Field label={def.areaLabel} optional>
            <NumberInput
              min="0" unit="m²" value={f.areaSqm}
              onChange={(e) => set({ areaSqm: e.target.value })}
              placeholder="120" disabled={saving}
            />
          </Field>
          {def.floor && (
            <Field label="Floor" optional>
              <NumberInput
                value={f.floor}
                onChange={(e) => set({ floor: e.target.value })}
                placeholder="3" disabled={saving}
              />
            </Field>
          )}
          <Field label="Parking" optional hint="Spaces that come with it.">
            <NumberInput
              min="0" value={f.parkingSpaces}
              onChange={(e) => set({ parkingSpaces: e.target.value })}
              placeholder="1" disabled={saving}
            />
          </Field>
        </FieldGrid>
      </div>

      {/* Condition — none of this had an input before */}
      <div className="space-y-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Condition & outlook</p>
        <FieldGrid cols={2}>
          <Field
            label="Furnishing"
            optional
            hint={rentable ? 'Renters filter on this.' : undefined}
          >
            <SelectInput value={f.furnishing} onChange={(e) => set({ furnishing: e.target.value })} disabled={saving}>
              {FURNISHING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          </Field>
          <Field label="Ownership" optional hint="Freehold or leasehold title.">
            <SelectInput value={f.ownership} onChange={(e) => set({ ownership: e.target.value })} disabled={saving}>
              {OWNERSHIP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          </Field>
        </FieldGrid>

        <Field label="View" optional hint="Printed in the PDF proposal as “sea / city view”.">
          <PillSelect
            value={f.views}
            onChange={(views) => set({ views })}
            options={VIEW_OPTIONS}
            disabled={saving}
          />
        </Field>

        <Field label="Features" optional hint="Listed as bullets on the public property page.">
          <ChipsInput
            value={f.features}
            onChange={(features) => set({ features })}
            placeholder="e.g. Balcony, maid’s room…"
            suggestions={FEATURE_SUGGESTIONS}
            disabled={saving}
          />
        </Field>
      </div>

      {/* Status */}
      <div className="space-y-4 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
        <FieldGrid cols={2}>
          <Field
            label="Where it stands"
            hint="Changing this can close or update its listings to match."
          >
            <SelectInput value={f.lifecycle} onChange={(e) => set({ lifecycle: e.target.value })} disabled={saving}>
              {LIFECYCLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
          </Field>
        </FieldGrid>

        {/* A development we resell offers "1 bedroom" as a template many clients
            buy. We're the broker, not the developer, so there's no stock count —
            just a flag that it repeats. */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Toggle
            checked={f.isUnitType}
            onChange={(v) => set({ isUnitType: v })}
            label="This is a unit type, not one specific apartment"
            hint="For developments where the same “1 bedroom” is sold to many clients. It stays available to everyone, and which apartment each client got is recorded on their deal."
            disabled={saving}
          />
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <ImageManager
          value={f.images}
          onChange={(images) => set({ images })}
          folder="units"
          propertySlug={buildingId}
          label="Photos for this unit only"
          hint="Leave empty to use the property’s shared photos. Add some only if this unit needs its own."
          disabled={saving}
        />
      </div>

      {/* Internal note */}
      <div className="border-t border-slate-100 pt-4">
        <Field
          label="Internal note"
          optional
          hint="Only ever visible in here — never on the website."
        >
          <Textarea
            value={f.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
            placeholder="e.g. Owner wants viewings after 4pm"
            disabled={saving}
          />
        </Field>
      </div>

      {/* Assign to a portal user — existing units only */}
      {unitId && <AssignOwner apiUrl={apiUrl} unitId={unitId} alreadyAssigned={!!ownerAssigned} />}

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(f)}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-800 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveLabel ?? (unitId ? 'Save unit' : `Add ${typeLabel(f.kind).toLowerCase()}`)}
        </button>
      </div>
    </div>
  )
}

/** Hand a unit to a registered user so it shows in their portal. */
function AssignOwner({
  apiUrl, unitId, alreadyAssigned,
}: {
  apiUrl: string
  unitId: string
  alreadyAssigned: boolean
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [assigned, setAssigned] = useState(alreadyAssigned)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(clear: boolean) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`${apiUrl}/api/units/${unitId}/assign-owner`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clear ? null : email.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: d.message || 'Could not assign it.' }); return }
      setAssigned(!clear)
      if (clear) setEmail('')
      setMsg({ ok: true, text: d.message || (clear ? 'Owner cleared.' : 'Assigned.') })
    } catch {
      setMsg({ ok: false, text: 'Network error.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <UserCheck className="h-3.5 w-3.5" />
        Assign to a portal user
        {assigned && <span className="font-normal text-emerald-600">· currently assigned</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="owner@email.com"
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={busy || !email.trim()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Assign
        </button>
        {assigned && (
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
            className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-slate-600 transition-colors hover:text-red-600 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
      {msg && <InlineNote tone={msg.ok ? 'success' : 'error'}>{msg.text}</InlineNote>}
      <p className="text-[11px] text-slate-500">
        The unit appears in that user&rsquo;s portal. Works for any registered account, Google or email.
      </p>
    </div>
  )
}
