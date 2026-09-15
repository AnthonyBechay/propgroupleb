'use client'

/**
 * The unit and the price, on the create screen.
 *
 * Units used to live behind a second tab that only appeared once the property
 * had been saved — so creating a property and pricing it were two screens and
 * two saves, and in between there was a property with no price on it. For the
 * overwhelmingly common case (one apartment, one price) the unit *is* the
 * property, and asking about it here costs one section.
 *
 * Once saved, this same slot in the same order becomes the full units manager.
 * The shape of the page doesn't change between creating and editing — which is
 * the whole point.
 */

import { useState } from 'react'
import { ClipboardPaste, Home, Loader2, Sparkles, X } from 'lucide-react'
import {
  Field, FieldGrid, InlineNote, MoneyInput, NumberInput, SegmentedControl,
  SelectInput, Textarea, Toggle,
} from '@/components/admin/ui/form'
import { FormSection } from '@/components/admin/ui/layout'
import { PriceSummary } from '@/components/admin/ui/PriceSummary'
import { typeDef, typeLabel } from '@/lib/property-types'
import { describeParsed, parsePropertyText, type ParsedProperty } from '@/lib/parse-property-text'
import { cn } from '@/lib/utils'

export interface FirstUnit {
  bedrooms: string
  bathrooms: string
  areaSqm: string
  floor: string
}

export interface FirstListing {
  enabled: boolean
  intent: string
  priceMode: 'TOTAL' | 'PER_SQM'
  price: string
  currency: string
  status: string
  negotiable: boolean
  rentPeriod: string
}

export const EMPTY_FIRST_UNIT: FirstUnit = { bedrooms: '', bathrooms: '', areaSqm: '', floor: '' }

export const EMPTY_FIRST_LISTING: FirstListing = {
  enabled: true,
  intent: 'FOR_SALE',
  priceMode: 'TOTAL',
  price: '',
  currency: 'USD',
  status: 'ACTIVE',
  negotiable: false,
  rentPeriod: 'MONTHLY',
}

/** The total a listing will be created at, given the pricing mode. */
export function listingTotal(unit: FirstUnit, listing: FirstListing): number {
  const area = unit.areaSqm !== '' ? Number(unit.areaSqm) : 0
  const entered = Number(listing.price) || 0
  return listing.priceMode === 'PER_SQM' ? Math.round(entered * area) : entered
}

export function FirstUnitSection({
  unitKind, unit, listing, onUnit, onListing, onLocationUrl, disabled, error,
}: {
  unitKind: string
  unit: FirstUnit
  listing: FirstListing
  onUnit: (patch: Partial<FirstUnit>) => void
  onListing: (patch: Partial<FirstListing>) => void
  /** Quick-fill can find a Maps link, which belongs to the location section. */
  onLocationUrl: (url: string) => void
  disabled?: boolean
  error?: string | null
}) {
  const def = typeDef(unitKind)
  const isLand = unitKind === 'LAND_PARCEL'
  const area = unit.areaSqm !== '' ? Number(unit.areaSqm) : 0
  const total = listingTotal(unit, listing)

  // The same derivation the public site runs, fed from what's on screen.
  const preview = [{
    areaSqm: area || null,
    options: [],
    listings: listing.enabled && total > 0
      ? [{ price: total, currency: listing.currency, status: listing.status, visibility: 'PUBLIC' }]
      : [],
  }]

  return (
    <FormSection
      id="unit"
      title={isLand ? 'The plot & price' : `The ${typeLabel(unitKind).toLowerCase()} & price`}
      description="A property needs one unit to carry its price. Add more once it's saved."
      icon={<Home className="h-4 w-4" />}
      aside={<QuickFill onApply={(p) => applyParsed(p, onUnit, onListing, onLocationUrl)} disabled={disabled} />}
    >
      <div className="space-y-6">
        {!isLand && (
          <FieldGrid cols={4}>
            {def.beds && (
              <Field label="Bedrooms" optional>
                <NumberInput
                  min="0" value={unit.bedrooms}
                  onChange={(e) => onUnit({ bedrooms: e.target.value })}
                  placeholder="2" disabled={disabled}
                />
              </Field>
            )}
            {def.baths && (
              <Field label="Bathrooms" optional>
                <NumberInput
                  min="0" value={unit.bathrooms}
                  onChange={(e) => onUnit({ bathrooms: e.target.value })}
                  placeholder="1" disabled={disabled}
                />
              </Field>
            )}
            <Field
              label={def.areaLabel}
              optional={listing.priceMode !== 'PER_SQM'}
              required={listing.enabled && listing.priceMode === 'PER_SQM'}
            >
              <NumberInput
                min="0" unit="m²" value={unit.areaSqm}
                onChange={(e) => onUnit({ areaSqm: e.target.value })}
                placeholder="120" disabled={disabled}
              />
            </Field>
            {def.floor && (
              <Field label="Floor" optional>
                <NumberInput
                  value={unit.floor}
                  onChange={(e) => onUnit({ floor: e.target.value })}
                  placeholder="3" disabled={disabled}
                />
              </Field>
            )}
          </FieldGrid>
        )}

        {isLand && (
          <Field label={def.areaLabel} className="max-w-xs" required={listing.enabled && listing.priceMode === 'PER_SQM'}>
            <NumberInput
              min="0" unit="m²" value={unit.areaSqm}
              onChange={(e) => onUnit({ areaSqm: e.target.value })}
              placeholder="800" disabled={disabled}
            />
          </Field>
        )}

        <div className="space-y-5 border-t border-slate-100 pt-6">
          <Toggle
            checked={listing.enabled}
            onChange={(v) => onListing({ enabled: v })}
            label="Put it on the market now"
            hint="Without this it is saved with no price and stays out of the catalogue."
            disabled={disabled}
          />

          {listing.enabled && (
            <div className="space-y-5">
              <FieldGrid cols={2}>
                <Field label="Sale or rent">
                  <SegmentedControl
                    value={listing.intent}
                    onChange={(v) => onListing({ intent: v })}
                    options={[{ value: 'FOR_SALE', label: 'For sale' }, { value: 'FOR_RENT', label: 'For rent' }]}
                  />
                </Field>
                {area > 0 && listing.intent === 'FOR_SALE' && (
                  <Field label="Quote the price as">
                    <SegmentedControl
                      value={listing.priceMode}
                      onChange={(v) => onListing({ priceMode: v })}
                      options={[{ value: 'TOTAL', label: 'A total' }, { value: 'PER_SQM', label: 'Per m²' }]}
                    />
                  </Field>
                )}
              </FieldGrid>

              <FieldGrid cols={4}>
                <Field
                  label={listing.priceMode === 'PER_SQM' ? 'Price per m²' : 'Price'}
                  required
                  span={2}
                  error={error ?? undefined}
                  hint={
                    listing.priceMode === 'PER_SQM' && area > 0 && listing.price
                      ? `${area} m² × ${listing.currency === 'LBP' ? '' : '$'}${Number(listing.price).toLocaleString()} = ${listing.currency === 'LBP' ? '' : '$'}${total.toLocaleString()}`
                      : undefined
                  }
                >
                  <MoneyInput
                    currency={listing.currency}
                    value={listing.price}
                    onChange={(e) => onListing({ price: e.target.value })}
                    placeholder={listing.priceMode === 'PER_SQM' ? '2500' : '250000'}
                    invalid={!!error}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Currency">
                  <SelectInput
                    value={listing.currency}
                    onChange={(e) => onListing({ currency: e.target.value })}
                    disabled={disabled}
                  >
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </SelectInput>
                </Field>
                {listing.intent === 'FOR_RENT' && (
                  <Field label="Period">
                    <SelectInput
                      value={listing.rentPeriod}
                      onChange={(e) => onListing({ rentPeriod: e.target.value })}
                      disabled={disabled}
                    >
                      <option value="MONTHLY">Per month</option>
                      <option value="QUARTERLY">Per quarter</option>
                      <option value="YEARLY">Per year</option>
                    </SelectInput>
                  </Field>
                )}
              </FieldGrid>

              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <Toggle
                  checked={listing.negotiable}
                  onChange={(v) => onListing({ negotiable: v })}
                  label="Price is negotiable"
                  disabled={disabled}
                />
                <Field label="Publish" className="max-w-sm">
                  <SegmentedControl
                    value={listing.status}
                    onChange={(v) => onListing({ status: v })}
                    options={[
                      { value: 'ACTIVE', label: 'Live now' },
                      { value: 'DRAFT', label: 'Keep as draft' },
                    ]}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        <PriceSummary units={preview} />
      </div>
    </FormSection>
  )
}

function applyParsed(
  p: ParsedProperty,
  onUnit: (patch: Partial<FirstUnit>) => void,
  onListing: (patch: Partial<FirstListing>) => void,
  onLocationUrl: (url: string) => void,
) {
  const unitPatch: Partial<FirstUnit> = {}
  if (p.bedrooms !== undefined) unitPatch.bedrooms = String(p.bedrooms)
  if (p.bathrooms !== undefined) unitPatch.bathrooms = String(p.bathrooms)
  if (p.areaSqm !== undefined) unitPatch.areaSqm = String(p.areaSqm)
  if (p.floor !== undefined) unitPatch.floor = String(p.floor)
  if (Object.keys(unitPatch).length) onUnit(unitPatch)

  const listingPatch: Partial<FirstListing> = {}
  if (p.price !== undefined) {
    // A parsed price is always a total — nobody writes "per m²" in a WhatsApp
    // message without saying so, and reading it as a rate would be off by 100x.
    listingPatch.price = String(p.price)
    listingPatch.priceMode = 'TOTAL'
    listingPatch.enabled = true
  }
  if (p.currency) listingPatch.currency = p.currency
  if (p.negotiable) listingPatch.negotiable = true
  if (Object.keys(listingPatch).length) onListing(listingPatch)

  if (p.locationUrl) onLocationUrl(p.locationUrl)
}

/**
 * Paste the message the property arrived in.
 *
 * Nothing is applied until it has been read back, field by field — a number
 * quietly filled in wrong is worse than a blank one.
 */
export function QuickFill({
  onApply, disabled,
}: {
  onApply: (parsed: ParsedProperty) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const parsed = text.trim() ? parsePropertyText(text) : {}
  const rows = describeParsed(parsed)

  function apply() {
    setBusy(true)
    onApply(parsed)
    setText('')
    setOpen(false)
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        <ClipboardPaste className="h-3.5 w-3.5" /> Paste details
      </button>
    )
  }

  return (
    <div className="w-full sm:w-[22rem]">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">Paste the listing text</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setText('') }}
          aria-label="Close"
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        placeholder="e.g. Apartment in Achrafieh, S+2, 145m2, 4th floor, 285,000$ negotiable"
      />
      {text.trim() && (
        <div className="mt-2">
          {rows.length === 0 ? (
            <InlineNote tone="warning">Nothing recognisable yet — type the numbers in directly.</InlineNote>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {rows.map((r) => (
                  <li
                    key={r.key}
                    className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800"
                  >
                    <span className="font-medium">{r.label}:</span> {r.value}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={apply}
                disabled={busy}
                className={cn(
                  'mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-800 px-3',
                  'text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50',
                )}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Fill {rows.length} field{rows.length === 1 ? '' : 's'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
