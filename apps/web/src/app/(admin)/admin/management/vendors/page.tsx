'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Phone, Mail, Star, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api/client'
import type { Vendor } from '@/types'

const SPECIALTIES: Record<string, string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  PAINTING: 'Painting',
  CLEANING: 'Cleaning',
  SECURITY: 'Security',
  LANDSCAPING: 'Landscaping',
  GENERAL: 'General',
  OTHER: 'Other',
}

const EMPTY_FORM = {
  name: '', specialty: 'GENERAL', phone: '', email: '', notes: '',
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (specialtyFilter !== 'all') params.specialty = specialtyFilter
    apiClient.getVendors(params)
      .then((res: any) => { setVendors(res.data ?? []); setTotal(res.pagination?.total ?? 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [specialtyFilter])

  useEffect(() => { load() }, [load])

  const filtered = vendors.filter(v =>
    !search ||
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search)
  )

  async function handleCreate() {
    setSaving(true)
    try {
      await apiClient.createVendor(form as any)
      setShowNew(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to create vendor')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from vendor directory?`)) return
    try {
      await apiClient.deleteVendor(id)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed')
    }
  }

  function renderStars(rating: number | null | undefined) {
    if (!rating) return <span className="text-xs text-slate-400">No rating</span>
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={`h-3 w-3 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} contractors & service providers</p>
        </div>
        <Button className="bg-slate-800 hover:bg-slate-700" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Vendor
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search vendors..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Specialty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            {Object.entries(SPECIALTIES).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          No vendors found
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{v.name}</p>
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 mt-1">
                    {SPECIALTIES[v.specialty ?? 'GENERAL'] ?? v.specialty}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-3 space-y-1.5">
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {v.phone}
                  </a>
                )}
                {v.email && (
                  <a href={`mailto:${v.email}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {v.email}
                  </a>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                {renderStars(v.rating)}
                <button
                  onClick={() => handleDelete(v.id, v.name)}
                  className="text-xs text-red-400 hover:text-red-600">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Vendor Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Vendor</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="Company or person name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Specialty</Label>
              <Select value={form.specialty} onValueChange={v => setForm(f => ({ ...f, specialty: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SPECIALTIES).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+961 xx xxx xxx" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="vendor@example.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea placeholder="Any notes about this vendor..." rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name}>
              {saving ? 'Saving...' : 'Add Vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
