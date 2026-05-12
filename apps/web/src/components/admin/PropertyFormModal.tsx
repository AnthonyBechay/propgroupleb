'use client'

import { useState, useEffect } from 'react'
import { Property } from '@/lib/types/api'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { X, ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { PaymentPlanBuilder, type PaymentPlanDetails } from './PaymentPlanBuilder'
import {
  PROPERTY_TYPES, COUNTRIES, STATUSES, CURRENCIES,
  OWNERSHIP, AMENITY_OPTIONS,
} from '@/lib/constants/property'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

type Developer = {
  id: string
  name: string
  country: string
}

type LocationGuide = {
  id: string
  title: string
  country: string
}

type PropertyFormModalProps =
  | {
      mode: 'create'
      open?: never
      onOpenChange?: never
      property?: never
      developers: Developer[]
      locationGuides: LocationGuide[]
      children: React.ReactNode
    }
  | {
      mode: 'edit'
      open: boolean
      onOpenChange: (open: boolean) => void
      property: Property | null
      developers?: Developer[]
      locationGuides?: LocationGuide[]
      children?: never
    }

const INITIAL_FORM = {
  title: '',
  description: '',
  price: 0,
  currency: 'USD',
  propertyType: 'APARTMENT' as string,
  country: 'LEBANON' as string,
  status: 'NEW_BUILD' as string,
  isGoldenVisaEligible: false,
  featured: false,
  featuredUntil: '',
  city: '',
  district: '',
  address: '',
  location: '',
  locationUrl: '',
  nearbyFacilities: '',
  builtYear: '' as string | number,
  floors: '' as string | number,
  parkingSpaces: '' as string | number,
  ownershipType: '' as string,
  hasPool: false,
  hasGym: false,
  hasGarden: false,
  hasBalcony: false,
  hasSecurity: false,
  hasElevator: false,
  hasCentralAC: false,
  expectedROI: '' as string | number,
  rentalYield: '' as string | number,
  capitalGrowth: '' as string | number,
  paymentPlan: '',
  paymentPlanDetails: null as PaymentPlanDetails | null,
  completionDate: '',
  developerId: '',
  locationGuideId: '',
}

function buildPayload(form: typeof INITIAL_FORM, imageUrls: string[], youtubeUrls: string[]) {
  const data: Record<string, unknown> = {
    title: form.title,
    description: form.description,
    price: Number(form.price),
    currency: form.currency,
    propertyType: form.propertyType,
    country: form.country,
    status: form.status,
    isGoldenVisaEligible: form.isGoldenVisaEligible,
    featured: form.featured,
    featuredUntil: form.featuredUntil || null,
    images: imageUrls,
    youtubeUrls: youtubeUrls.filter(u => u.trim()),
    city: form.city || null,
    district: form.district || null,
    address: form.address || null,
    locationUrl: form.locationUrl || null,
    nearbyFacilities: form.nearbyFacilities || null,
    builtYear: form.builtYear ? Number(form.builtYear) : null,
    floors: form.floors ? Number(form.floors) : null,
    parkingSpaces: form.parkingSpaces ? Number(form.parkingSpaces) : null,
    ownershipType: form.ownershipType || null,
    hasPool: form.hasPool,
    hasGym: form.hasGym,
    hasGarden: form.hasGarden,
    hasBalcony: form.hasBalcony,
    hasSecurity: form.hasSecurity,
    hasElevator: form.hasElevator,
    hasCentralAC: form.hasCentralAC,
  }

  if (form.developerId) data.developerId = form.developerId
  if (form.locationGuideId) data.locationGuideId = form.locationGuideId

  const hasInvestment = form.expectedROI || form.rentalYield || form.capitalGrowth || form.paymentPlan || form.paymentPlanDetails || form.completionDate
  if (hasInvestment) {
    data.expectedROI = form.expectedROI ? Number(form.expectedROI) : undefined
    data.rentalYield = form.rentalYield ? Number(form.rentalYield) : undefined
    // Capital growth (kept for display)
    data.capitalGrowth = form.capitalGrowth ? Number(form.capitalGrowth) : undefined
    data.paymentPlan = form.paymentPlanDetails?.summary || form.paymentPlan || undefined
    data.paymentPlanDetails = form.paymentPlanDetails || undefined
    data.downPaymentPercentage = form.paymentPlanDetails?.milestones?.[0]?.percentage
      ? Number(form.paymentPlanDetails.milestones[0].percentage)
      : undefined
    data.completionDate = form.completionDate || undefined
  }

  return data
}

export function PropertyFormModal(props: PropertyFormModalProps) {
  const isEdit = props.mode === 'edit'
  const [internalOpen, setInternalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([])
  const [showManualUrl, setShowManualUrl] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [form, setForm] = useState({ ...INITIAL_FORM })

  const isOpen = isEdit ? props.open : internalOpen
  const setIsOpen = isEdit ? props.onOpenChange : setInternalOpen
  const property = isEdit ? props.property : null

  // Internal state for developers/location guides — populated by self-fetch when not passed as props
  const [internalDevelopers, setInternalDevelopers] = useState<Developer[]>(props.developers || [])
  const [internalLocationGuides, setInternalLocationGuides] = useState<LocationGuide[]>(props.locationGuides || [])
  const developers = internalDevelopers
  const locationGuides = internalLocationGuides

  // Self-fetch location guides when modal opens (edit mode won't have them passed as props)
  useEffect(() => {
    if (!isOpen || internalLocationGuides.length > 0) return
    const fetchGuides = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/location-guides?limit=200`, { credentials: 'include' })
        if (res.ok) {
          const d = await res.json()
          setInternalLocationGuides(d.data || d || [])
        }
      } catch {}
    }
    fetchGuides()
  }, [isOpen])

  // Populate form when editing
  useEffect(() => {
    if (isEdit && property) {
      const p = property as any
      setForm({
        title: property.title || '',
        description: property.description || '',
        price: property.price || 0,
        currency: property.currency || 'USD',
        propertyType: p.propertyType || 'APARTMENT',
        country: property.country || 'LEBANON',
        status: property.status || 'NEW_BUILD',
        isGoldenVisaEligible: property.isGoldenVisaEligible || false,
        city: p.city || '',
        district: p.district || '',
        address: p.address || '',
        location: p.location || '',
        locationUrl: p.locationUrl || '',
        nearbyFacilities: p.nearbyFacilities || '',
        builtYear: p.builtYear || '',
        floors: p.floors || '',
        parkingSpaces: p.parkingSpaces || '',
        ownershipType: p.ownershipType || '',
        hasPool: p.hasPool || false,
        hasGym: p.hasGym || false,
        hasGarden: p.hasGarden || false,
        hasBalcony: p.hasBalcony || false,
        hasSecurity: p.hasSecurity || false,
        hasElevator: p.hasElevator || false,
        hasCentralAC: p.hasCentralAC || false,
        expectedROI: property.investmentData?.expectedROI || '',
        rentalYield: property.investmentData?.rentalYield || '',
        capitalGrowth: property.investmentData?.capitalGrowth || '',
        paymentPlan: property.investmentData?.paymentPlan || '',
        paymentPlanDetails: (property.investmentData as any)?.paymentPlanDetails || null,
        completionDate: property.investmentData?.completionDate || '',
        featured: p.featured || false,
        featuredUntil: p.featuredUntil ? new Date(p.featuredUntil).toISOString().split('T')[0] : '',
        developerId: p.developerId || '',
        locationGuideId: p.locationGuideId || '',
      })
      setImageUrls(property.images || [])
      setYoutubeUrls(Array.isArray(p.youtubeUrls) ? p.youtubeUrls : [])
      setError(null)
    }
  }, [isEdit, property])

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm({ ...INITIAL_FORM })
    setImageUrls([])
    setYoutubeUrls([])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.description.trim() || form.description.length < 10) {
      setError('Description must be at least 10 characters'); return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const data = buildPayload(form, imageUrls, youtubeUrls)

      const url = isEdit && property
        ? `${API_BASE_URL}/api/properties/${property.id}`
        : `${API_BASE_URL}/api/properties`

      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || errData.error || `${isEdit ? 'Update' : 'Create'} failed (${response.status})`)
      }

      if (!isEdit) resetForm()
      setIsOpen(false)
      window.location.reload()
    } catch (err: any) {
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} property`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm'
  const selectClass = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Project' : 'Create New Project'}</h2>
            <p className="text-sm text-gray-500">{isEdit ? 'Update project information' : 'Add a new development project to your platform'}</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">{error}</div>
          )}

          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Title *</label>
                <input className={inputClass} value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="Property title" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Description *</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="Property description" />
              </div>
              <div>
                <label className={labelClass}>Starting Price (auto-computed or override)</label>
                <input className={inputClass} type="number" value={form.price} onChange={(e) => updateField('price', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <select className={selectClass} value={form.currency} onChange={(e) => updateField('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Property Type</label>
                <select className={selectClass} value={form.propertyType} onChange={(e) => updateField('propertyType', e.target.value)}>
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={selectClass} value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Country</label>
                <select className={selectClass} value={form.country} onChange={(e) => updateField('country', e.target.value)}>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input className={inputClass} value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="City" />
              </div>
              <div>
                <label className={labelClass}>District</label>
                <input className={inputClass} value={form.district} onChange={(e) => updateField('district', e.target.value)} placeholder="District" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Google Maps URL</label>
                <input
                  className={inputClass}
                  value={form.locationUrl}
                  onChange={(e) => updateField('locationUrl', e.target.value)}
                  placeholder="https://www.google.com/maps/place/..."
                />
                <p className="mt-1 text-xs text-gray-500">Paste a Google Maps link — it will appear as an interactive map on the property page.</p>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id={`${isEdit ? 'edit' : 'create'}GoldenVisa`} checked={form.isGoldenVisaEligible} onChange={(e) => updateField('isGoldenVisaEligible', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor={`${isEdit ? 'edit' : 'create'}GoldenVisa`} className="text-sm text-gray-700">Golden Visa Eligible</label>
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <input type="checkbox" id={`${isEdit ? 'edit' : 'create'}Featured`} checked={form.featured} onChange={(e) => updateField('featured', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor={`${isEdit ? 'edit' : 'create'}Featured`} className="text-sm text-gray-700">Featured Property</label>
              </div>
              {form.featured && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Featured Until</label>
                  <input className={inputClass} type="date" value={form.featuredUntil} onChange={(e) => updateField('featuredUntil', e.target.value)} />
                </div>
              )}
            </div>
          </section>

          {/* Developer & Location Guide */}
          {(developers.length > 0 || locationGuides.length > 0) && (
            <section>
              <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Associations</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {developers.length > 0 && (
                  <div>
                    <label className={labelClass}>Developer</label>
                    <select className={selectClass} value={form.developerId} onChange={(e) => updateField('developerId', e.target.value)}>
                      <option value="">None</option>
                      {developers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.country})</option>)}
                    </select>
                  </div>
                )}
                {locationGuides.length > 0 && (
                  <div>
                    <label className={labelClass}>Location Guide</label>
                    <select className={selectClass} value={form.locationGuideId} onChange={(e) => updateField('locationGuideId', e.target.value)}>
                      <option value="">None</option>
                      {locationGuides.map((g) => <option key={g.id} value={g.id}>{g.title} ({g.country})</option>)}
                    </select>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Investment Data */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Investment Data</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Expected ROI (%)</label>
                <input className={inputClass} type="number" step="0.1" value={form.expectedROI} onChange={(e) => updateField('expectedROI', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Rental Yield (%)</label>
                <input className={inputClass} type="number" step="0.1" value={form.rentalYield} onChange={(e) => updateField('rentalYield', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Capital Growth (%)</label>
                <input className={inputClass} type="number" step="0.1" value={form.capitalGrowth} onChange={(e) => updateField('capitalGrowth', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Completion Date</label>
                <input className={inputClass} type="date" value={form.completionDate} onChange={(e) => updateField('completionDate', e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <PaymentPlanBuilder value={form.paymentPlanDetails} onChange={(details) => updateField('paymentPlanDetails', details)} labelClass={labelClass} inputClass={inputClass} />
              </div>
            </div>
          </section>

          {/* Property Details */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Property Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Built Year</label>
                <input className={inputClass} type="number" value={form.builtYear} onChange={(e) => updateField('builtYear', e.target.value)} placeholder="e.g. 2024" />
              </div>
              <div>
                <label className={labelClass}>Total Floors</label>
                <input className={inputClass} type="number" value={form.floors} onChange={(e) => updateField('floors', e.target.value)} placeholder="e.g. 12" />
              </div>
              <div>
                <label className={labelClass}>Parking Spaces</label>
                <input className={inputClass} type="number" value={form.parkingSpaces} onChange={(e) => updateField('parkingSpaces', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className={labelClass}>Ownership</label>
                <select className={selectClass} value={form.ownershipType} onChange={(e) => updateField('ownershipType', e.target.value)}>
                  <option value="">Not specified</option>
                  {OWNERSHIP.map((o) => <option key={o} value={o}>{o.charAt(0) + o.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Nearby Facilities</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={form.nearbyFacilities} onChange={(e) => updateField('nearbyFacilities', e.target.value)} placeholder="e.g., Schools, Hospitals, Shopping" />
              </div>
            </div>
          </section>

          {/* Amenities */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Amenities</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {AMENITY_OPTIONS.map((amenity) => (
                <label key={amenity.key} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={form[amenity.key as keyof typeof form] as boolean} onChange={(e) => updateField(amenity.key, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{amenity.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Images */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Property Images</h3>
            {/* Require a title before uploads so the slug-based R2 path is always
                populated (properties/{slug}/images/…). Without it, images would
                land flat at properties/{timestamp}-{name}.ext with no association
                to the property. */}
            {!isEdit && !form.title?.trim() ? (
              <p className="text-sm text-slate-400 italic">Enter a property title above before uploading images.</p>
            ) : (
              <ImageUpload
                value={imageUrls}
                onChange={setImageUrls}
                maxFiles={10}
                disabled={isSubmitting}
                propertySlug={isEdit && property ? (property as any).slug || property.title : form.title}
              />
            )}
            <div className="mt-2">
              <button type="button" onClick={() => setShowManualUrl(!showManualUrl)} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
                {showManualUrl ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Or add URL manually
              </button>
              {showManualUrl && (
                <div className="flex gap-2 mt-2">
                  <input className={inputClass} placeholder="https://..." value={manualUrl} onChange={(e) => setManualUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (manualUrl.trim()) { setImageUrls([...imageUrls, manualUrl.trim()]); setManualUrl('') } } }} />
                  <button type="button" onClick={() => { if (manualUrl.trim()) { setImageUrls([...imageUrls, manualUrl.trim()]); setManualUrl('') } }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm whitespace-nowrap border border-gray-300">Add</button>
                </div>
              )}
            </div>
          </section>

          {/* YouTube Videos */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">YouTube Videos</h3>
            <p className="text-xs text-gray-500 mb-3">
              Paste one or more YouTube video URLs. Users can play them directly on the property page.
            </p>
            <div className="space-y-2">
              {youtubeUrls.map((url, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className={inputClass}
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => {
                      const next = [...youtubeUrls]
                      next[idx] = e.target.value
                      setYoutubeUrls(next)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setYoutubeUrls(youtubeUrls.filter((_, i) => i !== idx))}
                    className="px-3 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-300 rounded-lg transition-colors"
                    aria-label="Remove video"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setYoutubeUrls([...youtubeUrls, ''])}
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 border-dashed rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add YouTube video
              </button>
            </div>
          </section>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">
            Cancel
          </button>
          <button disabled={isSubmitting} onClick={handleSubmit} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Project' : 'Create Project')}
          </button>
        </div>
      </div>
    </div>
  )

  if (isEdit) {
    if (!isOpen || !property) return null
    return modalContent
  }

  return (
    <>
      <div onClick={() => setInternalOpen(true)}>{props.children}</div>
      {internalOpen && modalContent}
    </>
  )
}

// Backwards-compatible exports
export function CreatePropertyModal(props: { children: React.ReactNode; developers: Developer[]; locationGuides: LocationGuide[] }) {
  return <PropertyFormModal mode="create" {...props} />
}

export function EditPropertyModal(props: { property: Property | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <PropertyFormModal mode="edit" {...props} />
}
