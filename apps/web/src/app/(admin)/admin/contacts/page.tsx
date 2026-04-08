'use client'

import { useEffect, useState } from 'react'
import {
  Mail,
  Phone,
  User,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  Check,
  Inbox,
} from 'lucide-react'

interface ContactMessage {
  id: string
  name: string
  email: string
  phone: string | null
  subject: string | null
  message: string
  isRead: boolean
  createdAt: string
}

interface ApiResponse {
  success: boolean
  data: ContactMessage[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function AdminContactsPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchMessages()
  }, [page])

  async function fetchMessages() {
    try {
      setLoading(true)
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/contact?page=${page}&limit=20`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data: ApiResponse = await response.json()
        setMessages(data.data || [])
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages)
          setTotalCount(data.pagination.total)
        }
      }
    } catch (error) {
      console.error('Failed to fetch contact messages:', error)
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: string) {
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      await fetch(`${apiUrl}/api/contact/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      })
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isRead: true } : m))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact message?')) return
    setDeleting(id)
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/contact/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        setMessages(prev => prev.filter(m => m.id !== id))
        setTotalCount(prev => prev - 1)
      } else {
        alert('Failed to delete message')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to delete message')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = searchQuery
    ? messages.filter(m => {
        const q = searchQuery.toLowerCase()
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q) ||
          (m.subject?.toLowerCase().includes(q) ?? false)
        )
      })
    : messages

  const unreadCount = messages.filter(m => !m.isRead).length

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
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-[#1B3A5C] rounded-xl flex items-center justify-center shadow-md">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            Contact Messages
          </h1>
          <p className="text-slate-600 mt-1">
            {totalCount} total message{totalCount !== 1 ? 's' : ''}
            {unreadCount > 0 && (
              <span className="ml-2 text-[#C49A2E] font-medium">({unreadCount} unread)</span>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search messages..."
          className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm bg-white"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B3A5C] mx-auto mb-2" />
          <p className="text-slate-500">Loading messages...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No messages</h3>
          <p className="text-slate-500">
            {messages.length === 0
              ? 'Messages from the Contact Us form will appear here.'
              : 'No messages match your search.'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map(msg => {
              const isExpanded = expandedId === msg.id
              return (
                <div
                  key={msg.id}
                  className={`bg-white rounded-xl border transition-all hover:shadow-md ${
                    !msg.isRead ? 'border-l-4 border-l-[#C49A2E]' : ''
                  }`}
                >
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : msg.id)
                      if (!msg.isRead) markAsRead(msg.id)
                    }}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                      msg.isRead ? 'bg-slate-400' : 'bg-[#C49A2E]'
                    }`}>
                      {msg.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold text-slate-900 ${!msg.isRead ? 'font-bold' : ''}`}>
                          {msg.name}
                        </p>
                        {!msg.isRead && (
                          <span className="w-2 h-2 bg-[#C49A2E] rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {msg.subject ? `${msg.subject} — ` : ''}{msg.message}
                      </p>
                    </div>

                    {/* Time */}
                    <div className="hidden md:block text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">{timeAgo(msg.createdAt)}</p>
                    </div>

                    <div className="text-slate-400 flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {/* Contact Info */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contact Details</h4>
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{msg.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <a href={`mailto:${msg.email}`} className="text-[#1B3A5C] hover:underline">{msg.email}</a>
                          </div>
                          {msg.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <a href={`tel:${msg.phone}`} className="text-[#1B3A5C] hover:underline">{msg.phone}</a>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {new Date(msg.createdAt).toLocaleString()}
                          </div>
                        </div>

                        {/* Subject */}
                        {msg.subject && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</h4>
                            <p className="text-sm text-slate-700 font-medium">{msg.subject}</p>
                          </div>
                        )}
                      </div>

                      {/* Message */}
                      <div className="mt-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message</h4>
                        <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                          {msg.message}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                        <a
                          href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || 'Your inquiry to PropGroup')}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#1B3A5C] rounded-lg hover:bg-[#24507D] transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Reply via Email
                        </a>
                        {!msg.isRead && (
                          <button
                            onClick={() => markAsRead(msg.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Mark as Read
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(msg.id)}
                          disabled={deleting === msg.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors ml-auto disabled:opacity-50"
                        >
                          {deleting === msg.id ? (
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
