'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { MessageSquare, ExternalLink, Search } from 'lucide-react'
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
  }
  user?: {
    id: string
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
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchInquiries()
  }, [page])

  async function fetchInquiries() {
    try {
      const response = await apiClient.getInquiries({ page, limit: 20 }) as ApiResponse
      setInquiries(response.data || [])
      if (response.pagination) {
        setTotalPages(response.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error)
    } finally {
      setLoading(false)
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
    return <div className="p-8 text-center text-gray-500">Access denied</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
        <p className="text-gray-500 mt-1">Manage property inquiries from users</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search inquiries..."
          className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No inquiries found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Message</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(inq => (
                  <tr key={inq.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{inq.name}</div>
                      <div className="text-gray-500 text-xs">{inq.email}</div>
                      {inq.phone && <div className="text-gray-500 text-xs">{inq.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{inq.property.title}</div>
                      <div className="text-gray-500 text-xs">{inq.property.country}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-gray-600 truncate">{inq.message || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(inq.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/properties?id=${inq.property.id}`}
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Property
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
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
