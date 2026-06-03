'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Plus, Pencil, Trash2, Tag, Loader2, X,
  Building2, Bed, Square, Layers, ChevronDown, ChevronUp,
  DollarSign, BadgePlus, ExternalLink, Archive, ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'

// ── constants ─────────────────────────────────────────────────────────────────

const KIND_OPTIONS = [
  { value: 'APARTMENT',   label: 'Apartment' },
  { value: 'STUDIO',      label: 'Studio' },
  { value: 'DUPLEX',      label: 'Duplex' },
  { value: 'PENTHOUSE',   label: 'Penthouse' },
  { value: 'VILLA',       label: 'Villa' },
  { value: 'TOWNHOUSE',   label: 'Townhouse' },
  { value: 'SHOP',        label: 'Shop' },
  { value: 'OFFICE',      label: 'Office' },
  { value: 'LAND_PARCEL', label: 'Land' },
  { value: 'STORAGE',     label: 'Storage' },
  { value: 'PARKING',     label: 'Parking' },
]

const LIFECYCLE_OPTIONS = [
  { value: 'DRAFT',          label: 'Draft' },
  { value: 'VACANT',         label: 'Vacant' },
  { value: 'FOR_SALE',       label: 'For Sale' },
  { value: 'FOR_RENT',       label: 'For Rent' },
  { value: 'RESERVED',       label: 'Reserved' },
  { value: 'SOLD',           label: 'Sold' },
  { value: 'RENTED',         label: 'Rented' },
  { value: 'OWNER_OCCUPIED', label: 'Owner Occupied' },
  { value: 'OFF_MARKET',     label: 'Off Market' },
]

const LIFECYCLE_COLORS: Record<string, string> = {
  DRAFT:          'bg-zinc-100 text-zinc-500',
  VACANT:         'bg-zinc-100 text-zinc-600',
  FOR_SALE:       'bg-emerald-100 text-emerald-700',
  FOR_RENT:       'bg-sky-100 text-sky-700',
  RESERVED:       'bg-amber-100 text-amber-700',
  SOLD:           'bg-zinc-200 text-zinc-600',
  RENTED:         'bg-zinc-200 text-zinc-600',
  OWNER_OCCUPIED: 'bg-purple-100 text-purple-700',
  OFF_MARKET:     'bg-zinc-100 text-zinc-400',
}

const LISTING_INTENT_COLORS: Record<string, string> = {
  FOR_SALE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FOR_RENT: 'bg-sky-100 text-sky-700 border-sky-200',
}

const LISTING_STATUS_DOT: Record<string, string> = {
  ACTIVE:      'bg-emerald-500',
  DRAFT:       'bg-zinc-400',
  UNDER_OFFER: 'bg-amber-500',
  CLOSED:      'bg-red-400',
  ARCHIVED:    'bg-zinc-300',
}

// ── helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string) {
  if (currency === 'LBP') return `${(price / 1_000_000).toFixed(1)}M LBP`
  return `$${price.toLocaleString()}`
}

// ── Unit form (create / edit) ─────────────────────────────────────────────────

const EMPTY_UNIT = {
  kind: 'APARTMENT', name: '', unitNumber: '', floor: '',
  bedrooms: '', bathrooms: '', areaSqm: '', lifecycle: 'VACANT',
  images: [] as string[],
}
type UnitFormState = typeof EMPTY_UNIT

function buildUnitPayload(f: UnitFormState) {
  return {
    kind:      f.kind || undefined,
    name:      f.name || null,
    unitNumber:f.unitNumber || null,
    floor:     f.floor  !== '' ? Number(f.floor)  : null,
    bedrooms:  f.bedrooms  !== '' ? Number(f.bedrooms)  : null,
    bathrooms: f.bathrooms !== '' ? Number(f.bathrooms) : null,
    areaSqm:   f.areaSqm   !== '' ? Number(f.areaSqm)   : null,
    lifecycle: f.lifecycle || undefined,
    images:    f.images,
  }
}

function UnitFormPanel({
  initial, buildingId, onSave, onCancel, saving,
}: {
  initial: UnitFormState
  buildingId: string
  onSave: (f: UnitFormState) => void
  onCancel: () => void
  saving: boolean
}) {
  const [f, setF] = useState<UnitFormState>(initial)
  const set = (k: keyof UnitFormState, v: string) => setF(p => ({ ...p, [k]: v }))
  const inp = 'w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white'
  const lbl = 'block text-xs font-medium text-zinc-600 mb-1'

  // ── Image upload state ───────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  async function uploadImages(files: FileList) {
    setUploading(true)
    setImgError(null)
    const urls: string[] = []
    const failed: string[] = []
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', 'units')
        // Group unit photos under units/<buildingId>/images/… in R2.
        if (buildingId) fd.append('propertySlug', buildingId)
        const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', credentials: 'include', body: fd })
        if (res.ok) {
          const data = await res.json()
          if (data.url) urls.push(data.url)
        } else {
          const err = await res.json().catch(() => ({}))
          failed.push(`${file.name}: ${err.error || res.statusText}`)
        }
      } catch (e: unknown) {
        failed.push(`${file.name}: ${e instanceof Error ? e.message : 'Network error'}`)
      }
    }
    if (urls.length) setF(p => ({ ...p, images: [...p.images, ...urls] }))
    if (failed.length) setImgError(`Some images failed:\n${failed.join('\n')}`)
    setUploading(false)
  }

  async function removeImage(idx: number) {
    const url = f.images[idx]
    if (!url) return
    if (!confirm('Delete this image? This removes the file from storage permanently.')) return
    setDeletingIdx(idx)
    try {
      const res = await fetch(`${apiUrl}/api/upload`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({}))
        console.warn('R2 delete failed:', err)
      }
    } catch (e) {
      console.warn('R2 delete network error:', e)
    } finally {
      setF(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))
      setDeletingIdx(null)
    }
  }

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Unit details</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Type</label>
          <select value={f.kind} onChange={e => set('kind', e.target.value)} className={inp}>
            {KIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Display Name</label>
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Unit 3A" className={inp} />
        </div>
        <div>
          <label className={lbl}>Unit No.</label>
          <input value={f.unitNumber} onChange={e => set('unitNumber', e.target.value)} placeholder="301" className={inp} />
        </div>
        <div>
          <label className={lbl}>Floor</label>
          <input type="number" value={f.floor} onChange={e => set('floor', e.target.value)} placeholder="3" className={inp} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={lbl}>Bedrooms</label>
          <input type="number" min="0" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value)} placeholder="2" className={inp} />
        </div>
        <div>
          <label className={lbl}>Bathrooms</label>
          <input type="number" min="0" value={f.bathrooms} onChange={e => set('bathrooms', e.target.value)} placeholder="1" className={inp} />
        </div>
        <div>
          <label className={lbl}>Area (m²)</label>
          <input type="number" min="0" value={f.areaSqm} onChange={e => set('areaSqm', e.target.value)} placeholder="120" className={inp} />
        </div>
        <div>
          <label className={lbl}>Lifecycle</label>
          <select value={f.lifecycle} onChange={e => set('lifecycle', e.target.value)} className={inp}>
            {LIFECYCLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Photos */}
      <div>
        <label className={lbl}>Photos</label>
        {imgError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 whitespace-pre-line">{imgError}</p>
        )}
        {f.images.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2">
            {f.images.map((url, i) => (
              <div key={i} className="relative group aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={normalizeFileUrl(url)} alt="" className="w-full h-full object-cover rounded-lg border border-zinc-200" />
                {i === 0 && (
                  <span className="absolute top-1 left-1 text-[9px] bg-zinc-800 text-white px-1.5 py-0.5 rounded font-medium">Cover</span>
                )}
                {deletingIdx === i && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  disabled={deletingIdx !== null}
                  className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          className="border-2 border-dashed border-zinc-200 rounded-lg p-4 text-center hover:border-zinc-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <ImageIcon className="h-4 w-4 text-zinc-400" /> Click to upload photos
              <span className="text-xs text-zinc-400">— first is the cover</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) uploadImages(e.target.files); e.target.value = '' }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(f)}
          disabled={saving || uploading}
          className="px-5 py-1.5 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save Unit
        </button>
      </div>
    </div>
  )
}

// ── Listing quick-create form ─────────────────────────────────────────────────

const EMPTY_LISTING = {
  intent: 'FOR_SALE',
  price: '',
  currency: 'USD',
  rentPeriod: 'MONTHLY',
  status: 'DRAFT',
  headline: '',
}
type ListingFormState = typeof EMPTY_LISTING

function ListingQuickForm({
  buildingId, unitId, unitLabel,
  onSuccess, onCancel,
}: {
  buildingId: string
  unitId: string
  unitLabel: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [f, setF] = useState<ListingFormState>(EMPTY_LISTING)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof ListingFormState, v: string) => setF(p => ({ ...p, [k]: v }))

  const inp = 'w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white'
  const lbl = 'block text-xs font-medium text-zinc-600 mb-1'

  async function submit() {
    if (!f.price || Number(f.price) <= 0) { setErr('Price must be greater than 0'); return }
    setSaving(true)
    setErr(null)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    try {
      const payload: any = {
        subjectType: 'UNIT',
        unitId,
        buildingId,
        intent: f.intent,
        price: parseFloat(f.price),
        currency: f.currency,
        status: f.status,
        visibility: 'PUBLIC',
        headline: f.headline || null,
        highlights: [],
      }
      if (f.intent === 'FOR_RENT') payload.rentPeriod = f.rentPeriod
      const res = await fetch(`${apiUrl}/api/listings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d.message || 'Failed to create listing')
        return
      }
      onSuccess()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-sky-50/60 border border-sky-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> New listing for {unitLabel}
        </p>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {err && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
      )}

      {/* Intent toggle */}
      <div>
        <label className={lbl}>Listing type</label>
        <div className="flex rounded-lg border border-zinc-200 overflow-hidden bg-white w-fit">
          {(['FOR_SALE', 'FOR_RENT'] as const).map(intent => (
            <button
              key={intent}
              type="button"
              onClick={() => set('intent', intent)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                f.intent === intent
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {intent === 'FOR_SALE' ? 'For Sale' : 'For Rent'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Price */}
        <div className="col-span-2 sm:col-span-1">
          <label className={lbl}>Price <span className="text-red-500">*</span></label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="number"
              min="0"
              step="any"
              value={f.price}
              onChange={e => set('price', e.target.value)}
              placeholder="250000"
              className={inp + ' pl-8'}
            />
          </div>
        </div>

        {/* Currency */}
        <div>
          <label className={lbl}>Currency</label>
          <select value={f.currency} onChange={e => set('currency', e.target.value)} className={inp}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </select>
        </div>

        {/* Rent period (conditional) */}
        {f.intent === 'FOR_RENT' && (
          <div>
            <label className={lbl}>Period</label>
            <select value={f.rentPeriod} onChange={e => set('rentPeriod', e.target.value)} className={inp}>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        )}

        {/* Status */}
        <div>
          <label className={lbl}>Status</label>
          <select value={f.status} onChange={e => set('status', e.target.value)} className={inp}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active (publish now)</option>
          </select>
        </div>
      </div>

      {/* Headline */}
      <div>
        <label className={lbl}>Headline <span className="text-zinc-400">(optional)</span></label>
        <input
          type="text"
          value={f.headline}
          onChange={e => set('headline', e.target.value)}
          placeholder="e.g. Spacious 2BR with sea view in Verdun"
          className={inp}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="px-5 py-1.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create Listing
        </button>
      </div>
    </div>
  )
}

// ── Listing edit panel ────────────────────────────────────────────────────────

function ListingEditPanel({
  listingId, listingLabel,
  onSuccess, onCancel,
}: {
  listingId: string
  listingLabel: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [form, setForm] = useState({
    status:      '',
    visibility:  '',
    price:       '',
    currency:    'USD',
    rentPeriod:  '',
    headline:    '',
    description: '',
    intent:      '',
  })

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))
  const inp = 'w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white'
  const lbl = 'block text-xs font-medium text-zinc-600 mb-1'

  useEffect(() => {
    fetch(`${apiUrl}/api/listings/${listingId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const l = d.data ?? d
        setForm({
          status:      l.status ?? '',
          visibility:  l.visibility ?? 'PUBLIC',
          price:       l.price != null ? String(l.price) : '',
          currency:    l.currency ?? 'USD',
          rentPeriod:  l.rentPeriod ?? '',
          headline:    l.headline ?? '',
          description: l.description ?? '',
          intent:      l.intent ?? '',
        })
      })
      .catch(() => setErr('Failed to load listing'))
      .finally(() => setLoading(false))
  }, [apiUrl, listingId])

  async function submit() {
    if (!form.price || Number(form.price) <= 0) { setErr('Price must be greater than 0'); return }
    setSaving(true)
    setErr(null)
    try {
      const body: any = {
        status:      form.status,
        visibility:  form.visibility,
        price:       parseFloat(form.price),
        currency:    form.currency,
        headline:    form.headline || null,
        description: form.description || null,
        rentPeriod:  form.intent === 'FOR_RENT' && form.rentPeriod ? form.rentPeriod : null,
      }
      const res = await fetch(`${apiUrl}/api/listings/${listingId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d.message || 'Failed to save')
        return
      }
      onSuccess()
    } catch {
      setErr('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function archiveListing() {
    if (!confirm('Archive this listing? It will be hidden from the public site.')) return
    setSaving(true)
    try {
      await fetch(`${apiUrl}/api/listings/${listingId}`, { method: 'DELETE', credentials: 'include' })
      onSuccess()
    } catch {
      setErr('Failed to archive')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 flex items-center gap-2 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading listing…
      </div>
    )
  }

  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> Edit listing · {listingLabel}
        </p>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/listings/${listingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Full edit
          </a>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {err && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className={lbl}>Price <span className="text-red-500">*</span></label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="number" min="0" step="any"
              value={form.price}
              onChange={e => set('price', e.target.value)}
              className={inp + ' pl-8'}
            />
          </div>
        </div>
        <div>
          <label className={lbl}>Currency</label>
          <select value={form.currency} onChange={e => set('currency', e.target.value)} className={inp}>
            <option value="USD">USD</option>
            <option value="LBP">LBP</option>
          </select>
        </div>
        {form.intent === 'FOR_RENT' && (
          <div>
            <label className={lbl}>Period</label>
            <select value={form.rentPeriod} onChange={e => set('rentPeriod', e.target.value)} className={inp}>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        )}
        <div>
          <label className={lbl}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER_OFFER">Under Offer</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label className={lbl}>Visibility</label>
          <select value={form.visibility} onChange={e => set('visibility', e.target.value)} className={inp}>
            <option value="PUBLIC">Public</option>
            <option value="ELITE_ONLY">Elite Only</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </div>
      </div>

      <div>
        <label className={lbl}>Headline</label>
        <input
          type="text" value={form.headline}
          onChange={e => set('headline', e.target.value)}
          placeholder="Short headline shown on cards"
          className={inp}
        />
      </div>

      <div>
        <label className={lbl}>Description <span className="text-zinc-400">(optional)</span></label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={3} className={inp + ' resize-y'}
          placeholder="Additional listing details…"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={archiveListing}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Archive className="h-3.5 w-3.5" /> Archive
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-5 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type PanelMode = 'unit-edit' | 'listing-create' | 'listing-edit'

export function UnitsManager({ buildingId }: { buildingId: string }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  const [units, setUnits]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Which unit has its panel expanded, and in what mode (+ optional listingId for edit)
  const [expanded, setExpanded] = useState<{ id: string; mode: PanelMode; listingId?: string } | null>(null)

  const [showAddUnit, setShowAddUnit]     = useState(false)
  const [saving, setSaving]               = useState(false)
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const [notice, setNotice]               = useState<string | null>(null)

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await res.json()
      setUnits(data.data ?? data)
    } catch {
      setError('Failed to load units')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, buildingId])

  // Auto-load when the component mounts (the tab has been switched to)
  useEffect(() => { fetchUnits() }, [fetchUnits])

  function openPanel(unitId: string, mode: PanelMode, listingId?: string) {
    setExpanded(prev => {
      // Clicking the same panel closes it (toggle)
      if (prev?.id === unitId && prev.mode === mode && prev.listingId === listingId) return null
      return { id: unitId, mode, listingId }
    })
    setShowAddUnit(false)
  }

  async function handleCreateUnit(f: UnitFormState) {
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
        setError(d.message || 'Failed to create unit')
        return
      }
      setShowAddUnit(false)
      await fetchUnits()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateUnit(unitId: string, f: UnitFormState) {
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
        setError(d.message || 'Failed to update unit')
        return
      }
      // Surface the cascade (e.g. "Unit updated — 1 listing updated to match")
      // so the admin sees that changing lifecycle also closed/updated listings.
      if (d.message && /listing/i.test(d.message)) {
        setNotice(d.message)
        setTimeout(() => setNotice(null), 5000)
      }
      setExpanded(null)
      await fetchUnits()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteUnit(unit: any) {
    const label = unit.name || unit.unitNumber || unit.id.slice(0, 8)
    if (!confirm(`Delete unit "${label}"? Active listings on this unit will also be removed.`)) return
    setDeletingId(unit.id)
    try {
      await fetch(`${apiUrl}/api/units/${unit.id}`, { method: 'DELETE', credentials: 'include' })
      await fetchUnits()
    } catch {
      setError('Failed to delete unit')
    } finally {
      setDeletingId(null)
    }
  }

  // ── stats ────────────────────────────────────────────────────────────────────

  const totalListings   = units.flatMap(u => u.listings ?? []).length
  const activeListings  = units.flatMap(u => u.listings ?? []).filter((l: any) => l.status === 'ACTIVE').length

  // ── render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading units…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Units</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {units.length} unit{units.length !== 1 ? 's' : ''}
            {totalListings > 0 && (
              <> · <span className="text-emerald-600 font-medium">{activeListings} active</span> / {totalListings} listing{totalListings !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Building-level listing shortcut */}
          <Link
            href={`/admin/listings/new?buildingId=${buildingId}&subjectType=BUILDING`}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" /> Building Listing
          </Link>
          <Button
            size="sm"
            onClick={() => { setShowAddUnit(s => !s); setExpanded(null) }}
            className="bg-zinc-800 hover:bg-zinc-700 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Unit
          </Button>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-2">
          {error}
          <button onClick={() => setError(null)}><X className="h-4 w-4 flex-shrink-0" /></button>
        </div>
      )}

      {/* Cascade notice (e.g. listings auto-closed when a unit was marked sold) */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-start justify-between gap-2">
          {notice}
          <button onClick={() => setNotice(null)}><X className="h-4 w-4 flex-shrink-0" /></button>
        </div>
      )}

      {/* Add unit form */}
      {showAddUnit && (
        <UnitFormPanel
          initial={EMPTY_UNIT}
          buildingId={buildingId}
          onSave={handleCreateUnit}
          onCancel={() => setShowAddUnit(false)}
          saving={saving}
        />
      )}

      {/* Empty state */}
      {units.length === 0 && !showAddUnit && (
        <div className="text-center py-16 bg-white rounded-2xl border border-zinc-100">
          <Building2 className="h-10 w-10 mx-auto mb-3 text-zinc-200" />
          <p className="text-sm font-medium text-zinc-500">No units yet</p>
          <p className="text-xs text-zinc-400 mt-1">Add the first unit to start creating listings.</p>
          <Button
            size="sm"
            onClick={() => setShowAddUnit(true)}
            className="mt-4 bg-zinc-800 hover:bg-zinc-700 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Unit
          </Button>
        </div>
      )}

      {/* Unit list */}
      {units.length > 0 && (
        <div className="space-y-3">
          {units.map((unit: any) => {
            const isDeleting    = deletingId === unit.id
            const panelUnit     = expanded?.id === unit.id
            const editOpen      = panelUnit && expanded?.mode === 'unit-edit'
            const createOpen    = panelUnit && expanded?.mode === 'listing-create'
            const editListingId = panelUnit && expanded?.mode === 'listing-edit' ? expanded.listingId : null
            const panelOpen     = editOpen || createOpen || !!editListingId
            const label = unit.name || (unit.unitNumber ? `Unit ${unit.unitNumber}` : null) || `Unit ${unit.id.slice(0, 6)}`
            const listings: any[] = unit.listings ?? []

            return (
              <div
                key={unit.id}
                className={`bg-white border rounded-2xl overflow-hidden transition-colors ${
                  isDeleting ? 'opacity-50 border-red-200' : 'border-zinc-200'
                }`}
              >
                {/* Unit row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  {/* Cover thumbnail */}
                  {unit.images?.length > 0 && (
                    <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-zinc-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={normalizeFileUrl(unit.images[0])} alt="" className="w-full h-full object-cover" />
                      {unit.images.length > 1 && (
                        <span className="absolute bottom-0 right-0 text-[9px] bg-black/60 text-white px-1 rounded-tl">
                          {unit.images.length}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-zinc-900 text-sm">{label}</span>
                      {unit.kind && (
                        <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                          {KIND_OPTIONS.find(k => k.value === unit.kind)?.label ?? unit.kind}
                        </span>
                      )}
                      {unit.lifecycle && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LIFECYCLE_COLORS[unit.lifecycle] ?? 'bg-zinc-100 text-zinc-500'}`}>
                          {unit.lifecycle.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                      {unit.floor != null && (
                        <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> Floor {unit.floor}</span>
                      )}
                      {unit.bedrooms != null && (
                        <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {unit.bedrooms} BR</span>
                      )}
                      {unit.areaSqm != null && (
                        <span className="flex items-center gap-1"><Square className="h-3 w-3" /> {unit.areaSqm} m²</span>
                      )}
                    </div>
                  </div>

                  {/* Listings + actions */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {/* Existing listing badges — click to edit inline */}
                    {listings.map((l: any) => (
                      <button
                        key={l.id}
                        onClick={() => openPanel(unit.id, 'listing-edit', l.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                          editListingId === l.id
                            ? 'ring-2 ring-offset-1 ring-amber-400'
                            : 'hover:opacity-80'
                        } ${LISTING_INTENT_COLORS[l.intent] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}
                        title="Edit this listing inline"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LISTING_STATUS_DOT[l.status] ?? 'bg-zinc-400'}`} />
                        {l.intent === 'FOR_SALE' ? 'Sale' : 'Rent'}
                        {l.price ? ` · ${formatPrice(l.price, l.currency)}` : ''}
                      </button>
                    ))}

                    {/* Create new listing button */}
                    <button
                      onClick={() => openPanel(unit.id, 'listing-create')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                        createOpen
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'text-sky-600 border-sky-200 hover:bg-sky-50'
                      }`}
                      title="Create a listing for this unit"
                    >
                      <BadgePlus className="h-3.5 w-3.5" />
                      {listings.length === 0 ? 'List' : '+'}
                    </button>

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1 ml-auto sm:ml-0 pl-1 border-l border-zinc-100">
                      <button
                        onClick={() => openPanel(unit.id, 'unit-edit')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          editOpen
                            ? 'text-zinc-900 bg-zinc-200'
                            : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                        }`}
                        title="Edit unit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUnit(unit)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete unit"
                      >
                        {isDeleting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                      {/* Collapse indicator */}
                      <div className="text-zinc-300 ml-1">
                        {panelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expandable panels */}
                {editOpen && (
                  <div className="px-5 pb-5 border-t border-zinc-100 pt-4">
                    <UnitFormPanel
                      initial={{
                        kind:       unit.kind ?? 'APARTMENT',
                        name:       unit.name ?? '',
                        unitNumber: unit.unitNumber ?? '',
                        floor:      unit.floor != null ? String(unit.floor) : '',
                        bedrooms:   unit.bedrooms != null ? String(unit.bedrooms) : '',
                        bathrooms:  unit.bathrooms != null ? String(unit.bathrooms) : '',
                        areaSqm:    unit.areaSqm != null ? String(unit.areaSqm) : '',
                        lifecycle:  unit.lifecycle ?? 'VACANT',
                        images:     unit.images ?? [],
                      }}
                      buildingId={buildingId}
                      onSave={f => handleUpdateUnit(unit.id, f)}
                      onCancel={() => setExpanded(null)}
                      saving={saving}
                    />
                  </div>
                )}

                {createOpen && (
                  <div className="px-5 pb-5 border-t border-zinc-100 pt-4">
                    <ListingQuickForm
                      buildingId={buildingId}
                      unitId={unit.id}
                      unitLabel={label}
                      onSuccess={async () => { setExpanded(null); await fetchUnits() }}
                      onCancel={() => setExpanded(null)}
                    />
                  </div>
                )}

                {editListingId && (
                  <div className="px-5 pb-5 border-t border-zinc-100 pt-4">
                    <ListingEditPanel
                      listingId={editListingId}
                      listingLabel={label}
                      onSuccess={async () => { setExpanded(null); await fetchUnits() }}
                      onCancel={() => setExpanded(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
