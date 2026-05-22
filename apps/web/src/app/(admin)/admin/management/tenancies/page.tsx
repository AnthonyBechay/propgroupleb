'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Phone, MessageCircle, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api/client'
import type { Tenancy } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  NOTICE_PERIOD: 'bg-amber-100 text-amber-700',
  ENDED: 'bg-slate-100 text-slate-500',
  EVICTED: 'bg-red-100 text-red-700',
}

const PERIOD_LABELS: Record<string, string> = {
  MONTHLY: '/mo', QUARTERLY: '/qtr', YEARLY: '/yr',
}

function formatCurrency(amount: number | string, currency: string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (currency === 'LBP') return `${(n / 1_000_000).toFixed(1)}M LBP`
  return `$${n.toLocaleString()} USD`
}

const EMPTY_FORM = {
  unitId: '', tenantName: '', tenantPhone: '', tenantEmail: '', tenantWhatsapp: '',
  startDate: '', endDate: '', rentAmount: '', rentCurrency: 'USD', rentPeriod: 'MONTHLY',
  depositAmount: '', notes: '',
}

export default function TenanciesPage() {
  const [tenancies, setTenancies] = useState<Tenancy[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (statusFilter !== 'all') params.status = statusFilter
    apiClient.getTenancies(params)
      .then((res: any) => { setTenancies(res.data ?? []); setTotal(res.pagination?.total ?? 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = tenancies.filter(t =>
    !search ||
    t.tenantName?.toLowerCase().includes(search.toLowerCase()) ||
    (t.unit as any)?.building?.title?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    setSaving(true)
    try {
      await apiClient.createTenancy({
        ...form,
        rentAmount: parseFloat(form.rentAmount) || 0,
        depositAmount: form.depositAmount ? parseFloat(form.depositAmount) : undefined,
      } as any)
      setShowNew(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to create tenancy')
    } finally {
      setSaving(false)
    }
  }

  async function handleEnd(id: string, tenantName: string) {
    if (!confirm(`End tenancy for ${tenantName}?`)) return
    try {
      await apiClient.endTenancy(id)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenancies</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} records</p>
        </div>
        <Button className="bg-slate-800 hover:bg-slate-700" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Tenancy
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search tenant or building..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="NOTICE_PERIOD">Notice Period</SelectItem>
            <SelectItem value="ENDED">Ended</SelectItem>
            <SelectItem value="EVICTED">Evicted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No tenancies found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unit / Building</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rent</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Period</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => {
                const unit = t.unit as any
                const building = unit?.building
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {unit?.unitNumber ? `#${unit.unitNumber}` : unit?.kind ?? 'Unit'}
                      </div>
                      <div className="text-xs text-slate-400">{building?.title ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.tenantName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.tenantPhone && (
                          <a href={`tel:${t.tenantPhone}`} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" />{t.tenantPhone}
                          </a>
                        )}
                        {t.tenantWhatsapp && (
                          <a href={`https://wa.me/${t.tenantWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />WA
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatCurrency(t.rentAmount as any, t.rentCurrency)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {PERIOD_LABELS[t.rentPeriod] ?? t.rentPeriod}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status] ?? ''}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {t.status === 'ACTIVE' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => handleEnd(t.id, t.tenantName)}>
                            End
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* New Tenancy Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Tenancy</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Unit ID</Label>
              <Input placeholder="Unit ID" value={form.unitId}
                onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Tenant Name *</Label>
              <Input placeholder="Full name" value={form.tenantName}
                onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+961 xx xxx xxx" value={form.tenantPhone}
                onChange={e => setForm(f => ({ ...f, tenantPhone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input placeholder="+961 xx xxx xxx" value={form.tenantWhatsapp}
                onChange={e => setForm(f => ({ ...f, tenantWhatsapp: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rent Amount *</Label>
              <Input type="number" placeholder="0" value={form.rentAmount}
                onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.rentCurrency} onValueChange={v => setForm(f => ({ ...f, rentCurrency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="LBP">LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period</Label>
              <Select value={form.rentPeriod} onValueChange={v => setForm(f => ({ ...f, rentPeriod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deposit</Label>
              <Input type="number" placeholder="0" value={form.depositAmount}
                onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.unitId || !form.tenantName || !form.startDate || !form.rentAmount}>
              {saving ? 'Creating...' : 'Create Tenancy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
