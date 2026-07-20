'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ClipboardList, Loader2, Phone, Mail, MessageCircle, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Eye, Trash2, BedDouble, Bath, Ruler, Building2, ExternalLink, Save,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { MOHAFAZAT_LABEL } from '@/lib/lebanon-locations'

interface Submission {
  id: string
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  sellerName: string
  sellerPhone: string
  sellerEmail: string | null
  preferredContact: string | null
  title: string
  description: string | null
  extraDetails: string | null
  locationUrl: string | null
  unitKind: string
  intent: 'FOR_SALE' | 'FOR_RENT'
  bedrooms: number | null
  bathrooms: number | null
  areaSqm: number | null
  floor: number | null
  price: number | null
  currency: string
  negotiable: boolean
  mohafazat: string | null
  caza: string | null
  city: string | null
  neighborhood: string | null
  address: string | null
  images: string[]
  adminNotes: string | null
  buildingId: string | null
  createdAt: string
}

const STATUS_META: Record<Submission['status'], { label: string; cls: string }> = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  IN_REVIEW: { label: 'In review', cls: 'bg-sky-100 text-sky-700' },
  APPROVED:  { label: 'Published', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-600' },
}

const KIND_LABELS: Record<string, string> = {
  APARTMENT: 'Apartment', STUDIO: 'Studio', DUPLEX: 'Duplex', PENTHOUSE: 'Penthouse',
  VILLA: 'Villa', TOWNHOUSE: 'Townhouse', SHOP: 'Shop', OFFICE: 'Office',
  LAND_PARCEL: 'Land', STORAGE: 'Storage', PARKING: 'Parking',
}

const TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_REVIEW', label: 'In review' },
  { key: 'APPROVED', label: 'Published' },
  { key: 'REJECTED', label: 'Rejected' },
]

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminSubmissionsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = tab === 'all' ? '' : `&status=${tab}`
      const res = await fetch(`${apiUrl}/api/submissions?limit=100${q}`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const j = await res.json()
        setItems(j.data ?? [])
      }
    } finally { setLoading(false) }
  }, [apiUrl, tab])
  useEffect(() => { load() }, [load])

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id)
    try {
      const res = await fetch(`${apiUrl}/api/submissions/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.message || 'Update failed'); return }
      const j = await res.json()
      setItems(prev => prev.map(s => (s.id === id ? { ...s, ...(j.data ?? {}) } : s)))
    } finally { setBusy(null) }
  }

  async function approve(s: Submission) {
    const price = priceDraft[s.id] !== undefined && priceDraft[s.id] !== '' ? Number(priceDraft[s.id]) : s.price
    if (!price || price <= 0) { alert('Set the price first (edit it in the panel), then approve.'); return }
    if (priceDraft[s.id] !== undefined && Number(priceDraft[s.id]) !== s.price) {
      await patch(s.id, { price: Number(priceDraft[s.id]) })
    }
    if (!confirm(`Publish "${s.title}" for ${s.currency} ${price.toLocaleString()}? This creates a live listing.`)) return
    setBusy(s.id)
    try {
      const res = await fetch(`${apiUrl}/api/submissions/${s.id}/approve`, { method: 'POST', credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert(j.message || 'Approve failed'); return }
      await load()
    } finally { setBusy(null) }
  }

  async function remove(s: Submission) {
    if (!confirm(`Delete the submission "${s.title}"? This cannot be undone.`)) return
    setBusy(s.id)
    try {
      const res = await fetch(`${apiUrl}/api/submissions/${s.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) setItems(prev => prev.filter(x => x.id !== s.id))
    } finally { setBusy(null) }
  }

  const counts = {
    pending: items.filter(s => s.status === 'PENDING').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Owner Submissions
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Zero-commission campaign — review what owners submitted, contact them, then publish or reject.
          </p>
        </div>
        <Link
          href="/list-your-property"
          target="_blank"
          className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5"
        >
          Public form <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setOpenId(null) }}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.key === 'PENDING' && counts.pending > 0 && tab !== 'PENDING' && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center text-slate-400">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
          No submissions {tab !== 'all' ? 'in this status' : 'yet'} — share the public form link to start the campaign.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(s => {
            const open = openId === s.id
            const meta = STATUS_META[s.status]
            const location = [s.neighborhood, s.city, s.caza].filter(Boolean).join(', ') || '—'
            return (
              <div key={s.id} className={`bg-white border rounded-xl overflow-hidden ${s.status === 'PENDING' ? 'border-amber-200' : 'border-slate-200'}`}>
                {/* Row */}
                <button type="button" onClick={() => setOpenId(open ? null : s.id)} className="w-full text-left p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    {s.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={normalizeFileUrl(s.images[0])} alt="" className="h-14 w-20 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="h-14 w-20 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 truncate">{s.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                        <span className="text-xs text-slate-400">{KIND_LABELS[s.unitKind] ?? s.unitKind} · {s.intent === 'FOR_RENT' ? 'Rent' : 'Sale'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 flex-wrap">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>
                        <span>{s.sellerName} · {s.sellerPhone}</span>
                        {s.price ? <span className="font-medium text-slate-700">{s.currency} {s.price.toLocaleString()}</span> : <span className="text-amber-600">no price</span>}
                        <span className="text-slate-400">{relativeDate(s.createdAt)}</span>
                      </div>
                    </div>
                    {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
                  </div>
                </button>

                {/* Detail */}
                {open && (
                  <div className="border-t border-slate-100 p-4 sm:p-5 space-y-4 bg-slate-50/50">
                    {/* Contact the seller */}
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={`tel:${s.sellerPhone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                      <a href={`https://wa.me/${s.sellerPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      {s.sellerEmail && (
                        <a href={`mailto:${s.sellerEmail}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">
                          <Mail className="h-3.5 w-3.5" /> {s.sellerEmail}
                        </a>
                      )}
                      {s.preferredContact && <span className="text-xs text-slate-400">prefers {s.preferredContact}</span>}
                    </div>

                    {/* Specs */}
                    <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                      {s.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="h-4 w-4 text-slate-400" />{s.bedrooms} beds</span>}
                      {s.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath className="h-4 w-4 text-slate-400" />{s.bathrooms} baths</span>}
                      {s.areaSqm != null && <span className="inline-flex items-center gap-1"><Ruler className="h-4 w-4 text-slate-400" />{s.areaSqm} m²</span>}
                      {s.floor != null && <span>Floor {s.floor}</span>}
                      {s.negotiable && <span className="text-emerald-600">negotiable</span>}
                      {s.mohafazat && <span className="text-slate-400">{MOHAFAZAT_LABEL[s.mohafazat] ?? s.mohafazat}</span>}
                      {s.address && <span className="text-slate-400">{s.address}</span>}
                    </div>

                    {s.description && <p className="text-sm text-slate-600 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-3">{s.description}</p>}
                    {s.extraDetails && (
                      <div className="text-sm text-slate-600 whitespace-pre-wrap bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <span className="block text-xs font-semibold text-amber-700 mb-1">Extra details from the seller</span>
                        {s.extraDetails}
                      </div>
                    )}
                    {s.locationUrl && (
                      <a href={s.locationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-800">
                        <MapPin className="h-3.5 w-3.5" /> Open Google Maps location <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {/* Photos */}
                    {s.images.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {s.images.map((img, i) => (
                          <a key={i} href={normalizeFileUrl(img)} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={normalizeFileUrl(img)} alt="" className="w-full h-full object-cover rounded-lg border border-slate-200 hover:opacity-90" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Price + notes */}
                    {s.status !== 'APPROVED' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Agreed price ({s.currency})</label>
                          <input
                            type="number"
                            defaultValue={s.price ?? ''}
                            onChange={e => setPriceDraft(p => ({ ...p, [s.id]: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                            placeholder="Set after talking to the seller"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Internal notes</label>
                          <div className="flex gap-2">
                            <input
                              defaultValue={s.adminNotes ?? ''}
                              onChange={e => setNotesDraft(p => ({ ...p, [s.id]: e.target.value }))}
                              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                              placeholder="e.g., Called 12 Jul — confirming photos"
                            />
                            <button
                              type="button"
                              disabled={busy === s.id || notesDraft[s.id] === undefined}
                              onClick={() => patch(s.id, { adminNotes: notesDraft[s.id] ?? '', ...(priceDraft[s.id] !== undefined && priceDraft[s.id] !== '' ? { price: Number(priceDraft[s.id]) } : {}) })}
                              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                              title="Save price + notes"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {s.status === 'APPROVED' && s.buildingId ? (
                        <Link href={`/admin/buildings/${s.buildingId}`} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">
                          <Building2 className="h-4 w-4" /> Open published property
                        </Link>
                      ) : (
                        <>
                          {s.status !== 'IN_REVIEW' && (
                            <button type="button" disabled={busy === s.id} onClick={() => patch(s.id, { status: 'IN_REVIEW' })} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
                              <Eye className="h-4 w-4" /> Mark in review
                            </button>
                          )}
                          <button type="button" disabled={busy === s.id} onClick={() => approve(s)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                            {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve & publish
                          </button>
                          {s.status !== 'REJECTED' && (
                            <button type="button" disabled={busy === s.id} onClick={() => patch(s.id, { status: 'REJECTED' })} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                              <XCircle className="h-4 w-4" /> Reject
                            </button>
                          )}
                        </>
                      )}
                      <button type="button" disabled={busy === s.id} onClick={() => remove(s)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 text-sm disabled:opacity-50">
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
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
