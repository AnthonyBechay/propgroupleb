'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import {
  MessageSquare,
  ExternalLink,
  Search,
  Trash2,
  CheckSquare,
  Square,
  Mail,
  Phone,
  User,
  Building2,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Archive,
  StickyNote,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

const STATUSES = [
  { value: 'ALL', label: 'All', icon: MessageSquare, color: 'text-slate-600', bg: 'bg-slate-100' },
  { value: 'NEW', label: 'New', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: Loader2, color: 'text-amber-600', bg: 'bg-amber-100' },
  { value: 'REPLIED', label: 'Replied', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { value: 'CANCELLED', label: 'Cancelled', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'CLOSED', label: 'Closed', icon: Archive, color: 'text-slate-500', bg: 'bg-slate-200' },
] as const

interface Inquiry {
  id: string
  name: string
  email: string
  phone: string | null
  message: string | null
  status: string
  adminNotes: string | null
  repliedAt: string | null
  repliedBy: string | null
  buildingTitle: string | null
  createdAt: string
  updatedAt: string
  building: {
    id: string
    title: string
    city?: string | null
  } | null
  user?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

export default function AdminInquiriesPage() {
  const { user } = useAuth()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesText, setNotesText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  useEffect(() => {
    fetchInquiries()
  }, [page, statusFilter])

  async function fetchInquiries() {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)

      const res = await fetch(`${API_BASE_URL}/api/inquiries?${params}`, { credentials: 'include' })
      const json = await res.json()
      setInquiries(json.data || [])
      if (json.pagination) {
        setTotalPages(json.pagination.totalPages)
        setTotalCount(json.pagination.total)
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdatingId(id)
    try {
      const res = await fetch(`${API_BASE_URL}/api/inquiries/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const json = await res.json()
        setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, ...json.data } : inq))
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleSaveNotes(id: string) {
    setUpdatingId(id)
    try {
      const res = await fetch(`${API_BASE_URL}/api/inquiries/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: notesText }),
      })
      if (res.ok) {
        const json = await res.json()
        setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, ...json.data } : inq))
        setEditingNotesId(null)
      }
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this inquiry?')) return
    setDeleting(id)
    try {
      await fetch(`${API_BASE_URL}/api/inquiries/${id}`, { method: 'DELETE', credentials: 'include' })
      setInquiries(prev => prev.filter(inq => inq.id !== id))
      setTotalCount(prev => prev - 1)
    } catch (error) {
      console.error('Failed to delete inquiry:', error)
      alert('Failed to delete inquiry')
    } finally {
      setDeleting(null)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected ${selectedIds.size === 1 ? 'inquiry' : 'inquiries'}? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/inquiries/bulk-delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (res.ok) {
        setInquiries(prev => prev.filter(inq => !selectedIds.has(inq.id)))
        setTotalCount(prev => prev - selectedIds.size)
        setSelectedIds(new Set())
      } else {
        alert('Failed to delete inquiries')
      }
    } catch (error) {
      console.error('Bulk delete failed:', error)
      alert('Failed to delete inquiries')
    } finally {
      setBulkDeleting(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(inq => inq.id)))
    }
  }

  const getPropertyName = (inq: Inquiry) => inq.building?.title || inq.buildingTitle || 'General Inquiry'

  const filtered = searchQuery
    ? inquiries.filter(inq => {
        const q = searchQuery.toLowerCase()
        return (
          inq.name.toLowerCase().includes(q) ||
          inq.email.toLowerCase().includes(q) ||
          (inq.message?.toLowerCase().includes(q) ?? false) ||
          getPropertyName(inq).toLowerCase().includes(q)
        )
      })
    : inquiries

  const getStatusConfig = (status: string) =>
    STATUSES.find(s => s.value === status) || STATUSES[1]

  function timeAgo(dateStr: string) {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return <div className="p-8 text-center text-slate-500">Access denied</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-[rgb(161 98 7)] rounded-xl flex items-center justify-center shadow-md">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Inquiries
          </h1>
          <p className="text-slate-600 mt-1">
            {totalCount} total {totalCount === 1 ? 'inquiry' : 'inquiries'} from potential investors
          </p>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-red-700">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {bulkDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Status Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status filter tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {STATUSES.map(s => {
            const Icon = s.icon
            const isActive = statusFilter === s.value
            return (
              <button
                key={s.value}
                onClick={() => { setStatusFilter(s.value); setPage(1) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? s.color : ''}`} />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, property..."
            className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[rgb(30 41 59)] mx-auto mb-2" />
          <p className="text-slate-500">Loading inquiries...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No inquiries found</h3>
          <p className="text-slate-500">
            {inquiries.length === 0
              ? 'Inquiries from potential investors will appear here.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <>
          {/* Select all */}
          <div className="flex items-center gap-2 px-1">
            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600 transition-colors">
              {selectedIds.size === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-[rgb(30 41 59)]" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-xs text-slate-500">Select all</span>
          </div>

          {/* Inquiry Cards */}
          <div className="space-y-3">
            {filtered.map(inq => {
              const isExpanded = expandedId === inq.id
              const statusCfg = getStatusConfig(inq.status)
              const StatusIcon = statusCfg.icon
              return (
                <div key={inq.id} className="bg-white rounded-xl border hover:shadow-md transition-all">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(inq.id) }}
                      className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                    >
                      {selectedIds.has(inq.id) ? (
                        <CheckSquare className="w-5 h-5 text-[rgb(30 41 59)]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    {/* Avatar */}
                    <div className="w-10 h-10 bg-[rgb(30 41 59)] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {inq.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{inq.name}</p>
                        {inq.user && (
                          <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                            Registered
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{inq.email}</p>
                    </div>

                    {/* Status badge */}
                    <div className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </div>

                    {/* Building */}
                    <div className="hidden md:block text-right flex-shrink-0 max-w-[180px]">
                      <p className={`text-sm font-medium truncate ${inq.building ? 'text-[rgb(30 41 59)]' : 'text-slate-400 italic'}`}>
                        {getPropertyName(inq)}
                      </p>
                      {inq.building?.city ? (
                        <p className="text-xs text-slate-400 flex items-center justify-end gap-1">
                          <MapPin className="w-3 h-3" /> {inq.building.city}
                        </p>
                      ) : !inq.building && !inq.buildingTitle ? (
                        <p className="text-xs text-slate-400">General inquiry</p>
                      ) : null}
                    </div>

                    {/* Time */}
                    <div className="hidden lg:block text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">{timeAgo(inq.createdAt)}</p>
                    </div>

                    {/* Expand toggle */}
                    <div className="text-slate-400 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {/* Contact Info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Details</h4>
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <a href={`mailto:${inq.email}`} className="text-[rgb(30 41 59)] hover:underline">{inq.email}</a>
                          </div>
                          {inq.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <a href={`tel:${inq.phone}`} className="text-[rgb(30 41 59)] hover:underline">{inq.phone}</a>
                            </div>
                          )}
                          {inq.user && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <User className="w-4 h-4 text-slate-400" />
                              <span>
                                {inq.user.firstName} {inq.user.lastName}
                                <span className="text-slate-400 ml-1">({inq.user.email})</span>
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {new Date(inq.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Building Info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Building</h4>
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            <span className={`font-medium ${!inq.building && !inq.buildingTitle ? 'text-slate-400 italic' : ''}`}>
                              {getPropertyName(inq)}
                            </span>
                            {!inq.building && inq.buildingTitle && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-medium">Deleted</span>
                            )}
                          </div>
                          {inq.building?.city && (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              {inq.building.city}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Message */}
                      {inq.message && (
                        <div className="mt-4">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message</h4>
                          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap">
                            {inq.message}
                          </div>
                        </div>
                      )}

                      {/* Status Changer */}
                      <div className="mt-4 pt-3 border-t">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Update Status</h4>
                        <div className="flex flex-wrap gap-2">
                          {STATUSES.filter(s => s.value !== 'ALL').map(s => {
                            const Icon = s.icon
                            const isActive = inq.status === s.value
                            return (
                              <button
                                key={s.value}
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(inq.id, s.value) }}
                                disabled={isActive || updatingId === inq.id}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                  isActive
                                    ? `${s.bg} ${s.color} border-current`
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                                } disabled:opacity-60`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {s.label}
                              </button>
                            )
                          })}
                        </div>
                        {inq.repliedAt && (
                          <p className="text-xs text-slate-400 mt-2">
                            Replied {new Date(inq.repliedAt).toLocaleString()}
                            {inq.repliedBy && ` by ${inq.repliedBy}`}
                          </p>
                        )}
                      </div>

                      {/* Admin Notes */}
                      <div className="mt-4 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <StickyNote className="w-3.5 h-3.5" /> Admin Notes
                          </h4>
                          {editingNotesId !== inq.id && (
                            <button
                              onClick={() => { setEditingNotesId(inq.id); setNotesText(inq.adminNotes || '') }}
                              className="text-xs text-[rgb(30 41 59)] hover:underline"
                            >
                              {inq.adminNotes ? 'Edit' : 'Add note'}
                            </button>
                          )}
                        </div>
                        {editingNotesId === inq.id ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full border rounded-lg p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[rgb(30 41 59)]/20"
                              rows={3}
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              placeholder="Add internal notes about this inquiry..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveNotes(inq.id)}
                                disabled={updatingId === inq.id}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-[rgb(30 41 59)] rounded-lg hover:bg-[rgb(51 65 85)] disabled:opacity-50"
                              >
                                {updatingId === inq.id ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : inq.adminNotes ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-sm text-slate-700 whitespace-pre-wrap">
                            {inq.adminNotes}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No notes yet</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <a
                          href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(getPropertyName(inq))} Inquiry`}
                          onClick={() => {
                            // Auto-mark as replied when clicking Reply
                            if (inq.status === 'NEW' || inq.status === 'IN_PROGRESS') {
                              handleStatusChange(inq.id, 'REPLIED')
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[rgb(30 41 59)] rounded-lg hover:bg-[rgb(51 65 85)] transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Reply via Email
                        </a>
                        {inq.building && (
                          <a
                            href={`/admin/buildings/${inq.building.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Building
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(inq.id)}
                          disabled={deleting === inq.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto disabled:opacity-50"
                        >
                          {deleting === inq.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600 px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
