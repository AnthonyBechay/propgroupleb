'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, RefreshCw, ChevronRight } from 'lucide-react'
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
import type { ServiceCharge } from '@/types'

const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  ONE_TIME: 'One-time',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

function formatCurrency(amount: number | string, currency: string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (currency === 'LBP') return `${(n / 1_000_000).toFixed(1)}M LBP`
  return `$${n.toLocaleString()} USD`
}

const EMPTY_FORM = {
  buildingId: '', name: '', description: '',
  amount: '', currency: 'USD', cadence: 'MONTHLY',
  nextDueDate: '',
}

export default function ServiceChargesPage() {
  const [charges, setCharges] = useState<ServiceCharge[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (statusFilter !== 'all') params.status = statusFilter
    apiClient.getServiceCharges(params)
      .then((res: any) => { setCharges(res.data ?? []); setTotal(res.pagination?.total ?? 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const filtered = charges.filter(c =>
    !search ||
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    (c as any).building?.title?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    setSaving(true)
    try {
      await apiClient.createServiceCharge({
        ...form,
        amount: parseFloat(form.amount) || 0,
      } as any)
      setShowNew(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to create service charge')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerate(id: string, name: string, nextDue: string | null | undefined) {
    const defaultDate = nextDue
      ? nextDue.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const dueDate = window.prompt(`Generate expense shares for "${name}".\nDue date (YYYY-MM-DD):`, defaultDate)
    if (!dueDate) return
    setGenerating(id)
    try {
      await apiClient.generateServiceChargeShares(id, dueDate)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Charges</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} recurring charges</p>
        </div>
        <Button className="bg-slate-800 hover:bg-slate-700" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Charge
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search charges..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No service charges found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Building</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Cadence</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Next Due</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => {
                const building = (c as any).building
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      {c.description && (
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{c.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {building?.title ?? c.buildingId}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatCurrency(c.amount as any, c.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {CADENCE_LABELS[c.cadence] ?? c.cadence}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.nextDueDate
                        ? new Date(c.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[c.status ?? ''] ?? ''}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === 'ACTIVE' && (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            disabled={generating === c.id}
                            onClick={() => handleGenerate(c.id, c.name, c.nextDueDate as any)}>
                            {generating === c.id
                              ? <RefreshCw className="h-3 w-3 animate-spin" />
                              : 'Generate'}
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

      {/* New Service Charge Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Service Charge</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Building ID *</Label>
              <Input placeholder="Building ID" value={form.buildingId}
                onChange={e => setForm(f => ({ ...f, buildingId: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. Generator maintenance, Cleaning fee" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input type="number" placeholder="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="LBP">LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cadence</Label>
              <Select value={form.cadence} onValueChange={v => setForm(f => ({ ...f, cadence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                  <SelectItem value="ONE_TIME">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Next Due Date</Label>
              <Input type="date" value={form.nextDueDate}
                onChange={e => setForm(f => ({ ...f, nextDueDate: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional notes..." rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate}
              disabled={saving || !form.buildingId || !form.name || !form.amount}>
              {saving ? 'Creating...' : 'Create Charge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
