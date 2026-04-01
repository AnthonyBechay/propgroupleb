'use client'

import { useState } from 'react'
import { Property } from '@/lib/types/api'
import { EditPropertyModal } from './EditPropertyModal'
import {
  Edit,
  Trash2,
  Eye,
  Heart,
  MessageSquare,
  MapPin,
  Building2,
  TrendingUp,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
  Share2,
  Check,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

type PropertyTableProps = {
  properties: Property[]
}

export function PropertyTable({ properties }: PropertyTableProps) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyToClipboard = async (text: string) => {
    // Try modern API first, fall back to execCommand
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    }
  }

  const handleShare = async (property: Property) => {
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const res = await fetch(`${apiUrl}/api/properties/${property.id}/share`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || `Server error ${res.status}`)
      }
      const json = await res.json()
      const shareUrl = `${window.location.origin}/share/${json.data.shareToken}`
      const copied = await copyToClipboard(shareUrl)
      if (copied) {
        setCopiedId(property.id)
        setTimeout(() => setCopiedId(null), 2000)
      } else {
        // If clipboard fails entirely, show the URL in a prompt
        window.prompt('Share link (copy it):', shareUrl)
      }
    } catch (error) {
      console.error('Failed to share:', error)
      alert(`Failed to generate share link: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OFF_PLAN: 'bg-blue-100 text-blue-700',
      NEW_BUILD: 'bg-emerald-100 text-emerald-700',
      RESALE: 'bg-purple-100 text-purple-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === properties.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(properties.map(p => p.id)))
    }
  }

  const handleEdit = (property: Property) => {
    setSelectedProperty(property)
    setEditModalOpen(true)
  }

  const handleDelete = async (property: Property) => {
    if (!confirm(`Are you sure you want to delete "${property.title}"? This action cannot be undone.`)) {
      return
    }
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/properties/${property.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to delete property: ${error.message}`)
      }
    } catch (error) {
      console.error('Error deleting property:', error)
      alert('Failed to delete property. Please try again.')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkDeleting(true)
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/properties/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (response.ok) {
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to delete properties: ${error.message || error.error}`)
      }
    } catch (error) {
      console.error('Error bulk deleting properties:', error)
      alert('Failed to delete properties. Please try again.')
    } finally {
      setBulkDeleting(false)
      setBulkDeleteOpen(false)
    }
  }

  const handleView = (property: Property) => {
    window.open(`/property/${property.id}`, '_blank')
  }

  const allSelected = properties.length > 0 && selectedIds.size === properties.length

  return (
    <>
      <EditPropertyModal
        property={selectedProperty}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !bulkDeleting && setBulkDeleteOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <button
              onClick={() => !bulkDeleting && setBulkDeleteOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">Delete Properties</h3>
                <p className="text-sm text-stone-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-stone-700 mb-2">
              Are you sure you want to delete <span className="font-bold text-red-600">{selectedIds.size}</span> {selectedIds.size === 1 ? 'property' : 'properties'}?
            </p>
            <p className="text-sm text-stone-500 mb-6">
              All associated documents, inquiries, favorites, and related data will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {bulkDeleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedIds.size} {selectedIds.size === 1 ? 'Property' : 'Properties'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-red-800">
            {selectedIds.size} {selectedIds.size === 1 ? 'property' : 'properties'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-stone-600 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-white transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setBulkDeleteOpen(true)}
              className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 w-10">
                <button onClick={toggleSelectAll} className="text-stone-400 hover:text-stone-700">
                  {allSelected ? (
                    <CheckSquare className="w-4.5 h-4.5 text-[#1B4965]" />
                  ) : (
                    <Square className="w-4.5 h-4.5" />
                  )}
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Details</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Engagement</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {properties.map((property) => (
              <tr key={property.id} className={`hover:bg-gray-50 ${selectedIds.has(property.id) ? 'bg-blue-50/50' : ''}`}>
                <td className="px-4 py-3">
                  <button onClick={() => toggleSelect(property.id)} className="text-stone-400 hover:text-stone-700">
                    {selectedIds.has(property.id) ? (
                      <CheckSquare className="w-4.5 h-4.5 text-[#1B4965]" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 max-w-[200px] truncate">{property.title}</div>
                  {property.developer && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />
                      {property.developer.name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(property.price, property.currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {property.country.charAt(0) + property.country.slice(1).toLowerCase()}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {property.bedrooms} bed · {property.bathrooms} bath · {property.area} m²
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusBadge(property.status || 'NEW_BUILD')}`}>
                      {(property.status || 'NEW_BUILD').replace('_', ' ')}
                    </span>
                    {property.isGoldenVisaEligible && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                        Golden Visa
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {property.investmentData?.rentalYield ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="h-3 w-3" />
                        {property.investmentData.rentalYield.toFixed(1)}%
                      </span>
                    ) : null}
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3 text-red-400" />
                      {property._count?.favoriteProperties || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-blue-400" />
                      {property._count?.propertyInquiries || 0}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleView(property)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleShare(property)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        copiedId === property.id
                          ? 'text-emerald-600 bg-emerald-50'
                          : 'text-gray-400 hover:text-[#C97B4B] hover:bg-orange-50'
                      }`}
                      title={copiedId === property.id ? 'Link copied!' : 'Share public link'}
                    >
                      {copiedId === property.id ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleEdit(property)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(property)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
