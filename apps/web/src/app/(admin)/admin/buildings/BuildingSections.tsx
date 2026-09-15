'use client'

/**
 * The property form, in sections — the single source both create and edit render.
 *
 * Keeping them as separate exported sections rather than one monolithic form
 * lets the two screens differ where they genuinely differ (create walks you
 * through it in steps and can put the property on the market in the same pass;
 * edit shows everything at once next to a section nav) without the fields
 * themselves being written twice and drifting apart again.
 */

import { useState } from 'react'
import {
  Building2, CalendarClock, Coins, FileText, Image as ImageIcon, Loader2, MapPin,
  Search, Sparkles,
} from 'lucide-react'
import { LocationFields } from '@/components/admin/LocationFields'
import { OwnerPicker, type OwnerRef } from '@/components/admin/OwnerPicker'
import { PaymentPlansEditor } from '@/components/admin/PaymentPlansEditor'
import { ImageManager } from '@/components/admin/ui/ImageManager'
import {
  ChipsInput, CountedTextarea, Field, FieldGrid, InlineNote, MoneyInput,
  NumberInput, SelectInput, TextInput, Textarea, Toggle, CheckboxCard, SegmentedControl,
} from '@/components/admin/ui/form'
import { Disclosure, FormSection } from '@/components/admin/ui/layout'
import { PROPERTY_TYPE_GROUPS, typeLabel } from '@/lib/property-types'
import { siteFor } from '@/lib/market'
import { parseCoordinates, type BuildingFormState } from './building-form-state'

export type Patch = (patch: Partial<BuildingFormState>) => void

interface SectionProps {
  f: BuildingFormState
  set: Patch
  disabled?: boolean
}

// ── Markets ───────────────────────────────────────────────────────────────────

const MARKETS = [
  { value: 'LEBANON', label: '🇱🇧 Lebanon' },
  { value: 'GEORGIA', label: '🇬🇪 Georgia' },
  { value: 'CYPRUS', label: '🇨🇾 Cyprus' },
  { value: 'GREECE', label: '🇬🇷 Greece' },
]

// ── Amenities ─────────────────────────────────────────────────────────────────

/**
 * A private generator and solar backup are selling points in Lebanon because
 * mains power isn't reliable. Abroad they're noise — nobody shopping in Batumi
 * asks whether the building has its own generator. The create form used to show
 * them regardless of market; only the edit form got this right.
 */
const LEBANON_ONLY = [
  { key: 'hasGenerator', label: 'Generator' },
  { key: 'hasSolarPower', label: 'Solar power' },
] as const

const SHARED = [
  { key: 'hasElevator', label: 'Elevator' },
  { key: 'hasSecurity', label: 'Security' },
] as const

/** A warehouse or shop has no pool or gym — only offer what's plausible. */
const RESIDENTIAL = [
  { key: 'hasPool', label: 'Pool' },
  { key: 'hasGym', label: 'Gym' },
  { key: 'hasConcierge', label: 'Concierge' },
  { key: 'hasGarden', label: 'Garden' },
  { key: 'hasRooftop', label: 'Rooftop' },
  { key: 'hasCentralAC', label: 'Central A/C' },
] as const

export function amenitiesFor(country: string, residential: boolean) {
  return [
    ...(country === 'LEBANON' ? LEBANON_ONLY : []),
    ...SHARED,
    ...(residential ? RESIDENTIAL : []),
  ]
}

// ── Basics ────────────────────────────────────────────────────────────────────

export function BasicsSection({
  f, set, disabled, owner, onOwnerChange, unitCount, errors,
}: SectionProps & {
  owner: OwnerRef | null
  onOwnerChange: (o: OwnerRef | null) => void
  /** How many units the property already has — decides how type is presented. */
  unitCount: number
  errors?: Record<string, string>
}) {
  // "Listing structure" only means something for an actual development. For the
  // ordinary single-property listing it's noise, so we hide it.
  const isDevelopment = unitCount > 1 || (f.kind && f.kind !== 'STANDALONE')

  return (
    <FormSection
      id="basics"
      title="The basics"
      description="What this property is and how it appears on the website."
      icon={<Building2 className="h-4 w-4" />}
    >
      <div className="space-y-4">
        <OwnerPicker value={owner} onChange={onOwnerChange} />

        <Field
          label="Title"
          required
          hint="Shown as the property's name on the website."
          error={errors?.title}
        >
          <TextInput
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Verdun Residences"
            disabled={disabled}
            invalid={!!errors?.title}
            required
          />
        </Field>

        <FieldGrid cols={2}>
          <Field
            label="Property type"
            hint={
              unitCount > 1
                ? `This development has ${unitCount} units — set each one's type in Units & listings.`
                : 'What is being sold or rented. This decides which fields appear below.'
            }
          >
            {unitCount > 1 ? (
              <div className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                Mixed — set per unit
              </div>
            ) : (
              <SelectInput
                value={f.unitKind}
                onChange={(e) => set({ unitKind: e.target.value })}
                disabled={disabled}
              >
                {PROPERTY_TYPE_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.label}>
                    {g.kinds.map((k) => <option key={k} value={k}>{typeLabel(k)}</option>)}
                  </optgroup>
                ))}
              </SelectInput>
            )}
          </Field>

          <Field label="Build status" hint="Where the property is in its life.">
            <SelectInput value={f.status} onChange={(e) => set({ status: e.target.value })} disabled={disabled}>
              <option value="OFF_PLAN">Off-plan — not built yet</option>
              <option value="NEW_BUILD">New build — never lived in</option>
              <option value="RESALE">Resale — previously owned</option>
            </SelectInput>
          </Field>

        </FieldGrid>

        {/* Publishing is a decision, not a dropdown among dropdowns — it is the
            one setting here that changes whether the public can see any of this. */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <Field label="Who can see it" className="max-w-md">
            <SegmentedControl
              value={f.visibility}
              onChange={(v) => set({ visibility: v })}
              options={[
                { value: 'PUBLIC', label: 'Public', hint: 'Anyone on the website' },
                { value: 'ELITE_ONLY', label: 'Elite only', hint: 'Signed-in elite clients' },
                { value: 'HIDDEN', label: 'Hidden', hint: 'Back office only' },
              ]}
            />
          </Field>
          <p className="text-xs text-slate-500">
            {f.visibility === 'PUBLIC'
              ? <>Visible to everyone on <strong>{siteFor(f.country)}</strong>.</>
              : f.visibility === 'ELITE_ONLY'
                ? 'Only signed-in elite clients will find it.'
                : 'Nobody outside the back office can see this, whatever its listings say.'}
          </p>
          <Toggle
            checked={f.featured}
            onChange={(v) => set({ featured: v })}
            label="Feature this property"
            hint="Pushes it to the top of the catalogue and onto the homepage."
            disabled={disabled}
          />
        </div>

        <Field
          label="One-line summary"
          optional
          hint="The sentence under the title on cards and search results."
        >
          <TextInput
            value={f.shortDescription}
            onChange={(e) => set({ shortDescription: e.target.value })}
            placeholder="e.g. Sea-view apartments in the heart of Verdun"
            disabled={disabled}
            maxLength={200}
          />
        </Field>

        <Field label="Full description" optional hint="The body text on the property page.">
          <Textarea
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={6}
            placeholder="Describe the property, the building and the area…"
            disabled={disabled}
          />
        </Field>

        {/* Two dropdowns that are right by default and almost never touched.
            Leaving them in the open cost as much attention as the title. */}
        <Disclosure
          label="More"
          hint={isDevelopment ? 'How the development is organised · who listed it' : 'Who listed it'}
        >
          {isDevelopment && (
            <Field
              label="Listing structure"
              hint="How the development is organised. Property types are set per unit."
            >
              <SelectInput value={f.kind} onChange={(e) => set({ kind: e.target.value })} disabled={disabled}>
                <option value="STANDALONE">Single property</option>
                <option value="PROJECT">Project — several units</option>
                <option value="COMMUNITY">Community / compound</option>
                <option value="MIXED_USE">Mixed use — residential + commercial</option>
              </SelectInput>
            </Field>
          )}
          <Field label="Who listed it" hint="Only changes how it is labelled and filtered in here.">
            <SelectInput value={f.source} onChange={(e) => set({ source: e.target.value })} disabled={disabled}>
              <option value="ADMIN">Our office</option>
              <option value="OWNER">The property owner</option>
            </SelectInput>
          </Field>
        </Disclosure>
      </div>
    </FormSection>
  )
}

// ── Location ──────────────────────────────────────────────────────────────────

export function LocationSection({ f, set, disabled, errors }: SectionProps & { errors?: Record<string, string> }) {
  const [pasteError, setPasteError] = useState<string | null>(null)
  const coords = f.latitude && f.longitude ? `${f.latitude}, ${f.longitude}` : null

  /**
   * One paste box fills the map link and the coordinates together. Asking for
   * latitude and longitude as two decimal numbers is why both columns were
   * empty on every property in the database.
   */
  function handleMapPaste(raw: string) {
    set({ locationUrl: raw })
    setPasteError(null)
    if (!raw.trim()) { set({ latitude: '', longitude: '' }); return }
    const parsed = parseCoordinates(raw)
    if (parsed) {
      set({ latitude: String(parsed.lat), longitude: String(parsed.lng) })
    } else if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(raw)) {
      setPasteError('Short Google links don’t carry coordinates. Open it, then copy the full URL from the address bar.')
    }
  }

  return (
    <FormSection
      id="location"
      title="Where it is"
      description="Decides which website shows it, and how buyers find it on a map."
      icon={<MapPin className="h-4 w-4" />}
    >
      <div className="space-y-4">
        <Field
          label="Market"
          hint={<>This property will appear on <strong>{siteFor(f.country)}</strong>.</>}
          className="max-w-xs"
        >
          <SelectInput
            value={f.country}
            onChange={(e) => set({
              country: e.target.value,
              // Lebanese administrative divisions don't survive a market change.
              mohafazat: '', caza: '',
            })}
            disabled={disabled}
          >
            {MARKETS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </SelectInput>
        </Field>

        <LocationFields
          country={f.country}
          value={{ mohafazat: f.mohafazat, caza: f.caza, city: f.city, neighborhood: f.neighborhood }}
          onChange={(patch) => set(patch)}
        />
        {errors?.location && <InlineNote tone="error">{errors.location}</InlineNote>}

        <Field label="Street address" optional>
          <TextInput
            value={f.address}
            onChange={(e) => set({ address: e.target.value })}
            placeholder="Building, street"
            disabled={disabled}
          />
        </Field>

        <Field
          label="Google Maps link"
          optional
          hint="Paste the full URL from the address bar — the coordinates are read out of it."
          error={pasteError ?? undefined}
        >
          <TextInput
            type="url"
            value={f.locationUrl}
            onChange={(e) => handleMapPaste(e.target.value)}
            placeholder="https://www.google.com/maps/place/…/@33.8886,35.4955,17z"
            disabled={disabled}
            invalid={!!pasteError}
          />
        </Field>

        {coords ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium text-emerald-800">Pinned at {coords}</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${f.latitude},${f.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
            >
              Check on a map
            </a>
            <button
              type="button"
              onClick={() => set({ latitude: '', longitude: '' })}
              className="ml-auto text-xs text-emerald-700 hover:text-red-600"
            >
              Clear
            </button>
          </div>
        ) : null}

        <Disclosure label="More" hint="Post code · coordinates by hand">
          <Field label="Post code" optional className="max-w-xs">
            <TextInput
              value={f.zipCode}
              onChange={(e) => set({ zipCode: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <FieldGrid cols={2}>
            <Field label="Latitude" optional>
              <NumberInput
                step="any"
                value={f.latitude}
                onChange={(e) => set({ latitude: e.target.value })}
                placeholder="33.8886"
                disabled={disabled}
              />
            </Field>
            <Field label="Longitude" optional>
              <NumberInput
                step="any"
                value={f.longitude}
                onChange={(e) => set({ longitude: e.target.value })}
                placeholder="35.4955"
                disabled={disabled}
              />
            </Field>
          </FieldGrid>
        </Disclosure>
      </div>
    </FormSection>
  )
}

// ── Building specs + amenities ────────────────────────────────────────────────

export function SpecsSection({ f, set, disabled, residential }: SectionProps & { residential: boolean }) {
  const amenities = amenitiesFor(f.country, residential)

  return (
    <FormSection
      id="specs"
      title="The building"
      description="Shared facts about the building every unit in it inherits."
      icon={<Building2 className="h-4 w-4" />}
    >
      <div className="space-y-5">
        <FieldGrid cols={4}>
          <Field label="Built year" optional>
            <NumberInput
              value={f.builtYear}
              onChange={(e) => set({ builtYear: e.target.value })}
              placeholder="2023"
              min="1800"
              max="2100"
              disabled={disabled}
            />
          </Field>
          <Field label="Floors" optional>
            <NumberInput
              value={f.totalFloors}
              onChange={(e) => set({ totalFloors: e.target.value })}
              placeholder="12"
              min="1"
              disabled={disabled}
            />
          </Field>
          <Field label="Parking spaces" optional>
            <NumberInput
              value={f.parkingSpaces}
              onChange={(e) => set({ parkingSpaces: e.target.value })}
              placeholder="50"
              min="0"
              disabled={disabled}
            />
          </Field>
          <Field label="Available from" optional hint="Leave empty if it is ready now.">
            <TextInput
              type="date"
              value={f.availableFrom}
              onChange={(e) => set({ availableFrom: e.target.value })}
              disabled={disabled}
            />
          </Field>
        </FieldGrid>

        <div>
          <p className="mb-2.5 text-sm font-medium text-slate-700">Amenities</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {amenities.map(({ key, label }) => (
              <CheckboxCard
                key={key}
                checked={f[key]}
                onChange={(v) => set({ [key]: v } as Partial<BuildingFormState>)}
                label={label}
                disabled={disabled}
              />
            ))}
          </div>
          {f.country === 'LEBANON' && (
            <p className="mt-2 text-xs text-slate-400">
              Generator and solar are offered because mains power in Lebanon isn&rsquo;t reliable — they don&rsquo;t appear on other markets.
            </p>
          )}
        </div>
      </div>
    </FormSection>
  )
}

// ── Highlights ────────────────────────────────────────────────────────────────

const HIGHLIGHT_SUGGESTIONS = [
  'Sea view', 'Mountain view', 'City view', 'Private pool', 'Terrace',
  'Corner unit', 'Fully furnished', 'Maid’s room', 'Storage room', 'Open kitchen',
]

export function HighlightsSection({ f, set, disabled }: SectionProps) {
  return (
    <FormSection
      id="highlights"
      title="Selling points"
      description="The short phrases printed as bullets on the property page and the PDF proposal."
      icon={<Sparkles className="h-4 w-4" />}
    >
      <ChipsInput
        value={f.highlightedFeatures}
        onChange={(v) => set({ highlightedFeatures: v })}
        placeholder="e.g. Sea view, private pool…"
        suggestions={HIGHLIGHT_SUGGESTIONS}
        disabled={disabled}
      />
    </FormSection>
  )
}

// ── Media ─────────────────────────────────────────────────────────────────────

export function MediaSection({
  f, set, disabled, buildingId, deleteFromStorage = true,
}: SectionProps & { buildingId?: string; deleteFromStorage?: boolean }) {
  // Group uploads under buildings/<slug>/… in R2. Prefer the title (readable
  // folders); fall back to the id for a brand-new untitled property so files
  // still get a stable home.
  const slug = (f.title.trim() || buildingId || '').trim()

  return (
    <FormSection
      id="media"
      title="Photos & video"
      description="Drop everything in one place. The first photo is the cover — it is what every card, search result and share link shows."
      icon={<ImageIcon className="h-4 w-4" />}
    >
      {/* One dropzone for photos and video, one box for links.
          This was four controls — a photo dropzone, an "upload a video" button,
          a YouTube field and a virtual-tour field — sitting next to each other
          with no visible reason to pick one over another. They are four database
          columns, which is not a reason. */}
      <ImageManager
        value={f.images}
        onChange={(images) => set({ images })}
        folder="buildings"
        propertySlug={slug}
        deleteFromStorage={deleteFromStorage}
        disabled={disabled}
        media={{
          videoUrl: f.videoUrl,
          youtubeUrls: f.youtubeUrls,
          virtualTourUrl: f.virtualTourUrl,
          onChange: (patch) => set(patch),
        }}
      />
    </FormSection>
  )
}

// ── Investment ────────────────────────────────────────────────────────────────

export function InvestmentSection({ f, set, disabled }: SectionProps) {
  const inv = f.investment
  const setInv = (patch: Partial<typeof inv>) => set({ investment: { ...inv, ...patch } })
  const international = f.country !== 'LEBANON'

  return (
    <FormSection
      id="investment"
      title="Investment & returns"
      description="What an investor is shown. Leave it empty and the property simply shows no figures."
      icon={<Coins className="h-4 w-4" />}
    >
      <div className="space-y-6">
        <InlineNote tone="info">
          These are the numbers on the ROI badge on every card, and the figures the
          AI search sorts by. Until now there was nowhere in the back office to enter them.
        </InlineNote>

        <div>
          <p className="mb-2.5 text-sm font-medium text-slate-700">Returns</p>
          <FieldGrid cols={4}>
            <Field label="Expected ROI" optional hint="Headline figure.">
              <NumberInput
                unit="%" step="0.1" min="0"
                value={inv.expectedROI}
                onChange={(e) => setInv({ expectedROI: e.target.value })}
                placeholder="14"
                disabled={disabled}
              />
            </Field>
            <Field label="Rental yield" optional>
              <NumberInput
                unit="%" step="0.1" min="0"
                value={inv.rentalYield}
                onChange={(e) => setInv({ rentalYield: e.target.value })}
                placeholder="8"
                disabled={disabled}
              />
            </Field>
            <Field label="Capital growth" optional>
              <NumberInput
                unit="%" step="0.1"
                value={inv.capitalGrowth}
                onChange={(e) => setInv({ capitalGrowth: e.target.value })}
                placeholder="6"
                disabled={disabled}
              />
            </Field>
            <Field label="Annual appreciation" optional>
              <NumberInput
                unit="%" step="0.1"
                value={inv.annualAppreciation}
                onChange={(e) => setInv({ annualAppreciation: e.target.value })}
                placeholder="5"
                disabled={disabled}
              />
            </Field>
          </FieldGrid>
        </div>

        <div>
          <p className="mb-2.5 text-sm font-medium text-slate-700">Money in</p>
          <FieldGrid cols={4}>
            <Field label="Entry price" optional hint="Smallest ticket into the project.">
              <MoneyInput
                value={inv.minInvestment}
                onChange={(e) => setInv({ minInvestment: e.target.value })}
                placeholder="80000"
                disabled={disabled}
              />
            </Field>
            <Field label="Down payment" optional>
              <NumberInput
                unit="%" min="0" max="100"
                value={inv.downPaymentPercentage}
                onChange={(e) => setInv({ downPaymentPercentage: e.target.value })}
                placeholder="30"
                disabled={disabled}
              />
            </Field>
            <Field label="Instalments" optional>
              <NumberInput
                unit="yrs" min="0"
                value={inv.installmentYears}
                onChange={(e) => setInv({ installmentYears: e.target.value })}
                placeholder="3"
                disabled={disabled}
              />
            </Field>
            <Field label="Average rent" optional hint="Per month.">
              <MoneyInput
                value={inv.averageRentPerMonth}
                onChange={(e) => setInv({ averageRentPerMonth: e.target.value })}
                placeholder="900"
                disabled={disabled}
              />
            </Field>
          </FieldGrid>
        </div>

        <Disclosure
          label="Running costs & delivery dates"
          hint="Service fee · property tax · completion · handover"
          badge={
            [inv.serviceFee, inv.propertyTax, inv.completionDate, inv.handoverDate].filter(Boolean).length
              ? `${[inv.serviceFee, inv.propertyTax, inv.completionDate, inv.handoverDate].filter(Boolean).length} set`
              : undefined
          }
        >
          <FieldGrid cols={2}>
            <Field label="Service fee" optional hint="Per year.">
              <MoneyInput
                value={inv.serviceFee}
                onChange={(e) => setInv({ serviceFee: e.target.value })}
                placeholder="1200"
                disabled={disabled}
              />
            </Field>
            <Field label="Property tax" optional hint="Per year.">
              <MoneyInput
                value={inv.propertyTax}
                onChange={(e) => setInv({ propertyTax: e.target.value })}
                placeholder="400"
                disabled={disabled}
              />
            </Field>
          </FieldGrid>

          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <CalendarClock className="h-3.5 w-3.5 text-slate-400" /> Delivery
            </p>
            <FieldGrid cols={2}>
              <Field label="Completion date" optional hint="When the building is finished.">
                <TextInput
                  type="date"
                  value={inv.completionDate}
                  onChange={(e) => setInv({ completionDate: e.target.value })}
                  disabled={disabled}
                />
              </Field>
              <Field label="Handover date" optional hint="When keys go to the buyer.">
                <TextInput
                  type="date"
                  value={inv.handoverDate}
                  onChange={(e) => setInv({ handoverDate: e.target.value })}
                  disabled={disabled}
                />
              </Field>
            </FieldGrid>
          </div>
        </Disclosure>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <Toggle
            checked={inv.mortgageAvailable}
            onChange={(v) => setInv({ mortgageAvailable: v })}
            label="Mortgage available"
            hint="A bank in this market will lend against it."
            disabled={disabled}
          />
          <Toggle
            checked={inv.isGoldenVisaEligible}
            onChange={(v) => setInv({ isGoldenVisaEligible: v })}
            label="Residency-by-investment eligible"
            hint={
              international
                ? 'The first question an international buyer asks. Shows as a badge on the card.'
                : 'Rarely applies to Lebanese stock.'
            }
            disabled={disabled}
          />
          {inv.isGoldenVisaEligible && (
            <Field label="Minimum for residency" optional className="max-w-xs">
              <MoneyInput
                value={inv.goldenVisaMinAmount}
                onChange={(e) => setInv({ goldenVisaMinAmount: e.target.value })}
                placeholder="100000"
                disabled={disabled}
              />
            </Field>
          )}
        </div>
      </div>
    </FormSection>
  )
}

// ── Payment plans ─────────────────────────────────────────────────────────────

export function PaymentPlansSection({ f, set }: SectionProps) {
  return (
    <FormSection
      id="payment"
      title="Payment plans"
      description="Shown on the property page and in the PDF proposal."
      icon={<Coins className="h-4 w-4" />}
    >
      <PaymentPlansEditor value={f.paymentPlans} onChange={(paymentPlans) => set({ paymentPlans })} />
    </FormSection>
  )
}

// ── SEO ───────────────────────────────────────────────────────────────────────

export function SeoSection({
  f, set, disabled, onGenerate, generating, generateError, generateDisabledReason,
}: SectionProps & {
  onGenerate: () => void
  generating: boolean
  generateError?: string | null
  /** Why the AI button can't run yet — shown instead of a dead button. */
  generateDisabledReason?: string | null
}) {
  return (
    <FormSection
      id="seo"
      title="Search engines"
      description="How this property appears in Google. Left empty, the site writes a sensible fallback."
      icon={<Search className="h-4 w-4" />}
      aside={
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !!generateDisabledReason || disabled}
          title={generateDisabledReason ?? 'Write SEO from this property’s details'}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {generating ? 'Writing…' : 'Write with AI'}
        </button>
      }
    >
      <div className="space-y-4">
        {generateError && <InlineNote tone="error">{generateError}</InlineNote>}
        {generateDisabledReason && <p className="text-xs text-slate-400">{generateDisabledReason}</p>}

        <Field label="Page title" optional hint="Google shows about 60 characters.">
          <TextInput
            value={f.metaTitle}
            onChange={(e) => set({ metaTitle: e.target.value })}
            placeholder="Sea-view apartments in Verdun, Beirut | PropGroup"
            disabled={disabled}
          />
        </Field>

        <Field label="Page description" optional hint="Google shows about 160 characters.">
          <CountedTextarea
            value={f.metaDescription}
            max={160}
            rows={3}
            onChange={(e) => set({ metaDescription: e.target.value })}
            placeholder="A short pitch shown under the title in search results."
            disabled={disabled}
          />
        </Field>

        {/* A search preview, because nobody can picture a meta description. */}
        {(f.metaTitle || f.metaDescription) && (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Google preview
            </p>
            <p className="truncate text-sm text-[#1a0dab]">{f.metaTitle || f.title}</p>
            <p className="truncate text-xs text-[#006621]">{siteFor(f.country)}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
              {f.metaDescription || f.shortDescription || 'No description yet.'}
            </p>
          </div>
        )}
      </div>
    </FormSection>
  )
}

// ── Documents ─────────────────────────────────────────────────────────────────

export function DocumentsSection({ children }: { children: React.ReactNode }) {
  return (
    <FormSection
      id="documents"
      title="Documents"
      description="Floor plans, brochures and contracts. Public ones show on the property page."
      icon={<FileText className="h-4 w-4" />}
    >
      {children}
    </FormSection>
  )
}
