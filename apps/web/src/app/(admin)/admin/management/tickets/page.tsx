'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, AlertTriangle, ChevronRight, User, Building2 } from 'lucide-react'
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
import { normalizeApiUrl } from '@/lib/utils/api-url'
import type { MaintenanceTicket } from '@/types'

interface Technician { id: string; name: string; title?: string | null }

const PRIORITY_COLORS: Record<string, string> = {
  EMERGENCY: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-slate-100 text-slate-500',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  PENDING_PARTS: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  APPLIANCES: 'Appliances',
  CLEANING: 'Cleaning',
  SECURITY: 'Security',
  INTERNET: 'Internet',
  OTHER: 'Other',
}

const EMPTY_FORM = {
  unitId: '', scope: 'UNIT', category: 'OTHER', priority: 'NORMAL',
  title: '', description: '', reportedBy: '',
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])

  // Load the caller's org technicians for the assignment dropdown.
  useEffect(() => {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    ;(async () => {
      try {
        const mineRes = await fetch(`${apiUrl}/api/organizations/mine`, { credentials: 'include' })
        if (!mineRes.ok) return
        const mine = await mineRes.json()
        const memberships = mine.data ?? mine ?? []
        const orgId = memberships[0]?.organizationId || memberships[0]?.organization?.id
        if (!orgId) return
        const orgRes = await fetch(`${apiUrl}/api/organizations/${orgId}`, { credentials: 'include' })
        if (!orgRes.ok) return
        const org = await orgRes.json()
        const members = (org.data ?? org).members ?? []
        setTechnicians(
          members
            .filter((m: any) => m.role === 'TECHNICIAN' && m.isActive)
            .map((m: any) => ({
              id: m.user.id,
              name: m.user.firstName || m.user.lastName ? `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() : m.user.email,
              title: m.title,
            }))
        )
      } catch { /* no org / not a PM — leave empty */ }
    })()
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (statusFilter !== 'all') params.status = statusFilter
    if (priorityFilter !== 'all') params.priority = priorityFilter
    apiClient.getTickets(params)
      .then((res: any) => { setTickets(res.data ?? []); setTotal(res.pagination?.total ?? 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [statusFilter, priorityFilter])

  useEffect(() => { load() }, [load])

  const filtered = tickets.filter(t =>
    !search ||
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    (t as any).unit?.building?.title?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate() {
    setSaving(true)
    try {
      await apiClient.createTicket(form as any)
      setShowNew(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to create ticket')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await apiClient.updateTicket(id, { status } as any)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed')
    }
  }

  async function handleAssign(id: string, userId: string) {
    try {
      await apiClient.updateTicket(id, { assignedToUserId: userId === 'unassigned' ? null : userId } as any)
      load()
    } catch (e: any) {
      alert(e.message || 'Failed to assign')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Tickets</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} total</p>
        </div>
        <Button className="bg-slate-800 hover:bg-slate-700" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search tickets..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="EMERGENCY">Emergency</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="PENDING_PARTS">Pending Parts</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No tickets found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Unit / Building</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                {technicians.length > 0 && (
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Technician</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-slate-600">Reported</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => {
                const unit = (t as any).unit
                const building = unit?.building
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {t.priority === 'EMERGENCY' && (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-900">{t.title}</span>
                      </div>
                      {t.reportedBy && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                          <User className="h-3 w-3" />{t.reportedBy}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{unit?.unitNumber ? `#${unit.unitNumber}` : unit?.kind ?? '—'}</span>
                      </div>
                      <div className="text-xs text-slate-400">{building?.title ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={t.status} onValueChange={v => handleStatusChange(t.id, v)}>
                        <SelectTrigger className={`h-7 w-[130px] text-xs border-0 shadow-none px-2 rounded font-medium ${STATUS_COLORS[t.status] ?? ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="PENDING_PARTS">Pending Parts</SelectItem>
                          <SelectItem value="RESOLVED">Resolved</SelectItem>
                          <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    {technicians.length > 0 && (
                      <td className="px-4 py-3">
                        <Select value={(t as any).assignedToUserId ?? 'unassigned'} onValueChange={v => handleAssign(t.id, v)}>
                          <SelectTrigger className="h-7 w-[150px] text-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {technicians.map(tech => (
                              <SelectItem key={tech.id} value={tech.id}>
                                {tech.name}{tech.title ? ` · ${tech.title}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
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

      {/* New Ticket Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Maintenance Ticket</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Unit ID</Label>
              <Input placeholder="Unit ID" value={form.unitId}
                onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Title *</Label>
              <Input placeholder="Brief description of the issue" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIT">Unit</SelectItem>
                  <SelectItem value="BUILDING">Building</SelectItem>
                  <SelectItem value="COMMON_AREA">Common Area</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reported By</Label>
              <Input placeholder="Tenant name" value={form.reportedBy}
                onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Detailed description..." rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.title}>
              {saving ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
