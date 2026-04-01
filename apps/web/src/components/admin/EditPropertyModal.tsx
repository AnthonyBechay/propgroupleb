'use client'

import { useState, useEffect } from 'react'
import { Property } from '@/lib/types/api'
import { ImageUpload, VideoUpload } from '@/components/ui/ImageUpload'
import { X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { PaymentPlanBuilder, type PaymentPlanDetails } from './PaymentPlanBuilder'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

type EditPropertyModalProps = {
  property: Property | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROPERTY_TYPES = [
  'APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'STUDIO',
  'DUPLEX', 'LAND', 'COMMERCIAL', 'OFFICE'
] as const

const COUNTRIES = ['GEORGIA', 'CYPRUS', 'GREECE', 'LEBANON'] as const
const STATUSES = ['OFF_PLAN', 'NEW_BUILD', 'RESALE'] as const
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'] as const



export function EditPropertyModal({ property, open, onOpenChange }: EditPropertyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [showManualUrl, setShowManualUrl] = useState(false)
  const [manualUrl, setManualUrl] = useState('')

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: 0,
    currency: 'USD',
    propertyType: 'APARTMENT' as string,
    bedrooms: 0,
    bathrooms: 0,
    area: 0,
    country: 'GEORGIA' as string,
    status: 'NEW_BUILD' as string,
    isGoldenVisaEligible: false,
    city: '',
    district: '',
    address: '',
    expectedROI: '' as string | number,
    rentalYield: '' as string | number,
    capitalGrowth: '' as string | number,
    minInvestment: '' as string | number,
    maxInvestment: '' as string | number,
    paymentPlan: '',
    paymentPlanDetails: null as PaymentPlanDetails | null,
    completionDate: '',
    featured: false,
    featuredUntil: '',
  })

  // Populate form when property changes
  useEffect(() => {
    if (property) {
      setForm({
        title: property.title || '',
        description: property.description || '',
        price: property.price || 0,
        currency: property.currency || 'USD',
        propertyType: (property as any).propertyType || 'APARTMENT',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        area: property.area || 0,
        country: property.country || 'GEORGIA',
        status: property.status || 'NEW_BUILD',
        isGoldenVisaEligible: property.isGoldenVisaEligible || false,
        city: (property as any).city || '',
        district: (property as any).district || '',
        address: (property as any).address || '',
        expectedROI: property.investmentData?.expectedROI || '',
        rentalYield: property.investmentData?.rentalYield || '',
        capitalGrowth: property.investmentData?.capitalGrowth || '',
        minInvestment: property.investmentData?.minInvestment || '',
        maxInvestment: property.investmentData?.maxInvestment || '',
        paymentPlan: property.investmentData?.paymentPlan || '',
        paymentPlanDetails: (property.investmentData as any)?.paymentPlanDetails || null,
        completionDate: property.investmentData?.completionDate || '',
        featured: (property as any).featured || false,
        featuredUntil: (property as any).featuredUntil ? new Date((property as any).featuredUntil).toISOString().split('T')[0] : '',
      })
      setImageUrls(property.images || [])
      setVideoUrl((property as any).videoUrl || '')
      setError(null)
    }
  }, [property])

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property) return

    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (!form.description.trim() || form.description.length < 10) {
      setError('Description must be at least 10 characters')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const data: any = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        currency: form.currency,
        propertyType: form.propertyType,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        area: Number(form.area),
        country: form.country,
        status: form.status,
        isGoldenVisaEligible: form.isGoldenVisaEligible,
        featured: form.featured,
        featuredUntil: form.featuredUntil || null,
        images: imageUrls,
        videoUrl: videoUrl || null,
        city: form.city || null,
        district: form.district || null,
        address: form.address || null,
      }

      // Add investment data if any field is set
      const hasInvestment = form.expectedROI || form.rentalYield || form.capitalGrowth || form.paymentPlan || form.paymentPlanDetails || form.completionDate
      if (hasInvestment) {
        data.expectedROI = form.expectedROI ? Number(form.expectedROI) : undefined
        data.rentalYield = form.rentalYield ? Number(form.rentalYield) : undefined
        data.capitalGrowth = form.capitalGrowth ? Number(form.capitalGrowth) : undefined
        data.minInvestment = form.minInvestment ? Number(form.minInvestment) : undefined
        data.maxInvestment = form.maxInvestment ? Number(form.maxInvestment) : undefined
        data.paymentPlan = form.paymentPlanDetails?.summary || form.paymentPlan || undefined
        data.paymentPlanDetails = form.paymentPlanDetails || undefined
        data.downPaymentPercentage = form.paymentPlanDetails?.milestones?.[0]?.percentage
          ? Number(form.paymentPlanDetails.milestones[0].percentage)
          : undefined
        data.completionDate = form.completionDate || undefined
      }

      const response = await fetch(`${API_BASE_URL}/api/properties/${property.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || errData.error || `Update failed (${response.status})`)
      }

      onOpenChange(false)
      window.location.reload()
    } catch (err: any) {
      setError(err.message || 'Failed to update property')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open || !property) return null

  const inputClass = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm'
  const selectClass = 'w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Property</h2>
            <p className="text-sm text-gray-500">Update property information</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
              {error}
            </div>
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
                <label className={labelClass}>Price *</label>
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
                <label className={labelClass}>Bedrooms</label>
                <input className={inputClass} type="number" value={form.bedrooms} onChange={(e) => updateField('bedrooms', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Bathrooms</label>
                <input className={inputClass} type="number" value={form.bathrooms} onChange={(e) => updateField('bathrooms', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Area (m²)</label>
                <input className={inputClass} type="number" value={form.area} onChange={(e) => updateField('area', e.target.value)} />
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
              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="goldenVisa"
                  checked={form.isGoldenVisaEligible}
                  onChange={(e) => updateField('isGoldenVisaEligible', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="goldenVisa" className="text-sm text-gray-700">Golden Visa Eligible</label>
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="featured"
                  checked={form.featured}
                  onChange={(e) => updateField('featured', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="featured" className="text-sm text-gray-700">Featured Property</label>
              </div>
              {form.featured && (
                <div className="md:col-span-2">
                  <label className={labelClass}>Featured Until</label>
                  <input className={inputClass} type="date" value={form.featuredUntil} onChange={(e) => updateField('featuredUntil', e.target.value)} />
                </div>
              )}
            </div>
          </section>

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
                <label className={labelClass}>Min Investment</label>
                <input className={inputClass} type="number" value={form.minInvestment} onChange={(e) => updateField('minInvestment', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Max Investment</label>
                <input className={inputClass} type="number" value={form.maxInvestment} onChange={(e) => updateField('maxInvestment', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Completion Date</label>
                <input className={inputClass} type="date" value={form.completionDate} onChange={(e) => updateField('completionDate', e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <PaymentPlanBuilder
                  value={form.paymentPlanDetails}
                  onChange={(details) => updateField('paymentPlanDetails', details)}
                  labelClass={labelClass}
                  inputClass={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Images */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Property Images</h3>
            <ImageUpload value={imageUrls} onChange={setImageUrls} maxFiles={10} disabled={isSubmitting} />
            <div className="mt-2">
              <button type="button" onClick={() => setShowManualUrl(!showManualUrl)}
                className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 transition-colors">
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

          {/* Video */}
          <section>
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-4">Property Video</h3>
            <VideoUpload value={videoUrl} onChange={setVideoUrl} disabled={isSubmitting} />
          </section>
        </form>

        {/* Footer with buttons - OUTSIDE the scrollable area */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Updating...' : 'Update Property'}
          </button>
        </div>
      </div>
    </div>
  )
}
