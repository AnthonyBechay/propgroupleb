'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Upload,
  Trash2,
  Building2,
  Search,
  X,
  File,
  Image,
  FileSpreadsheet,
  ExternalLink,
  Download,
  Filter,
  Loader2,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'

interface PropertyDocument {
  id: string
  propertyId: string
  title: string
  description: string | null
  type: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  isPublic: boolean
  createdAt: string
  property: {
    id: string
    title: string
    country: string
  }
}

interface PropertyOption {
  id: string
  title: string
  country: string
}

const DOCUMENT_TYPES = [
  { value: 'FLOOR_PLAN', label: 'Floor Plan' },
  { value: 'BROCHURE', label: 'Brochure' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'LEGAL_DOCUMENT', label: 'Legal Document' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'OTHER', label: 'Other' },
]

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    FLOOR_PLAN: 'bg-blue-100 text-blue-700',
    BROCHURE: 'bg-emerald-100 text-emerald-700',
    CONTRACT: 'bg-red-100 text-red-700',
    LEGAL_DOCUMENT: 'bg-amber-100 text-amber-700',
    CERTIFICATE: 'bg-purple-100 text-purple-700',
    OTHER: 'bg-stone-100 text-stone-700',
  }
  return colors[type] || colors.OTHER
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="w-5 h-5" />
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5" />
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileSpreadsheet className="w-5 h-5" />
  return <FileText className="w-5 h-5" />
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<PropertyDocument[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProperty, setFilterProperty] = useState('')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadType, setUploadType] = useState('OTHER')
  const [uploadPropertyId, setUploadPropertyId] = useState('')
  const [uploadIsPublic, setUploadIsPublic] = useState(false)

  useEffect(() => {
    fetchDocuments()
    fetchProperties()
  }, [])

  async function fetchDocuments() {
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/documents`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchProperties() {
    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/properties?limit=1000`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setProperties(
          (data.data || []).map((p: any) => ({
            id: p.id,
            title: p.title,
            country: p.country,
          }))
        )
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error)
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadPropertyId || !uploadTitle) return
    setUploading(true)

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('propertyId', uploadPropertyId)
      formData.append('title', uploadTitle)
      formData.append('description', uploadDescription)
      formData.append('type', uploadType)
      formData.append('isPublic', String(uploadIsPublic))

      const response = await fetch(`${apiUrl}/api/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (response.ok) {
        setUploadModalOpen(false)
        resetUploadForm()
        fetchDocuments()
      } else {
        const error = await response.json()
        alert(`Upload failed: ${error.message || error.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload document. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: PropertyDocument) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const response = await fetch(`${apiUrl}/api/documents/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        setDocuments(prev => prev.filter(d => d.id !== doc.id))
      } else {
        alert('Failed to delete document')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete document')
    }
  }

  function resetUploadForm() {
    setUploadFile(null)
    setUploadTitle('')
    setUploadDescription('')
    setUploadType('OTHER')
    setUploadPropertyId('')
    setUploadIsPublic(false)
  }

  const filtered = documents.filter(doc => {
    if (filterType && doc.type !== filterType) return false
    if (filterProperty && doc.propertyId !== filterProperty) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.property.title.toLowerCase().includes(q) ||
        doc.type.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Group by property for summary
  const docsByProperty = documents.reduce((acc, doc) => {
    if (!acc[doc.propertyId]) {
      acc[doc.propertyId] = { title: doc.property.title, count: 0 }
    }
    acc[doc.propertyId].count++
    return acc
  }, {} as Record<string, { title: string; count: number }>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-[#1B4965] rounded-xl flex items-center justify-center shadow-md">
              <FileText className="h-5 w-5 text-white" />
            </div>
            Document Management
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Upload and manage documents linked to property listings.
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B4965] text-white rounded-xl font-medium hover:bg-[#2B6985] transition-colors shadow-md"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-stone-500">Total Documents</p>
          <p className="text-2xl font-bold text-stone-900">{documents.length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-stone-500">Properties with Docs</p>
          <p className="text-2xl font-bold text-stone-900">{Object.keys(docsByProperty).length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-stone-500">Public Documents</p>
          <p className="text-2xl font-bold text-stone-900">{documents.filter(d => d.isPublic).length}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-stone-500">Total Size</p>
          <p className="text-2xl font-bold text-stone-900">
            {formatFileSize(documents.reduce((sum, d) => sum + (d.fileSize || 0), 0))}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm bg-white"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white"
        >
          <option value="">All Types</option>
          {DOCUMENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={filterProperty}
          onChange={(e) => setFilterProperty(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white max-w-xs"
        >
          <option value="">All Properties</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Document Table */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B4965] mx-auto mb-2" />
          <p className="text-stone-500">Loading documents...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-stone-900 mb-2">
            {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
          </h3>
          <p className="text-stone-500 mb-4">
            {documents.length === 0
              ? 'Upload your first document to link it to a property listing.'
              : 'Try adjusting your search or filters.'}
          </p>
          {documents.length === 0 && (
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B4965] text-white rounded-lg font-medium hover:bg-[#2B6985] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Document</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Property</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Date</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center text-stone-500">
                        {getFileIcon(doc.mimeType)}
                      </div>
                      <div>
                        <p className="font-medium text-stone-900">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-stone-500 truncate max-w-[200px]">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-stone-700">
                      <Building2 className="w-3.5 h-3.5 text-stone-400" />
                      <span className="max-w-[150px] truncate">{doc.property.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(doc.type)}`}>
                      {doc.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-[#1B4965] hover:bg-[#E8F1F5] transition-colors"
                        title="View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a
                        href={doc.fileUrl}
                        download={`${doc.title}${doc.mimeType ? '.' + doc.mimeType.split('/').pop()?.replace('vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx').replace('vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx').replace('vnd.ms-excel', 'xls').replace('msword', 'doc').replace('jpeg', 'jpg') : ''}`}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !uploading && setUploadModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { if (!uploading) { setUploadModalOpen(false); resetUploadForm() } }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#1B4965]" />
              Upload Document
            </h3>

            <div className="space-y-4">
              {/* Property Selection */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Link to Property <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadPropertyId}
                  onChange={(e) => setUploadPropertyId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">Select a property...</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({p.country})</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Floor Plan - Unit 301"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  {DOCUMENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* File */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  File <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed rounded-xl p-4 text-center hover:border-[#1B4965] transition-colors">
                  {uploadFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getFileIcon(uploadFile.type)}
                        <div className="text-left">
                          <p className="text-sm font-medium text-stone-900">{uploadFile.name}</p>
                          <p className="text-xs text-stone-500">{formatFileSize(uploadFile.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setUploadFile(null)}
                        className="text-stone-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-sm text-stone-500">Click to select a file</p>
                      <p className="text-xs text-stone-400 mt-1">PDF, images, Word, Excel (max 25MB)</p>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Public toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadIsPublic}
                  onChange={(e) => setUploadIsPublic(e.target.checked)}
                  className="rounded border-stone-300"
                />
                <span className="text-sm text-stone-700">Make publicly visible to users</span>
              </label>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
              <button
                onClick={() => { setUploadModalOpen(false); resetUploadForm() }}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadPropertyId || !uploadTitle}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1B4965] rounded-lg hover:bg-[#2B6985] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
