'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Zap, Gauge, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api/client'
import type { UtilityBill, UtilityMeter } from '@/types'

const UTILITY_LABELS: Record<string, string> = {
  ELECTRICITY_EDL: 'EDL',
  ELECTRICITY_GENERATOR: 'Generator',
  WATER: 'Water',
  INTERNET: 'Internet',
  GAS: 'Gas',
}

const UTILITY_COLORS: Record<string, string> = {
  ELECTRICITY_EDL: 'bg-yellow-100 text-yellow-700',
  ELECTRICITY_GENERATOR: 'bg-orange-100 text-orange-700',
  WATER: 'bg-blue-100 text-blue-700',
  INTERNET: 'bg-purple-100 text-purple-700',
  GAS: 'bg-slate-100 text-slate-600',
}

const BILL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ALLOCATED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-red-100 text-red-700',
}

function formatCurrency(amount: number | string, currency: string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (currency === 'LBP') return `${(n / 1_000_000).toFixed(1)}M LBP`
  return `$${n.toLocaleString()} USD`
}

const EMPTY_BILL_FORM = {
  buildingId: '', utilityKind: 'ELECTRICITY_EDL', periodStart: '', periodEnd: '',
  totalAmount: '', currency: 'USD', invoiceRef: '', allocationMethod: 'METERED',
}

const EMPTY_METER_FORM = {
  unitId: '', buildingId: '', kind: 'ELECTRICITY_EDL', meterNumber: '', unit: 'kWh',
}

export default function UtilitiesPage() {
  const [tab, setTab] = useState<'bills' | 'meters'>('bills')
  const [bills, setBills] = useState<UtilityBill[]>([])
  const [meters, setMeters] = useState<UtilityMeter[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNewBill, setShowNewBill] = useState(false)
  const [showNewMeter, setShowNewMeter] = useState(false)
  const [billForm, setBillForm] = useState(EMPTY_BILL_FORM)
  const [meterForm, setMeterForm] = useState(EMPTY_METER_FORM)
  const [saving, setSaving] = useState(false)
  const [allocating, setAllocating] = useState<string | null>(null)

  const loadBills = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (statusFilter !== 'all') params.status = statusFilter
    apiClient.getBills(params)
      .then((res: any) => setBills(res.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [statusFilter])

  const loadMeters = useCallback(() => {
    setLoading(true)
    apiClient.getMeters({})
      .then((res: any) => setMeters(res.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'bills') loadBills()
    else loadMeters()
  }, [tab, loadBills, loadMeters])

  async function handleCreateBill() {
    setSaving(true)
    try {
      await apiClient.createBill({
        ...billForm,
        totalAmount: parseFloat(billForm.totalAmount) || 0,
      } as any)
      setShowNewBill(false)
      setBillForm(EMPTY_BILL_FORM)
      loadBills()
    } catch (e: any) {
      alert(e.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAllocate(billId: string, method: string) {
    setAllocating(billId)
    try {
      await apiClient.allocateBill(billId, method)
      loadBills()
    } catch (e: any) {
      alert(e.message || 'Failed to allocate')
    } finally {
      setAllocating(null)
    }
  }

  async function handleCreateMeter() {
    setSaving(true)
    try {
      await apiClient.createMeter(meterForm as any)
      setShowNewMeter(false)
      setMeterForm(EMPTY_METER_FORM)
      loadMeters()
    } catch (e: any) {
      alert(e.message || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utilities</h1>
          <p className="text-slate-500 text-sm mt-0.5">Bills and meters management</p>
        </div>
        <Button className="bg-slate-800 hover:bg-slate-700"
          onClick={() => tab === 'bills' ? setShowNewBill(true) : setShowNewMeter(true)}>
          <Plus className="h-4 w-4 mr-2" /> {tab === 'bills' ? 'New Bill' : 'New Meter'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['bills', 'meters'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'bills' ? 'Utility Bills' : 'Meters'}
          </button>
        ))}
      </div>

      {tab === 'bills' && (
        <>
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending Allocation</SelectItem>
                <SelectItem value="ALLOCATED">Allocated</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="DISPUTED">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-slate-400">Loading...</div>
            ) : bills.length === 0 ? (
              <div className="py-16 text-center text-slate-400">No bills found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Building</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Period</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Method</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.map(b => {
                    const building = (b as any).building
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {building?.title ?? b.buildingId}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${UTILITY_COLORS[b.utilityKind ?? b.kind] ?? ''}`}>
                            <Zap className="h-3 w-3" />
                            {UTILITY_LABELS[b.utilityKind ?? b.kind] ?? (b.utilityKind ?? b.kind)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {b.periodStart ? new Date(b.periodStart).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {formatCurrency(b.totalAmount as any, b.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {b.allocationMethod?.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${BILL_STATUS_COLORS[b.status] ?? ''}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {b.status === 'RECORDED' && (
                              <Button variant="outline" size="sm" className="h-7 text-xs"
                                disabled={allocating === b.id}
                                onClick={() => handleAllocate(b.id, b.allocationMethod ?? 'EQUAL_SHARE')}>
                                {allocating === b.id
                                  ? <RefreshCw className="h-3 w-3 animate-spin" />
                                  : 'Allocate'}
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
        </>
      )}

      {tab === 'meters' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading...</div>
          ) : meters.length === 0 ? (
            <div className="py-16 text-center text-slate-400">No meters registered</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Meter #</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Unit</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Last Reading</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meters.map(m => {
                  const readings = (m as any).readings ?? []
                  const latest = readings[0]
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {m.meterNumber ?? m.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${UTILITY_COLORS[m.kind] ?? ''}`}>
                          <Gauge className="h-3 w-3" />
                          {UTILITY_LABELS[m.kind] ?? m.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {(m as any).unit?.unitNumber ? `#${(m as any).unit.unitNumber}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {latest
                          ? `${latest.reading} ${m.unit ?? 'kWh'} · ${new Date(latest.readingDate).toLocaleDateString()}`
                          : 'No readings'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
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
      )}

      {/* New Bill Dialog */}
      <Dialog open={showNewBill} onOpenChange={setShowNewBill}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Utility Bill</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Building ID *</Label>
              <Input placeholder="Building ID" value={billForm.buildingId}
                onChange={e => setBillForm(f => ({ ...f, buildingId: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Utility Type</Label>
              <Select value={billForm.utilityKind} onValueChange={v => setBillForm(f => ({ ...f, utilityKind: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(UTILITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Allocation Method</Label>
              <Select value={billForm.allocationMethod} onValueChange={v => setBillForm(f => ({ ...f, allocationMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="METERED">Metered</SelectItem>
                  <SelectItem value="AREA_PROPORTIONAL">Area Proportional</SelectItem>
                  <SelectItem value="FIXED_SHARE">Fixed Share</SelectItem>
                  <SelectItem value="OCCUPANT_COUNT">Occupant Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Period Start *</Label>
              <Input type="date" value={billForm.periodStart}
                onChange={e => setBillForm(f => ({ ...f, periodStart: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Period End *</Label>
              <Input type="date" value={billForm.periodEnd}
                onChange={e => setBillForm(f => ({ ...f, periodEnd: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total Amount *</Label>
              <Input type="number" placeholder="0" value={billForm.totalAmount}
                onChange={e => setBillForm(f => ({ ...f, totalAmount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={billForm.currency} onValueChange={v => setBillForm(f => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="LBP">LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Invoice Ref</Label>
              <Input placeholder="Optional invoice reference" value={billForm.invoiceRef}
                onChange={e => setBillForm(f => ({ ...f, invoiceRef: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBill(false)}>Cancel</Button>
            <Button onClick={handleCreateBill}
              disabled={saving || !billForm.buildingId || !billForm.periodStart || !billForm.periodEnd || !billForm.totalAmount}>
              {saving ? 'Creating...' : 'Create Bill'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Meter Dialog */}
      <Dialog open={showNewMeter} onOpenChange={setShowNewMeter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Meter</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Unit ID (or leave blank for building-level)</Label>
              <Input placeholder="Unit ID" value={meterForm.unitId}
                onChange={e => setMeterForm(f => ({ ...f, unitId: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Building ID</Label>
              <Input placeholder="Building ID" value={meterForm.buildingId}
                onChange={e => setMeterForm(f => ({ ...f, buildingId: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Utility Type</Label>
              <Select value={meterForm.kind} onValueChange={v => setMeterForm(f => ({ ...f, kind: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(UTILITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit of Measure</Label>
              <Input placeholder="kWh, m³..." value={meterForm.unit}
                onChange={e => setMeterForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Meter Number</Label>
              <Input placeholder="Official meter identifier" value={meterForm.meterNumber}
                onChange={e => setMeterForm(f => ({ ...f, meterNumber: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMeter(false)}>Cancel</Button>
            <Button onClick={handleCreateMeter} disabled={saving}>
              {saving ? 'Saving...' : 'Register Meter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
