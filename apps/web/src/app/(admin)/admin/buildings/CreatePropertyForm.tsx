'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Building2, Image as ImageIcon, X, Home, Plus, Sparkles, Star, FileText, Upload, Video } from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { PaymentPlansEditor, type PaymentPlan } from '@/components/admin/PaymentPlansEditor'
import { LocationFields } from '@/components/admin/LocationFields'
import { isKnownLocation } from '@/lib/lebanon-locations'

const UNIT_KINDS = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL']
const AMENITIES = [
  { key: 'hasGenerator', label: 'Generator' }, { key: 'hasElevator', label: 'Elevator' },
  { key: 'hasPool', label: 'Pool' }, { key: 'hasGym', label: 'Gym' },
  { key: 'hasConcierge', label: 'Concierge' }, { key: 'hasSecurity', label: 'Security' },
  { key: 'hasGarden', label: 'Garden' }, { key: 'hasRooftop', label: 'Rooftop' },
  { key: 'hasSolarPower', label: 'Solar Power' },
] as const
const DOC_TYPES = ['FLOOR_PLAN', 'BROCHURE', 'CONTRACT', 'LEGAL_DOCUMENT', 'CERTIFICATE', 'OTHER']
const DOC_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan', BROCHURE: 'Brochure', CONTRACT: 'Contract',
  LEGAL_DOCUMENT: 'Legal Document', CERTIFICATE: 'Certificate', OTHER: 'Other',
}

interface DocEntry { file: File; title: string; type: string; isPublic: boolean }

export function CreatePropertyForm() {
  const router = useRouter()
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightInput, setHighlightInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const [f, setF] = useState({
    title: '', kind: 'STANDALONE', status: 'NEW_BUILD', visibility: 'PUBLIC', featured: false,
    shortDescription: '', description: '',
    mohafazat: '', caza: '', city: '', neighborhood: '', address: '',
    locationUrl: '', builtYear: '', totalFloors: '', parkingSpaces: '',
    hasGenerator: false, hasElevator: false, hasPool: false, hasGym: false, hasConcierge: false,
    hasSecurity: false, hasGarden: false, hasRooftop: false, hasSolarPower: false,
    videoUrl: '', highlightedFeatures: [] as string[],
    metaTitle: '', metaDescription: '',
    images: [] as string[],
    unitKind: 'APARTMENT', bedrooms: '', bathrooms: '', areaSqm: '', floor: '',
    enableListing: true, intent: 'FOR_SALE', priceMode: 'TOTAL', price: '', currency: 'USD', listingStatus: 'ACTIVE', negotiable: false,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }))

  const [docs, setDocs] = useState<DocEntry[]>([])
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([])

  // ── Highlights ──────────────────────────────────────────────────────────────
  function addHighlight() {
    const v = highlightInput.trim()
    if (!v) return
    setF(p => ({ ...p, highlightedFeatures: [...p.highlightedFeatures, v] }))
    setHighlightInput('')
  }

  // ── Images ──────────────────────────────────────────────────────────────────
  async function uploadImages(files: FileList) {
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file); fd.append('folder', 'buildings')
        if (f.title.trim()) fd.append('propertySlug', f.title.trim())
        const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', credentials: 'include', body: fd })
        if (res.ok) { const d = await res.json(); if (d.url) urls.push(d.url) }
      } catch { /* skip */ }
    }
    if (urls.length) setF(p => ({ ...p, images: [...p.images, ...urls] }))
    setUploading(false)
  }
  async function removeImage(idx: number) {
    const url = f.images[idx]
    if (!url) return
    // Actually delete the just-uploaded file from R2 so it isn't orphaned.
    try {
      await fetch(`${apiUrl}/api/upload`, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      })
    } catch { /* best effort */ }
    setF(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))
  }
  function setCover(idx: number) {
    setF(p => { const imgs = [...p.images]; const [pick] = imgs.splice(idx, 1); imgs.unshift(pick); return { ...p, images: imgs } })
  }
  async function uploadVideo(file: File) {
    setUploadingVideo(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (f.title.trim()) fd.append('propertySlug', f.title.trim())
      const res = await fetch(`${apiUrl}/api/upload/video`, { method: 'POST', credentials: 'include', body: fd })
      if (res.ok) { const d = await res.json(); if (d.url) set('videoUrl', d.url) }
      else { const e = await res.json().catch(() => ({})); setError(e.message || e.error || 'Video upload failed') }
    } catch { setError('Video upload failed') } finally { setUploadingVideo(false) }
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  function addDocs(files: FileList) {
    const next = Array.from(files).map(file => ({ file, title: file.name.replace(/\.[^.]+$/, ''), type: 'OTHER', isPublic: false }))
    setDocs(d => [...d, ...next])
  }

  // ── AI SEO (from live form attributes) ──────────────────────────────────────
  async function generateSeo() {
    if (!f.title.trim()) { setError('Add a title first, then generate SEO'); return }
    setAiLoading(true); setError(null)
    try {
      const attributes = {
        title: f.title, neighborhood: f.neighborhood, city: f.city, caza: f.caza, mohafazat: f.mohafazat,
        kind: f.kind, status: f.status, totalFloors: f.totalFloors, builtYear: f.builtYear,
        hasGenerator: f.hasGenerator, hasElevator: f.hasElevator, hasPool: f.hasPool, hasGym: f.hasGym,
        hasConcierge: f.hasConcierge, hasSecurity: f.hasSecurity, hasGarden: f.hasGarden, hasRooftop: f.hasRooftop, hasSolarPower: f.hasSolarPower,
        highlightedFeatures: f.highlightedFeatures, description: f.description || f.shortDescription,
      }
      const res = await fetch(`${apiUrl}/api/ai-seo/generate`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'building', attributes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.message || 'AI generation failed'); return }
      const s = data.data ?? data
      setF(p => ({
        ...p,
        metaTitle: s.metaTitle ?? p.metaTitle,
        metaDescription: s.metaDescription ?? p.metaDescription,
        shortDescription: p.shortDescription || s.shortDescription || p.shortDescription,
      }))
    } catch { setError('Network error') } finally { setAiLoading(false) }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.title.trim()) { setError('Property title is required'); return }
    if (!isKnownLocation({ city: f.city, neighborhood: f.neighborhood })) { setError('Pick a valid location from the search list before saving'); return }
    const perSqm = f.priceMode === 'PER_SQM'
    const area = f.areaSqm !== '' ? Number(f.areaSqm) : 0
    const totalPrice = perSqm ? (Number(f.price) || 0) * area : (Number(f.price) || 0)
    if (f.enableListing) {
      if (!f.price || Number(f.price) <= 0) { setError('Enter a price, or turn off listing'); return }
      if (perSqm && area <= 0) { setError('Set the apartment area to price per m²'); return }
    }
    setSaving(true); setError(null)
    try {
      // 1) Building
      const bRes = await fetch(`${apiUrl}/api/buildings`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.trim(), kind: f.kind, status: f.status, visibility: f.visibility, featured: f.featured,
          shortDescription: f.shortDescription || null, description: f.description || null,
          mohafazat: f.mohafazat || null, caza: f.caza || null, city: f.city || null,
          neighborhood: f.neighborhood || null, address: f.address || null, locationUrl: f.locationUrl || null,
          builtYear: f.builtYear !== '' ? parseInt(f.builtYear) : null,
          totalFloors: f.totalFloors !== '' ? parseInt(f.totalFloors) : null,
          parkingSpaces: f.parkingSpaces !== '' ? parseInt(f.parkingSpaces) : null,
          hasGenerator: f.hasGenerator, hasElevator: f.hasElevator, hasPool: f.hasPool, hasGym: f.hasGym,
          hasConcierge: f.hasConcierge, hasSecurity: f.hasSecurity, hasGarden: f.hasGarden, hasRooftop: f.hasRooftop, hasSolarPower: f.hasSolarPower,
          videoUrl: f.videoUrl || null, highlightedFeatures: f.highlightedFeatures,
          paymentPlans: paymentPlans.length ? paymentPlans : null,
          metaTitle: f.metaTitle || null, metaDescription: f.metaDescription || null, images: f.images,
        }),
      })
      const bData = await bRes.json()
      if (!bRes.ok) { setError(bData.message || bData.error || 'Failed to create property'); setSaving(false); return }
      const buildingId = (bData.data ?? bData)?.id
      if (!buildingId) { setError('Could not create the property.'); setSaving(false); return }

      // 2) First unit
      const lifecycle = f.enableListing ? (f.intent === 'FOR_RENT' ? 'FOR_RENT' : 'FOR_SALE') : 'VACANT'
      const uRes = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: f.unitKind,
          bedrooms: f.bedrooms !== '' ? Number(f.bedrooms) : null,
          bathrooms: f.bathrooms !== '' ? Number(f.bathrooms) : null,
          areaSqm: area || null, floor: f.floor !== '' ? Number(f.floor) : null,
          lifecycle, // photos live on the property (building), not duplicated on the unit
        }),
      })
      const unit = (await uRes.json().catch(() => ({}))).data ?? {}

      // 3) Listing
      if (f.enableListing && unit?.id) {
        await fetch(`${apiUrl}/api/listings`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectType: 'UNIT', unitId: unit.id, buildingId, intent: f.intent,
            price: totalPrice, currency: f.currency, status: f.listingStatus, visibility: 'PUBLIC',
            negotiable: f.negotiable, highlights: [],
          }),
        }).catch(() => {})
      }

      // 4) Documents (multipart, attached to the new building)
      for (const d of docs) {
        try {
          const fd = new FormData()
          fd.append('file', d.file); fd.append('propertyId', buildingId)
          fd.append('title', d.title); fd.append('type', d.type); fd.append('isPublic', String(d.isPublic))
          await fetch(`${apiUrl}/api/documents`, { method: 'POST', credentials: 'include', body: fd })
        } catch { /* best effort */ }
      }

      router.push('/admin/buildings')
      router.refresh()
    } catch { setError('Network error'); setSaving(false) }
  }

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'
  const lbl = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/buildings" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Building2 className="h-6 w-6" /> Add Property</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a property and its first unit in one step.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Basic info */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={lbl}>Title <span className="text-red-500">*</span></label>
              <input value={f.title} onChange={e => set('title', e.target.value)} className={inp} placeholder="e.g., Elegant Apartment in Verdun" required />
              <p className="text-xs text-slate-400 mt-1">This is the title shown on the website.</p>
            </div>
            <div>
              <label className={lbl}>Kind</label>
              <select value={f.kind} onChange={e => set('kind', e.target.value)} className={inp}>
                <option value="STANDALONE">Standalone</option><option value="PROJECT">Project</option><option value="COMMUNITY">Community</option><option value="MIXED_USE">Mixed Use</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select value={f.status} onChange={e => set('status', e.target.value)} className={inp}>
                <option value="OFF_PLAN">Off-Plan</option><option value="NEW_BUILD">New Build</option><option value="RESALE">Resale</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Visibility</label>
              <select value={f.visibility} onChange={e => set('visibility', e.target.value)} className={inp}>
                <option value="PUBLIC">Public</option><option value="ELITE_ONLY">Elite Only</option><option value="HIDDEN">Hidden</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="featured" checked={f.featured} onChange={e => set('featured', e.target.checked)} className="rounded border-slate-300" />
              <label htmlFor="featured" className="text-sm text-slate-700 cursor-pointer">Featured listing</label>
            </div>
          </div>
          <div><label className={lbl}>Short Description</label><input value={f.shortDescription} onChange={e => set('shortDescription', e.target.value)} className={inp} placeholder="One-line summary shown on cards" /></div>
          <div><label className={lbl}>Full Description</label><textarea value={f.description} onChange={e => set('description', e.target.value)} rows={4} className={inp + ' resize-y'} placeholder="Detailed description…" /></div>
        </div>

        {/* Location */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Location</h2>
          <LocationFields
            value={{ mohafazat: f.mohafazat, caza: f.caza, city: f.city, neighborhood: f.neighborhood }}
            onChange={(patch) => setF(p => ({ ...p, ...patch }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className={lbl}>Street Address <span className="text-slate-400">(optional)</span></label><input value={f.address} onChange={e => set('address', e.target.value)} className={inp} placeholder="Leave empty if not applicable" /></div>
            <div className="sm:col-span-2"><label className={lbl}>Google Maps URL</label><input type="url" value={f.locationUrl} onChange={e => set('locationUrl', e.target.value)} className={inp} placeholder="https://maps.google.com/..." /></div>
          </div>
        </div>

        {/* Building details */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Building Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className={lbl}>Built Year</label><input type="number" value={f.builtYear} onChange={e => set('builtYear', e.target.value)} className={inp} placeholder="2023" min="1900" max="2050" /></div>
            <div><label className={lbl}>Total Floors</label><input type="number" value={f.totalFloors} onChange={e => set('totalFloors', e.target.value)} className={inp} placeholder="12" min="1" /></div>
            <div><label className={lbl}>Parking Spaces</label><input type="number" value={f.parkingSpaces} onChange={e => set('parkingSpaces', e.target.value)} className={inp} placeholder="50" min="0" /></div>
          </div>
        </div>

        {/* Amenities */}
        <div className="bg-white border rounded-xl p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Amenities</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {AMENITIES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <input type="checkbox" checked={(f as any)[key]} onChange={e => set(key as keyof typeof f, e.target.checked)} className="rounded border-slate-300" />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Highlighted features */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Highlighted Features</h2>
          <div className="flex gap-2">
            <input value={highlightInput} onChange={e => setHighlightInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHighlight() } }} className={inp} placeholder="e.g., Sea view, Private pool…" />
            <button type="button" onClick={addHighlight} className="px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 flex-shrink-0"><Plus className="h-4 w-4" /></button>
          </div>
          {f.highlightedFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {f.highlightedFeatures.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm">
                  {h}<button type="button" onClick={() => setF(p => ({ ...p, highlightedFeatures: p.highlightedFeatures.filter((_, idx) => idx !== i) }))} className="text-slate-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Unit details (land/parking/storage skip beds/baths/floor) */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Home className="h-4 w-4 text-slate-500" /> Unit details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={lbl}>Type</label>
              <select value={f.unitKind} onChange={e => set('unitKind', e.target.value)} className={inp}>
                {UNIT_KINDS.map(k => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase().replace('_', ' ')}</option>)}
              </select>
            </div>
            {!['LAND_PARCEL', 'PARKING', 'STORAGE'].includes(f.unitKind) && (
              <>
                <div><label className={lbl}>Beds</label><input type="number" min="0" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Baths</label><input type="number" min="0" value={f.bathrooms} onChange={e => set('bathrooms', e.target.value)} className={inp} /></div>
              </>
            )}
            <div><label className={lbl}>{f.unitKind === 'LAND_PARCEL' ? 'Land area m²' : 'Area m²'}</label><input type="number" min="0" value={f.areaSqm} onChange={e => set('areaSqm', e.target.value)} className={inp} /></div>
            {f.unitKind !== 'LAND_PARCEL' && (
              <div><label className={lbl}>Floor</label><input type="number" value={f.floor} onChange={e => set('floor', e.target.value)} className={inp} /></div>
            )}
          </div>
          {f.unitKind === 'LAND_PARCEL' && <p className="text-xs text-slate-400">For land, set the plot area and list it for sale below — bedrooms/floor don’t apply.</p>}
        </div>

        {/* Listing */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.enableListing} onChange={e => set('enableListing', e.target.checked)} className="rounded border-slate-300" />
            <span className="font-semibold text-slate-900">List this property now</span>
          </label>
          {f.enableListing && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className={lbl}>For</label>
                  <select value={f.intent} onChange={e => set('intent', e.target.value)} className={inp}><option value="FOR_SALE">Sale</option><option value="FOR_RENT">Rent</option></select>
                </div>
                <div>
                  <label className={lbl}>Pricing</label>
                  <select value={f.priceMode} onChange={e => set('priceMode', e.target.value)} className={inp}>
                    <option value="TOTAL">Total price</option>
                    <option value="PER_SQM">Price per m²</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>{f.priceMode === 'PER_SQM' ? 'Price / m²' : 'Price'}</label>
                  <input type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} className={inp} placeholder={f.priceMode === 'PER_SQM' ? '2500' : '250000'} />
                </div>
                <div><label className={lbl}>Currency</label><select value={f.currency} onChange={e => set('currency', e.target.value)} className={inp}><option value="USD">USD</option><option value="LBP">LBP</option></select></div>
              </div>
              {f.priceMode === 'PER_SQM' && f.areaSqm && f.price && (
                <p className="text-xs text-slate-500">Total: <strong>{f.currency} {(Number(f.price) * Number(f.areaSqm)).toLocaleString()}</strong> ({f.areaSqm} m² × {f.currency} {Number(f.price).toLocaleString()})</p>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={f.negotiable} onChange={e => set('negotiable', e.target.checked)} className="rounded border-slate-300" />
                  <span className="text-sm text-slate-700">Price is negotiable</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Visibility:</span>
                  <select value={f.listingStatus} onChange={e => set('listingStatus', e.target.value)} className={inp + ' w-auto'}><option value="ACTIVE">Active (public)</option><option value="DRAFT">Draft (hidden)</option></select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Payment plans */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Payment Plans</h2>
          <PaymentPlansEditor value={paymentPlans} onChange={setPaymentPlans} />
        </div>

        {/* Photos */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Photos</h2>
          {f.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {f.images.map((url, i) => (
                <div key={i} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={normalizeFileUrl(url)} alt="" className="w-full h-full object-cover rounded-lg border" />
                  {i === 0 ? (
                    <span className="absolute top-1 left-1 text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded">Cover</span>
                  ) : (
                    <button type="button" onClick={() => setCover(i)} title="Set as cover" className="absolute top-1 left-1 p-0.5 bg-white/90 text-slate-700 rounded opacity-0 group-hover:opacity-100 hover:bg-white">
                      <Star className="h-3 w-3" />
                    </button>
                  )}
                  <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-slate-400 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {uploading ? <span className="text-sm text-slate-500 inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>
              : <span className="text-sm text-slate-500 inline-flex items-center gap-2"><ImageIcon className="h-4 w-4 text-slate-400" /> Click to upload photos — hover a photo to set it as cover</span>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { if (e.target.files?.length) uploadImages(e.target.files); e.target.value = '' }} />

          {/* Property video — shown as part of the gallery on the public page */}
          <div className="pt-2 border-t border-slate-100">
            <label className={lbl}>Property video <span className="text-slate-400">(optional)</span></label>
            {f.videoUrl ? (
              <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Video className="h-4 w-4 text-slate-500" />
                <span className="flex-1 truncate">{f.videoUrl}</span>
                <button type="button" onClick={() => set('videoUrl', '')} className="text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => videoInputRef.current?.click()} disabled={uploadingVideo} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                  {uploadingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Upload a short video
                </button>
                <span className="text-xs text-slate-400">or paste a YouTube link below</span>
              </div>
            )}
            {!f.videoUrl && (
              <input value={f.videoUrl} onChange={e => set('videoUrl', e.target.value)} className={inp + ' mt-2'} placeholder="https://youtube.com/…  (optional)" />
            )}
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadVideo(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500" /> Documents</h2>
          {docs.length > 0 && (
            <div className="space-y-2">
              {docs.map((d, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <input value={d.title} onChange={e => setDocs(ds => ds.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} className={inp + ' flex-1'} placeholder="Document title" />
                  <select value={d.type} onChange={e => setDocs(ds => ds.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))} className={inp + ' sm:w-44'}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap px-1">
                    <input type="checkbox" checked={d.isPublic} onChange={e => setDocs(ds => ds.map((x, idx) => idx === i ? { ...x, isPublic: e.target.checked } : x))} className="rounded border-slate-300" /> Public
                  </label>
                  <button type="button" onClick={() => setDocs(ds => ds.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => docInputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Upload className="h-4 w-4" /> Add documents
          </button>
          <p className="text-xs text-slate-400">PDF, images, Word or Excel. Public documents show on the property page; private ones are admin-only.</p>
          <input ref={docInputRef} type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={e => { if (e.target.files?.length) addDocs(e.target.files); e.target.value = '' }} />
        </div>

        {/* SEO */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">SEO (optional)</h2>
            <button type="button" onClick={generateSeo} disabled={aiLoading || !f.title.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50">
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiLoading ? 'Generating…' : 'Generate with AI'}
            </button>
          </div>
          <p className="text-xs text-slate-400">AI reads the title, description, location and amenities you entered above.</p>
          <div><label className={lbl}>Meta Title</label><input value={f.metaTitle} onChange={e => set('metaTitle', e.target.value)} className={inp} placeholder="Custom page title for search engines" /></div>
          <div><label className={lbl}>Meta Description</label><textarea value={f.metaDescription} onChange={e => set('metaDescription', e.target.value)} rows={2} className={inp + ' resize-none'} placeholder="Custom description for search engines" /></div>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <Link href="/admin/buildings" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</Link>
          <button type="submit" disabled={saving || uploading} className="px-6 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Property
          </button>
        </div>
      </form>
    </div>
  )
}
