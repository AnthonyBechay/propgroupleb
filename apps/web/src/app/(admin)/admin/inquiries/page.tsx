'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import {
  MessageSquare,
  ExternalLink,
  Search,
  Trash2,
  Mail,
  Phone,
  User,
  Building2,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'

interface Inquiry {
  id: string
  name: string
  email: string
  phone: string | null
  message: string | null
  createdAt: string
  property: {
    id: string
    title: string
    country: string
    price?: number
    currency?: string
  }
  user?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

interface ApiResponse {
  success: boolean
  data: Inquiry[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function AdminInquiriesPage() {
  const { user } = useAuth()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchInquiries()
  }, [page])

  async function fetchInquiries() {
    try {
      setLoading(true)
      const response = await apiClient.getInquiries({ page, limit: 20 }) as ApiResponse
      setInquiries(response.data || [])
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages)
        setTotalCount(response.pagination.total)
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this inquiry?')) return
    setDeleting(id)
    try {
      await apiClient.deleteInquiry(id)
      setInquiries(prev => prev.filter(inq => inq.id !== id))
      setTotalCount(prev => prev - 1)
    } catch (error) {
      console.error('Failed to delete inquiry:', error)
      alert('Failed to delete inquiry')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = searchQuery
    ? inquiries.filter(inq => {
        const q = searchQuery.toLowerCase()
        return (
          inq.name.toLowerCase().includes(q) ||
          inq.email.toLowerCase().includes(q) ||
          (inq.message?.toLowerCase().includes(q) ?? false) ||
          inq.property.title.toLowerCase().includes(q)
        )
      })
    : inquiries

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return <div className="p-8 text-center text-stone-500">Access denied</div>
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-[#C97B4B] rounded-xl flex items-center justify-center shadow-md">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Inquiries
          </h1>
          <p className="text-stone-600 mt-1">
            {totalCount} total {totalCount === 1 ? 'inquiry' : 'inquiries'} from potential investors
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, property..."
          className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm bg-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B4965] mx-auto mb-2" />
          <p className="text-stone-500">Loading inquiries...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900 mb-1">No inquiries found</h3>
          <p className="text-stone-500">
            {inquiries.length === 0
              ? 'Inquiries from potential investors will appear here.'
              : 'Try adjusting your search.'}
          </p>
        </div>
      ) : (
        <>
          {/* Inquiry Cards */}
          <div className="space-y-3">
            {filtered.map(inq => {
              const isExpanded = expandedId === inq.id
              return (
                <div key={inq.id} className="bg-white rounded-xl border hover:shadow-md transition-all">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-[#1B4965] rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {inq.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-stone-900">{inq.name}</p>
                        {inq.user && (
                          <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                            Registered
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 truncate">{inq.email}</p>
                    </div>

                    {/* Property */}
                    <div className="hidden sm:block text-right flex-shrink-0 max-w-[200px]">
                      <p className="text-sm font-medium text-[#1B4965] truncate">{inq.property.title}</p>
                      <p className="text-xs text-stone-400 flex items-center justify-end gap-1">
                        <MapPin className="w-3 h-3" /> {inq.property.country}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="hidden md:block text-right flex-shrink-0">
                      <p className="text-xs text-stone-400">{timeAgo(inq.createdAt)}</p>
                    </div>

                    {/* Expand toggle */}
                    <div className="text-stone-400 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {/* Contact Info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Contact Details</h4>
                          <div className="flex items-center gap-2 text-sm text-stone-700">
                            <Mail className="w-4 h-4 text-stone-400" />
                            <a href={`mailto:${inq.email}`} className="text-[#1B4965] hover:underline">{inq.email}</a>
                          </div>
                          {inq.phone && (
                            <div className="flex items-center gap-2 text-sm text-stone-700">
                              <Phone className="w-4 h-4 text-stone-400" />
                              <a href={`tel:${inq.phone}`} className="text-[#1B4965] hover:underline">{inq.phone}</a>
                            </div>
                          )}
                          {inq.user && (
                            <div className="flex items-center gap-2 text-sm text-stone-700">
                              <User className="w-4 h-4 text-stone-400" />
                              <span>
                                {inq.user.firstName} {inq.user.lastName}
                                <span className="text-stone-400 ml-1">({inq.user.email})</span>
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-stone-500">
                            <Calendar className="w-4 h-4 text-stone-400" />
                            {new Date(inq.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Property Info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Property</h4>
                          <div className="flex items-center gap-2 text-sm text-stone-700">
                            <Building2 className="w-4 h-4 text-stone-400" />
                            <span className="font-medium">{inq.property.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-stone-500">
                            <MapPin className="w-4 h-4 text-stone-400" />
                            {inq.property.country}
                          </div>
                          {inq.property.price && (
                            <p className="text-sm text-stone-500">
                              Price: {inq.property.currency || '$'}{inq.property.price.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Message */}
                      {inq.message && (
                        <div className="mt-4">
                          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Message</h4>
                          <div className="bg-stone-50 rounded-lg p-3 text-sm text-stone-700 whitespace-pre-wrap">
                            {inq.message}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <a
                          href={`mailto:${inq.email}?subject=Re: ${encodeURIComponent(inq.property.title)} Inquiry`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1B4965] rounded-lg hover:bg-[#2B6985] transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Reply via Email
                        </a>
                        <a
                          href={`/property/${inq.property.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Property
                        </a>
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
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-stone-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-stone-600 px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-stone-50 transition-colors"
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
