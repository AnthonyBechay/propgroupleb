'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Tag, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface Preselect {
  buildingId?: string
  unitId?: string
  subjectType?: 'UNIT' | 'BUILDING' | ''
}

interface Props {
  initialData?: any
  listingId?: string
  buildings: any[]
  preselect?: Preselect
}

export function ListingForm({ initialData, listingId, buildings, preselect }: Props) {
  const router = useRouter()
  const isEdit = !!listingId

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [units, setUnits] = useState<any[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [highlightInput, setHighlightInput] = useState('')

  const [form, setForm] = useState({
    subjectType: initialData?.subjectType ?? (preselect?.subjectType || 'BUILDING'),
    buildingId: initialData?.buildingId ?? initialData?.building?.id ?? preselect?.buildingId ?? '',
    unitId: initialData?.unitId ?? initialData?.unit?.id ?? preselect?.unitId ?? '',
    intent: initialData?.intent ?? 'FOR_SALE',
    status: initialData?.status ?? 'DRAFT',
    visibility: initialData?.visibility ?? 'PUBLIC',
    price: initialData?.price ?? '',
    currency: initialData?.currency ?? 'USD',
    rentPeriod: initialData?.rentPeriod ?? '',
    headline: initialData?.headline ?? '',
    description: initialData?.description ?? '',
    highlights: (initialData?.highlights ?? []) as string[],
  })

  const setField = (key: keyof typeof form, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // Load units when building changes (for UNIT subject type)
  useEffect(() => {
    if (!form.buildingId || form.subjectType !== 'UNIT') {
      setUnits([])
      return
    }
    setLoadingUnits(true)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    fetch(`${apiUrl}/api/buildings/${form.buildingId}/units`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setUnits(d.data ?? []))
      .catch(() => setUnits([]))
      .finally(() => setLoadingUnits(false))
  }, [form.buildingId, form.subjectType])

  function addHighlight() {
    const val = highlightInput.trim()
    if (!val) return
    setField('highlights', [...form.highlights, val])
    setHighlightInput('')
  }

  function removeHighlight(idx: number) {
    setField('highlights', form.highlights.filter((_: string, i: number) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.price || Number(form.price) <= 0) { setError('Price must be greater than 0'); return }
    if (form.subjectType === 'BUILDING' && !form.buildingId) { setError('Please select a building'); return }
    if (form.subjectType === 'UNIT' && !form.unitId) { setError('Please select a unit'); return }

    setSaving(true)
    setError(null)

    const payload: any = {
      subjectType: form.subjectType,
      buildingId: form.subjectType === 'BUILDING' ? form.buildingId : null,
      unitId: form.subjectType === 'UNIT' ? form.unitId : null,
      intent: form.intent,
      status: form.status,
      visibility: form.visibility,
      price: parseFloat(String(form.price)),
      currency: form.currency,
      headline: form.headline || null,
      description: form.description || null,
      highlights: form.highlights,
    }
    if (form.intent === 'FOR_RENT' && form.rentPeriod) {
      payload.rentPeriod = form.rentPeriod
    }

    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const url = isEdit ? `${apiUrl}/api/listings/${listingId}` : `${apiUrl}/api/listings`
      // For edit, only send updatable fields
      const body = isEdit
        ? {
            status: payload.status,
            visibility: payload.visibility,
            price: payload.price,
            currency: payload.currency,
            rentPeriod: payload.rentPeriod ?? null,
            headline: payload.headline,
            description: payload.description,
            highlights: payload.highlights,
          }
        : payload

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Failed to save')
        setSaving(false)
        return
      }
      router.push('/admin/listings')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Network error')
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

  const selectedBuilding = buildings.find(b => b.id === form.buildingId)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/listings" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="h-6 w-6" />
            {isEdit ? 'Edit Listing' : 'New Listing'}
          </h1>
          {isEdit && initialData?.headline && (
            <p className="text-sm text-slate-500 mt-0.5">{initialData.headline}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Subject */}
        {!isEdit && (
          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">Subject</h2>
            <div>
              <label className={labelCls}>Listing Type</label>
              <div className="flex gap-3">
                {['BUILDING', 'UNIT'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setField('subjectType', t); setField('unitId', '') }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      form.subjectType === t
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {t === 'BUILDING' ? 'Whole Building / Project' : 'Specific Unit'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Building <span className="text-red-500">*</span></label>
              <select
                value={form.buildingId}
                onChange={e => { setField('buildingId', e.target.value); setField('unitId', '') }}
                className={inputCls}
                required
              >
                <option value="">— Select a building —</option>
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title}{b.city ? ` — ${b.city}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {form.subjectType === 'UNIT' && form.buildingId && (
              <div>
                <label className={labelCls}>Unit <span className="text-red-500">*</span></label>
                {loadingUnits ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading units...
                  </div>
                ) : units.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">
                    No units found for this building.{' '}
                    <Link href={`/admin/buildings/${form.buildingId}`} className="text-sky-600 hover:underline">
                      Add units from the building edit page.
                    </Link>
                  </p>
                ) : (
                  <select value={form.unitId} onChange={e => setField('unitId', e.target.value)} className={inputCls} required>
                    <option value="">— Select a unit —</option>
                    {units.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.unitNumber ?? u.id} {u.kind ? `· ${u.kind}` : ''} {u.bedrooms != null ? `· ${u.bedrooms}BR` : ''} {u.areaSqm ? `· ${u.areaSqm}m²` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {isEdit && initialData?.building && (
          <div className="bg-slate-50 border rounded-xl p-4 text-sm text-slate-600">
            <span className="font-medium text-slate-900">{initialData.building.title}</span>
            {initialData.unit && <span className="ml-2 text-slate-500">› {initialData.unit.name ?? initialData.unit.unitNumber}</span>}
            {initialData.building.city && <span className="ml-2 text-slate-400">· {initialData.building.city}</span>}
          </div>
        )}

        {/* Listing Details */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Listing Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Intent <span className="text-red-500">*</span></label>
              <select value={form.intent} onChange={e => setField('intent', e.target.value)} className={inputCls}>
                <option value="FOR_SALE">For Sale</option>
                <option value="FOR_RENT">For Rent</option>
              </select>
            </div>
            {form.intent === 'FOR_RENT' && (
              <div>
                <label className={labelCls}>Rent Period</label>
                <select value={form.rentPeriod} onChange={e => setField('rentPeriod', e.target.value)} className={inputCls}>
                  <option value="">— Select period —</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>Price <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={form.price}
                onChange={e => setField('price', e.target.value)}
                className={inputCls}
                placeholder="e.g., 250000"
                min="0"
                step="any"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select value={form.currency} onChange={e => setField('currency', e.target.value)} className={inputCls}>
                <option value="USD">USD ($)</option>
                <option value="LBP">LBP</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)} className={inputCls}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active (Published)</option>
                <option value="UNDER_OFFER">Under Offer</option>
                <option value="CLOSED">Closed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Visibility</label>
              <select value={form.visibility} onChange={e => setField('visibility', e.target.value)} className={inputCls}>
                <option value="PUBLIC">Public</option>
                <option value="ELITE_ONLY">Elite Only</option>
                <option value="HIDDEN">Hidden</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Headline</label>
            <input
              type="text"
              value={form.headline}
              onChange={e => setField('headline', e.target.value)}
              className={inputCls}
              placeholder="e.g., Spacious 3BR with sea view in Verdun"
            />
            <p className="text-xs text-slate-400 mt-1">Shown on the listing card. Falls back to building/unit name if blank.</p>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              rows={4}
              className={inputCls + ' resize-y'}
              placeholder="Additional listing-specific details..."
            />
          </div>

          {/* Highlights */}
          <div>
            <label className={labelCls}>Highlights</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={highlightInput}
                onChange={e => setHighlightInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHighlight() } }}
                className={inputCls}
                placeholder="e.g., New renovation, No shared walls..."
              />
              <button type="button" onClick={addHighlight} className="px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {form.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {form.highlights.map((h: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm">
                    {h}
                    <button type="button" onClick={() => removeHighlight(i)} className="text-slate-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-8">
          <Link href="/admin/listings" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              isEdit ? 'Save Changes' : 'Create Listing'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
