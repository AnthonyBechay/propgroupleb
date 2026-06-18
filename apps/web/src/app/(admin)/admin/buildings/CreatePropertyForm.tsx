'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Building2, Image as ImageIcon, X, Home } from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'

const MOHAFAZAT = ['BEIRUT', 'MOUNT_LEBANON', 'NORTH', 'SOUTH', 'BEKAA', 'NABATIEH', 'AKKAR', 'BAALBEK_HERMEL']
const MOHAFAZAT_LABELS: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon', SOUTH: 'South Lebanon',
  BEKAA: 'Bekaa', NABATIEH: 'Nabatieh', AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}
const UNIT_KINDS = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL']

/**
 * One-step "Add Property" flow. Creates a building, its first unit (the
 * apartment), and — if enabled — a listing, in a single submit. The admin can
 * add more units or refine details afterwards on the property's page.
 */
export function CreatePropertyForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [f, setF] = useState({
    // Building (the property)
    title: '', kind: 'STANDALONE', status: 'NEW_BUILD',
    mohafazat: '', caza: '', city: '', neighborhood: '', address: '',
    shortDescription: '', description: '',
    images: [] as string[],
    // First unit (the apartment)
    unitKind: 'APARTMENT', bedrooms: '', bathrooms: '', areaSqm: '', floor: '',
    // Listing
    enableListing: true, intent: 'FOR_SALE', price: '', currency: 'USD', listingStatus: 'ACTIVE',
  })
  const set = (k: keyof typeof f, v: unknown) => setF(p => ({ ...p, [k]: v }))

  async function uploadImages(files: FileList) {
    setUploading(true)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', 'buildings')
        if (f.title.trim()) fd.append('propertySlug', f.title.trim())
        const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', credentials: 'include', body: fd })
        if (res.ok) { const d = await res.json(); if (d.url) urls.push(d.url) }
      } catch { /* skip */ }
    }
    if (urls.length) setF(p => ({ ...p, images: [...p.images, ...urls] }))
    setUploading(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.title.trim()) { setError('Property title is required'); return }
    if (f.enableListing && (!f.price || Number(f.price) <= 0)) { setError('Enter a price, or turn off listing'); return }
    setSaving(true)
    setError(null)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    try {
      // 1) Building
      const bRes = await fetch(`${apiUrl}/api/buildings`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.trim(), kind: f.kind, status: f.status, visibility: 'PUBLIC',
          mohafazat: f.mohafazat || null, caza: f.caza || null, city: f.city || null,
          neighborhood: f.neighborhood || null, address: f.address || null,
          shortDescription: f.shortDescription || null, description: f.description || null,
          images: f.images,
        }),
      })
      const bData = await bRes.json()
      if (!bRes.ok) { setError(bData.message || 'Failed to create property'); setSaving(false); return }
      const building = bData.data ?? bData
      const buildingId = building.id

      // 2) First unit (apartment) — images shared so it shows as one property
      const lifecycle = f.enableListing ? (f.intent === 'FOR_RENT' ? 'FOR_RENT' : 'FOR_SALE') : 'VACANT'
      const uRes = await fetch(`${apiUrl}/api/buildings/${buildingId}/units`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: f.unitKind,
          bedrooms: f.bedrooms !== '' ? Number(f.bedrooms) : null,
          bathrooms: f.bathrooms !== '' ? Number(f.bathrooms) : null,
          areaSqm: f.areaSqm !== '' ? Number(f.areaSqm) : null,
          floor: f.floor !== '' ? Number(f.floor) : null,
          lifecycle,
          images: f.images,
        }),
      })
      const uData = await uRes.json()
      const unit = uData.data ?? uData

      // 3) Listing (optional)
      if (f.enableListing && unit?.id) {
        await fetch(`${apiUrl}/api/listings`, {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectType: 'UNIT', unitId: unit.id, buildingId,
            intent: f.intent, price: Number(f.price), currency: f.currency,
            status: f.listingStatus, visibility: 'PUBLIC', highlights: [],
          }),
        }).catch(() => {})
      }

      router.push(`/admin/buildings/${buildingId}`)
      router.refresh()
    } catch {
      setError('Network error')
      setSaving(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'
  const lbl = 'block text-sm font-medium text-slate-700 mb-1'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/buildings" className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Building2 className="h-6 w-6" /> Add Property</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a property and its first unit in one step. You can add more units afterwards.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Property */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Property details</h2>
          <div>
            <label className={lbl}>Title <span className="text-red-500">*</span></label>
            <input value={f.title} onChange={e => set('title', e.target.value)} className={inp} placeholder="e.g., Elegant Apartment in Verdun" required />
            <p className="text-xs text-slate-400 mt-1">This is the title shown on the website.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Status</label>
              <select value={f.status} onChange={e => set('status', e.target.value)} className={inp}>
                <option value="OFF_PLAN">Off-Plan</option>
                <option value="NEW_BUILD">New Build</option>
                <option value="RESALE">Resale</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Region</label>
              <select value={f.mohafazat} onChange={e => set('mohafazat', e.target.value)} className={inp}>
                <option value="">— Select region —</option>
                {MOHAFAZAT.map(m => <option key={m} value={m}>{MOHAFAZAT_LABELS[m]}</option>)}
              </select>
            </div>
            <div><label className={lbl}>City</label><input value={f.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="e.g., Beirut" /></div>
            <div><label className={lbl}>Neighborhood</label><input value={f.neighborhood} onChange={e => set('neighborhood', e.target.value)} className={inp} placeholder="e.g., Verdun" /></div>
            <div className="sm:col-span-2"><label className={lbl}>Address</label><input value={f.address} onChange={e => set('address', e.target.value)} className={inp} placeholder="Street address" /></div>
          </div>
          <div><label className={lbl}>Short description</label><input value={f.shortDescription} onChange={e => set('shortDescription', e.target.value)} className={inp} placeholder="One-line summary shown on cards" /></div>
          <div><label className={lbl}>Full description</label><textarea value={f.description} onChange={e => set('description', e.target.value)} rows={4} className={inp + ' resize-y'} placeholder="Detailed description…" /></div>
        </div>

        {/* Apartment */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><Home className="h-4 w-4 text-slate-500" /> The apartment (unit)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={lbl}>Type</label>
              <select value={f.unitKind} onChange={e => set('unitKind', e.target.value)} className={inp}>
                {UNIT_KINDS.map(k => <option key={k} value={k}>{k.charAt(0) + k.slice(1).toLowerCase().replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className={lbl}>Beds</label><input type="number" min="0" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Baths</label><input type="number" min="0" value={f.bathrooms} onChange={e => set('bathrooms', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Area m²</label><input type="number" min="0" value={f.areaSqm} onChange={e => set('areaSqm', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Floor</label><input type="number" value={f.floor} onChange={e => set('floor', e.target.value)} className={inp} /></div>
          </div>
        </div>

        {/* Listing */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.enableListing} onChange={e => set('enableListing', e.target.checked)} className="rounded border-slate-300" />
            <span className="font-semibold text-slate-900">List this property now</span>
          </label>
          {f.enableListing && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className={lbl}>For</label>
                <select value={f.intent} onChange={e => set('intent', e.target.value)} className={inp}>
                  <option value="FOR_SALE">Sale</option>
                  <option value="FOR_RENT">Rent</option>
                </select>
              </div>
              <div><label className={lbl}>Price</label><input type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} className={inp} placeholder="250000" /></div>
              <div>
                <label className={lbl}>Currency</label>
                <select value={f.currency} onChange={e => set('currency', e.target.value)} className={inp}><option value="USD">USD</option><option value="LBP">LBP</option></select>
              </div>
              <div>
                <label className={lbl}>Visibility</label>
                <select value={f.listingStatus} onChange={e => set('listingStatus', e.target.value)} className={inp}>
                  <option value="ACTIVE">Active (public)</option>
                  <option value="DRAFT">Draft (hidden)</option>
                </select>
              </div>
            </div>
          )}
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
                  {i === 0 && <span className="absolute top-1 left-1 text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded">Cover</span>}
                  <button type="button" onClick={() => setF(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center hover:border-slate-400 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            {uploading ? <span className="text-sm text-slate-500 inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>
              : <span className="text-sm text-slate-500 inline-flex items-center gap-2"><ImageIcon className="h-4 w-4 text-slate-400" /> Click to upload photos — first is the cover</span>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { if (e.target.files?.length) uploadImages(e.target.files); e.target.value = '' }} />
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
