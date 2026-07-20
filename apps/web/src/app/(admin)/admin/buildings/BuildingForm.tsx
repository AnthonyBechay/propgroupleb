'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, X, Loader2, Building2, Image as ImageIcon, Plus, CheckCircle, Sparkles, Star, Video } from 'lucide-react'
import Link from 'next/link'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { PaymentPlansEditor, type PaymentPlan } from '@/components/admin/PaymentPlansEditor'
import { LocationFields } from '@/components/admin/LocationFields'
import { isKnownLocation } from '@/lib/lebanon-locations'
import { BuildingDocumentsManager } from '@/components/admin/BuildingDocumentsManager'

interface Props {
  initialData?: any
  buildingId?: string
  /** When true, hides the self-contained page header (back button + title).
   *  Use this when the form is rendered inside a parent that supplies its own header. */
  embedded?: boolean
}

export function BuildingForm({ initialData, buildingId, embedded }: Props) {
  const router = useRouter()
  const isEdit = !!buildingId
  // Hide building-specific sections (floors, parking, amenities) when every unit
  // is a type they don't apply to — land parcels, parking spots or storage.
  const NON_BUILDING_KINDS = ['LAND_PARCEL', 'PARKING', 'STORAGE']
  const hideBuildingSections = Array.isArray(initialData?.units) && initialData.units.length > 0 &&
    initialData.units.every((u: any) => NON_BUILDING_KINDS.includes(u.kind))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightInput, setHighlightInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: initialData?.title ?? '',
    kind: initialData?.kind ?? 'STANDALONE',
    status: initialData?.status ?? 'NEW_BUILD',
    source: initialData?.source ?? 'ADMIN',
    visibility: initialData?.visibility ?? 'PUBLIC',
    featured: initialData?.featured ?? false,
    description: initialData?.description ?? '',
    shortDescription: initialData?.shortDescription ?? '',
    mohafazat: initialData?.mohafazat ?? '',
    caza: initialData?.caza ?? '',
    city: initialData?.city ?? '',
    neighborhood: initialData?.neighborhood ?? '',
    address: initialData?.address ?? '',
    latitude: initialData?.latitude ?? '',
    longitude: initialData?.longitude ?? '',
    locationUrl: initialData?.locationUrl ?? '',
    builtYear: initialData?.builtYear ?? '',
    totalFloors: initialData?.totalFloors ?? '',
    parkingSpaces: initialData?.parkingSpaces ?? '',
    hasGenerator: initialData?.hasGenerator ?? false,
    hasElevator: initialData?.hasElevator ?? false,
    hasPool: initialData?.hasPool ?? false,
    hasGym: initialData?.hasGym ?? false,
    hasConcierge: initialData?.hasConcierge ?? false,
    hasSecurity: initialData?.hasSecurity ?? false,
    hasGarden: initialData?.hasGarden ?? false,
    hasRooftop: initialData?.hasRooftop ?? false,
    hasSolarPower: initialData?.hasSolarPower ?? false,
    images: (initialData?.images ?? []) as string[],
    videoUrl: initialData?.videoUrl ?? '',
    highlightedFeatures: (initialData?.highlightedFeatures ?? []) as string[],
    metaTitle: initialData?.metaTitle ?? '',
    metaDescription: initialData?.metaDescription ?? '',
    organizationId: initialData?.organizationId ?? '',
    paymentPlans: (initialData?.paymentPlans ?? []) as PaymentPlan[],
  })

  // Organizations (for assigning a building to a PM company / agency)
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    fetch(`${apiUrl}/api/organizations`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const d = j?.data ?? j; if (Array.isArray(d)) setOrgs(d.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name }))) })
      .catch(() => {})
  }, [])

  const setField = (key: keyof typeof form, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  async function uploadImages(files: FileList) {
    setUploadingImages(true)
    setError(null)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    const urls: string[] = []
    const failed: string[] = []
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', 'buildings')
        // Group uploads under buildings/<slug>/images/… in R2. Prefer the title
        // (human-readable folders); fall back to the id for brand-new untitled
        // buildings so files still get a stable per-building home.
        const slug = (form.title?.trim() || buildingId || '').trim()
        if (slug) fd.append('propertySlug', slug)
        const res = await fetch(`${apiUrl}/api/upload`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        })
        if (res.ok) {
          const data = await res.json()
          if (data.url) urls.push(data.url)
        } else {
          const err = await res.json().catch(() => ({}))
          failed.push(`${file.name}: ${err.error || res.statusText}`)
        }
      } catch (e: any) {
        failed.push(`${file.name}: ${e.message || 'Network error'}`)
      }
    }
    if (urls.length) setField('images', [...form.images, ...urls])
    if (failed.length) setError(`Some images failed to upload:\n${failed.join('\n')}`)
    setUploadingImages(false)
  }

  async function uploadVideo(file: File) {
    setUploadingVideo(true)
    setError(null)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const fd = new FormData()
      fd.append('file', file)
      const slug = (form.title?.trim() || buildingId || '').trim()
      if (slug) fd.append('propertySlug', slug)
      const res = await fetch(`${apiUrl}/api/upload/video`, { method: 'POST', credentials: 'include', body: fd })
      if (res.ok) { const d = await res.json(); if (d.url) setField('videoUrl', d.url) }
      else { const e = await res.json().catch(() => ({})); setError(e.message || e.error || 'Video upload failed') }
    } catch { setError('Video upload failed') } finally { setUploadingVideo(false) }
  }

  const [deletingIdx, setDeletingIdx] = useState<number | null>(null)

  async function removeImage(idx: number) {
    const url = form.images[idx]
    if (!url) return
    // Confirm because this immediately deletes the file from R2 — no undo
    if (!confirm('Delete this image? This will remove the file from storage permanently.')) return

    setDeletingIdx(idx)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      // Best-effort delete the R2 asset. If it fails (e.g., already gone), continue removing from
      // the form so the user can still save without the broken reference.
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
      setField('images', form.images.filter((_: string, i: number) => i !== idx))
      setDeletingIdx(null)
    }
  }

  function addHighlight() {
    const val = highlightInput.trim()
    if (!val) return
    setField('highlightedFeatures', [...form.highlightedFeatures, val])
    setHighlightInput('')
  }

  function removeHighlight(idx: number) {
    setField('highlightedFeatures', form.highlightedFeatures.filter((_: string, i: number) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!isKnownLocation({ city: form.city, neighborhood: form.neighborhood })) { setError('Pick a valid location from the search list before saving'); return }
    setSaving(true)
    setError(null)

    const payload = {
      title: form.title,
      kind: form.kind,
      status: form.status,
      source: form.source,
      visibility: form.visibility,
      featured: form.featured,
      description: form.description || null,
      shortDescription: form.shortDescription || null,
      mohafazat: form.mohafazat || null,
      caza: form.caza || null,
      city: form.city || null,
      neighborhood: form.neighborhood || null,
      address: form.address || null,
      latitude: form.latitude !== '' ? parseFloat(String(form.latitude)) : null,
      longitude: form.longitude !== '' ? parseFloat(String(form.longitude)) : null,
      locationUrl: form.locationUrl || null,
      builtYear: form.builtYear !== '' ? parseInt(String(form.builtYear)) : null,
      totalFloors: form.totalFloors !== '' ? parseInt(String(form.totalFloors)) : null,
      parkingSpaces: form.parkingSpaces !== '' ? parseInt(String(form.parkingSpaces)) : null,
      hasGenerator: form.hasGenerator,
      hasElevator: form.hasElevator,
      hasPool: form.hasPool,
      hasGym: form.hasGym,
      hasConcierge: form.hasConcierge,
      hasSecurity: form.hasSecurity,
      hasGarden: form.hasGarden,
      hasRooftop: form.hasRooftop,
      hasSolarPower: form.hasSolarPower,
      images: form.images,
      videoUrl: form.videoUrl || null,
      highlightedFeatures: form.highlightedFeatures,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      organizationId: form.organizationId || null,
      paymentPlans: form.paymentPlans?.length ? form.paymentPlans : null,
    }

    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const url = isEdit ? `${apiUrl}/api/buildings/${buildingId}` : `${apiUrl}/api/buildings`
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Failed to save')
        setSaving(false)
        return
      }
      if (embedded) {
        // Stay on the tab — just show success confirmation.
        // CRITICAL: reset `saving` here, otherwise the Save button stays stuck
        // on "Saving..." forever even though the API returned 200. (We don't
        // navigate away in embedded mode, so nothing else clears it.)
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        // Refresh server data so the header title / cached building reflect edits.
        router.refresh()
      } else {
        router.push('/admin/buildings')
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
      setSaving(false)
    }
  }

  async function generateSeo() {
    if (!buildingId) return
    setAiLoading(true)
    setAiError(null)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'building', id: buildingId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAiError(data.message || 'AI generation failed')
        return
      }
      const s = data.data ?? data
      setForm(prev => ({
        ...prev,
        metaTitle: s.metaTitle ?? prev.metaTitle,
        metaDescription: s.metaDescription ?? prev.metaDescription,
        // Only fill the short description if the admin hasn't written one.
        shortDescription: prev.shortDescription || s.shortDescription || prev.shortDescription,
      }))
    } catch {
      setAiError('Network error')
    } finally {
      setAiLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

  const AMENITIES = [
    { key: 'hasGenerator', label: 'Generator' },
    { key: 'hasElevator', label: 'Elevator' },
    { key: 'hasPool', label: 'Pool' },
    { key: 'hasGym', label: 'Gym' },
    { key: 'hasConcierge', label: 'Concierge' },
    { key: 'hasSecurity', label: 'Security' },
    { key: 'hasGarden', label: 'Garden' },
    { key: 'hasRooftop', label: 'Rooftop' },
    { key: 'hasSolarPower', label: 'Solar Power' },
  ] as const

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header — hidden when embedded inside a parent with its own header */}
      {!embedded && (
        <div className="flex items-center gap-4">
          <Link href="/admin/buildings" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              {isEdit ? 'Edit Building' : 'Add Building'}
            </h1>
            {isEdit && initialData?.title && (
              <p className="text-sm text-slate-500 mt-0.5">{initialData.title}</p>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Building saved successfully.
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Title <span className="text-red-500">*</span></label>
              <input type="text" value={form.title} onChange={e => setField('title', e.target.value)} className={inputCls} placeholder="e.g., Verdun Residences" required />
              <p className="text-xs text-slate-400 mt-1">This is the title shown on the website.</p>
            </div>
            <div>
              <label className={labelCls}>Kind</label>
              <select value={form.kind} onChange={e => setField('kind', e.target.value)} className={inputCls}>
                <option value="STANDALONE">Standalone</option>
                <option value="PROJECT">Project</option>
                <option value="COMMUNITY">Community</option>
                <option value="MIXED_USE">Mixed Use</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => setField('status', e.target.value)} className={inputCls}>
                <option value="OFF_PLAN">Off-Plan</option>
                <option value="NEW_BUILD">New Build</option>
                <option value="RESALE">Resale</option>
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
            <div>
              <label className={labelCls}>Who posted this</label>
              <select value={form.source} onChange={e => setField('source', e.target.value)} className={inputCls}>
                <option value="ADMIN">Our office (admin)</option>
                <option value="OWNER">Property owner</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">Switch freely — this only changes how the property is labelled and filtered in admin.</p>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="featured" checked={form.featured} onChange={e => setField('featured', e.target.checked)} className="rounded border-slate-300" />
              <label htmlFor="featured" className="text-sm text-slate-700 cursor-pointer">Featured listing</label>
            </div>
            {orgs.length > 0 && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Managed by (organization)</label>
                <select value={form.organizationId} onChange={e => setField('organizationId', e.target.value)} className={inputCls}>
                  <option value="">PropGroup (platform-managed)</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Short Description</label>
            <input type="text" value={form.shortDescription} onChange={e => setField('shortDescription', e.target.value)} className={inputCls} placeholder="One-line summary shown on cards" />
          </div>
          <div>
            <label className={labelCls}>Full Description</label>
            <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={5} className={inputCls + ' resize-y'} placeholder="Detailed description of the building..." />
          </div>
        </div>

        {/* Location */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Location</h2>
          <LocationFields
            value={{ mohafazat: form.mohafazat, caza: form.caza, city: form.city, neighborhood: form.neighborhood }}
            onChange={(patch) => setForm(prev => ({ ...prev, ...patch }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Street Address</label>
              <input type="text" value={form.address} onChange={e => setField('address', e.target.value)} className={inputCls} placeholder="Full street address" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Google Maps URL</label>
              <input type="url" value={form.locationUrl} onChange={e => setField('locationUrl', e.target.value)} className={inputCls} placeholder="https://maps.google.com/..." />
            </div>
          </div>
        </div>

        {/* Building Details — not applicable to land, parking or storage */}
        {!hideBuildingSections && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Building Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Built Year</label>
              <input type="number" value={form.builtYear} onChange={e => setField('builtYear', e.target.value)} className={inputCls} placeholder="e.g., 2023" min="1900" max="2050" />
            </div>
            <div>
              <label className={labelCls}>Total Floors</label>
              <input type="number" value={form.totalFloors} onChange={e => setField('totalFloors', e.target.value)} className={inputCls} placeholder="e.g., 12" min="1" />
            </div>
            <div>
              <label className={labelCls}>Parking Spaces</label>
              <input type="number" value={form.parkingSpaces} onChange={e => setField('parkingSpaces', e.target.value)} className={inputCls} placeholder="e.g., 50" min="0" />
            </div>
          </div>
        </div>
        )}

        {/* Amenities — not applicable to land, parking or storage */}
        {!hideBuildingSections && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Amenities</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AMENITIES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => setField(key, e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
        )}

        {/* Highlighted Features */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Highlighted Features</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={highlightInput}
              onChange={e => setHighlightInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHighlight() } }}
              className={inputCls}
              placeholder="e.g., Sea view, Private pool..."
            />
            <button type="button" onClick={addHighlight} className="px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {form.highlightedFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.highlightedFeatures.map((f: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm">
                  {f}
                  <button type="button" onClick={() => removeHighlight(i)} className="text-slate-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Images */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Images</h2>
          {form.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {form.images.map((url: string, i: number) => (
                <div key={i} className="relative group aspect-square">
                  <img src={normalizeFileUrl(url)} alt="" className="w-full h-full object-cover rounded-lg" />
                  {i === 0 ? (
                    <span className="absolute top-1 left-1 text-[10px] bg-slate-800 text-white px-1.5 py-0.5 rounded font-medium">Cover</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setField('images', [form.images[i], ...form.images.filter((_: string, idx: number) => idx !== i)])}
                      title="Set as cover"
                      className="absolute top-1 left-1 p-0.5 bg-white/90 text-slate-700 rounded opacity-0 group-hover:opacity-100 hover:bg-white"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  {deletingIdx === i && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
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
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadingImages ? (
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Uploading...</span>
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Click to upload images</p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP — first image is the cover</p>
              </>
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

          {/* Property video — kept next to images, same as the create form */}
          <div className="pt-2 border-t border-slate-100">
            <label className={labelCls}>Property video <span className="text-slate-400">(optional)</span></label>
            {form.videoUrl ? (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Video className="h-4 w-4 text-slate-500" />
                <span className="flex-1 truncate">{form.videoUrl}</span>
                <button type="button" onClick={() => setField('videoUrl', '')} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                    {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Upload a short video
                  </button>
                  <span className="text-xs text-slate-400">or paste a YouTube link</span>
                </div>
                <input type="url" value={form.videoUrl} onChange={e => setField('videoUrl', e.target.value)} className={inputCls + ' mt-2'} placeholder="https://youtube.com/…" />
              </>
            )}
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadVideo(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>

        {/* Payment plans */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Payment Plans</h2>
          <PaymentPlansEditor value={form.paymentPlans} onChange={(plans) => setField('paymentPlans', plans)} />
        </div>

        {/* Documents — manage the property's documents (edit only) */}
        {isEdit && buildingId && (
          <div className="bg-white border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">Documents</h2>
            <BuildingDocumentsManager buildingId={buildingId} />
          </div>
        )}

        {/* SEO */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">SEO (optional)</h2>
            <button
              type="button"
              onClick={generateSeo}
              disabled={aiLoading || !isEdit}
              title={isEdit ? 'Auto-write SEO from this building’s details' : 'Save the building first, then generate'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiLoading ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>
          {aiError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{aiError}</p>
          )}
          {!isEdit && (
            <p className="text-xs text-slate-400">Save the building first — the AI uses its saved details to write SEO.</p>
          )}
          <div>
            <label className={labelCls}>Meta Title</label>
            <input type="text" value={form.metaTitle} onChange={e => setField('metaTitle', e.target.value)} className={inputCls} placeholder="Custom page title for search engines" />
          </div>
          <div>
            <label className={labelCls}>Meta Description</label>
            <textarea value={form.metaDescription} onChange={e => setField('metaDescription', e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Custom description for search engines" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pb-8">
          {!embedded && (
            <Link href="/admin/buildings" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Cancel
            </Link>
          )}
          <button
            type="submit"
            disabled={saving || uploadingImages}
            className="px-6 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
            ) : saved ? (
              <><CheckCircle className="h-4 w-4" /> Saved</>
            ) : (
              isEdit ? 'Save Changes' : 'Create Building'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
