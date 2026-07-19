'use client'

import { useRef, useState } from 'react'
import { Loader2, ImagePlus, X, CheckCircle2, Send } from 'lucide-react'
import { LocationFields } from '@/components/admin/LocationFields'
import { isKnownLocation } from '@/lib/lebanon-locations'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const UNIT_KINDS = [
  { value: 'APARTMENT', label: 'Apartment' }, { value: 'STUDIO', label: 'Studio' },
  { value: 'DUPLEX', label: 'Duplex' }, { value: 'PENTHOUSE', label: 'Penthouse' },
  { value: 'VILLA', label: 'Villa' }, { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'SHOP', label: 'Shop' }, { value: 'OFFICE', label: 'Office' },
  { value: 'LAND_PARCEL', label: 'Land' },
]

const MAX_PHOTOS = 12

/**
 * Public owner-submission form (zero-commission campaign). Anyone with the link
 * can submit; the record lands in /admin/submissions for review — nothing goes
 * live until an admin approves it.
 */
export function SubmitPropertyForm() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [f, setF] = useState({
    sellerName: '', sellerPhone: '', sellerEmail: '', preferredContact: 'phone',
    title: '', description: '', unitKind: 'APARTMENT', intent: 'FOR_SALE',
    bedrooms: '', bathrooms: '', areaSqm: '', floor: '',
    price: '', currency: 'USD', negotiable: false,
    mohafazat: '', caza: '', city: '', neighborhood: '', address: '',
  })
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof f, v: string | boolean) => setF(p => ({ ...p, [k]: v }))

  const isLand = f.unitKind === 'LAND_PARCEL'
  const showBeds = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE'].includes(f.unitKind)
  const showBaths = showBeds || ['SHOP', 'OFFICE'].includes(f.unitKind)
  const showFloor = !['VILLA', 'TOWNHOUSE', 'LAND_PARCEL'].includes(f.unitKind)

  function addPhotos(files: FileList) {
    const next = [...photos]
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) break
      if (!file.type.startsWith('image/')) continue
      next.push({ file, preview: URL.createObjectURL(file) })
    }
    setPhotos(next)
  }
  function removePhoto(idx: number) {
    URL.revokeObjectURL(photos[idx].preview)
    setPhotos(p => p.filter((_, i) => i !== idx))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.sellerName.trim() || !f.sellerPhone.trim()) { setError('Please add your name and phone number so we can contact you.'); return }
    if (!f.title.trim()) { setError('Give your property a short title.'); return }
    if (!isKnownLocation({ city: f.city, neighborhood: f.neighborhood })) { setError('Please pick your property’s location from the search list.'); return }
    if (!f.price || Number(f.price) <= 0) { setError('Add your asking price.'); return }
    if (photos.length === 0) { setError('Add at least one photo of your property.'); return }

    setSubmitting(true); setError(null)
    try {
      const fd = new FormData()
      const fields: Record<string, string> = {
        sellerName: f.sellerName.trim(), sellerPhone: f.sellerPhone.trim(),
        preferredContact: f.preferredContact,
        title: f.title.trim(), unitKind: f.unitKind, intent: f.intent,
        currency: f.currency, negotiable: String(f.negotiable),
        price: f.price,
      }
      if (f.sellerEmail.trim()) fields.sellerEmail = f.sellerEmail.trim()
      if (f.description.trim()) fields.description = f.description.trim()
      if (showBeds && f.bedrooms !== '') fields.bedrooms = f.bedrooms
      if (showBaths && f.bathrooms !== '') fields.bathrooms = f.bathrooms
      if (f.areaSqm !== '') fields.areaSqm = f.areaSqm
      if (showFloor && f.floor !== '') fields.floor = f.floor
      if (f.mohafazat) fields.mohafazat = f.mohafazat
      if (f.caza) fields.caza = f.caza
      if (f.city) fields.city = f.city
      if (f.neighborhood) fields.neighborhood = f.neighborhood
      if (f.address.trim()) fields.address = f.address.trim()
      for (const [k, v] of Object.entries(fields)) fd.append(k, v)
      for (const p of photos) fd.append('photos', p.file)

      const res = await fetch(`${apiUrl}/api/submissions`, { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || j.error || 'Something went wrong — please try again.')
        return
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('Network error — please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'
  const lbl = 'block text-sm font-medium text-slate-700 mb-1'

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <h2 className="mt-4 text-xl font-bold text-slate-900">Thank you — we received your property!</h2>
        <p className="mt-2 text-slate-500 text-sm max-w-md mx-auto">
          Our team will review the details and contact you on <strong className="text-slate-700">{f.sellerPhone}</strong> to
          confirm before publishing. Remember: zero commission, as promised.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {/* Contact */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Your contact details</h2>
        <p className="text-xs text-slate-400 -mt-2">So our team can reach you to confirm and publish the listing.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Full name <span className="text-red-500">*</span></label>
            <input value={f.sellerName} onChange={e => set('sellerName', e.target.value)} className={inp} placeholder="e.g., Rami Khoury" required />
          </div>
          <div>
            <label className={lbl}>Phone / WhatsApp <span className="text-red-500">*</span></label>
            <input value={f.sellerPhone} onChange={e => set('sellerPhone', e.target.value)} className={inp} placeholder="+961 70 000 000" required />
          </div>
          <div>
            <label className={lbl}>Email <span className="text-slate-400">(optional)</span></label>
            <input type="email" value={f.sellerEmail} onChange={e => set('sellerEmail', e.target.value)} className={inp} placeholder="you@example.com" />
          </div>
          <div>
            <label className={lbl}>Preferred contact</label>
            <select value={f.preferredContact} onChange={e => set('preferredContact', e.target.value)} className={inp}>
              <option value="phone">Phone call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>
        </div>
      </div>

      {/* Property */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Your property</h2>
        <div>
          <label className={lbl}>Title <span className="text-red-500">*</span></label>
          <input value={f.title} onChange={e => set('title', e.target.value)} className={inp} placeholder="e.g., Sunny 2-bedroom apartment in Achrafieh" required />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className={lbl}>Type</label>
            <select value={f.unitKind} onChange={e => set('unitKind', e.target.value)} className={inp}>
              {UNIT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          {showBeds && <div><label className={lbl}>Beds</label><input type="number" min="0" value={f.bedrooms} onChange={e => set('bedrooms', e.target.value)} className={inp} /></div>}
          {showBaths && <div><label className={lbl}>Baths</label><input type="number" min="0" value={f.bathrooms} onChange={e => set('bathrooms', e.target.value)} className={inp} /></div>}
          <div><label className={lbl}>{isLand ? 'Land area m²' : 'Area m²'}</label><input type="number" min="0" value={f.areaSqm} onChange={e => set('areaSqm', e.target.value)} className={inp} /></div>
          {showFloor && <div><label className={lbl}>Floor</label><input type="number" value={f.floor} onChange={e => set('floor', e.target.value)} className={inp} /></div>}
        </div>
        <div>
          <label className={lbl}>Description <span className="text-slate-400">(optional)</span></label>
          <textarea value={f.description} onChange={e => set('description', e.target.value)} rows={4} className={inp + ' resize-y'} placeholder="Condition, view, renovations, why it's special…" />
        </div>
      </div>

      {/* Location */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Location</h2>
        <LocationFields
          value={{ mohafazat: f.mohafazat, caza: f.caza, city: f.city, neighborhood: f.neighborhood }}
          onChange={(patch) => setF(p => ({ ...p, ...patch }))}
        />
        <div>
          <label className={lbl}>Street / building <span className="text-slate-400">(optional — never shown publicly without your OK)</span></label>
          <input value={f.address} onChange={e => set('address', e.target.value)} className={inp} placeholder="e.g., Main street, XYZ building" />
        </div>
      </div>

      {/* Photos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Photos <span className="text-red-500">*</span></h2>
        <p className="text-xs text-slate-400 -mt-2">Bright, clear photos rent and sell faster. Up to {MAX_PHOTOS}.</p>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {photos.map((p, i) => (
              <div key={p.preview} className="relative group aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200" />
                {i === 0 && <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-white/90 text-slate-700 rounded px-1.5 py-0.5">Cover</span>}
                <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length < MAX_PHOTOS && (
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-400 transition-colors cursor-pointer"
            onClick={() => photoInputRef.current?.click()}
          >
            <ImagePlus className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Click to add photos</p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG or WebP — first photo is the cover</p>
          </div>
        )}
        <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { if (e.target.files?.length) addPhotos(e.target.files); e.target.value = '' }} />
      </div>

      {/* Price */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Asking price</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={lbl}>I want to</label>
            <select value={f.intent} onChange={e => set('intent', e.target.value)} className={inp}>
              <option value="FOR_SALE">Sell</option>
              <option value="FOR_RENT">Rent out</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Price <span className="text-red-500">*</span></label>
            <input type="number" min="0" value={f.price} onChange={e => set('price', e.target.value)} className={inp} placeholder={f.intent === 'FOR_RENT' ? '800 / month' : '250000'} />
          </div>
          <div>
            <label className={lbl}>Currency</label>
            <select value={f.currency} onChange={e => set('currency', e.target.value)} className={inp}>
              <option value="USD">USD</option>
              <option value="LBP">LBP</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-6">
            <input type="checkbox" checked={f.negotiable} onChange={e => set('negotiable', e.target.checked)} className="rounded border-slate-300" />
            <span className="text-sm text-slate-700">Negotiable</span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? 'Submitting…' : 'Submit my property — 0% commission'}
      </button>
    </form>
  )
}
