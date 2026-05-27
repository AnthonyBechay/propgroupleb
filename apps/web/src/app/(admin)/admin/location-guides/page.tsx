'use client'

import { useEffect, useState } from 'react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Building2,
} from 'lucide-react'

interface LocationGuide {
  id: string
  title: string
  content: string
  country: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  _count?: { properties: number }
}

const COUNTRIES = [
  { value: 'LEBANON', label: 'Lebanon' },
]

const EMPTY_FORM = {
  title: '',
  content: '',
  country: 'LEBANON',
  imageUrl: '',
}

export default function LocationGuidesPage() {
  const [guides, setGuides] = useState<LocationGuide[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterCountry, setFilterCountry] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    fetchGuides()
  }, [])

  async function apiBase() {
    return normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  }

  async function fetchGuides() {
    try {
      setLoading(true)
      const base = await apiBase()
      const res = await fetch(`${base}/api/location-guides`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setGuides(data.data || data || [])
      } else {
        setError('Failed to load location guides')
      }
    } catch (err) {
      console.error('Failed to fetch location guides:', err)
      setError('Failed to load location guides')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(guide: LocationGuide) {
    setEditingId(guide.id)
    setForm({
      title: guide.title,
      content: guide.content,
      country: guide.country,
      imageUrl: guide.imageUrl || '',
    })
    setError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required')
      return
    }
    try {
      setSaving(true)
      setError(null)
      const base = await apiBase()
      const url = editingId
        ? `${base}/api/location-guides/${editingId}`
        : `${base}/api/location-guides`
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          country: form.country,
          imageUrl: form.imageUrl.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || body.error || 'Save failed')
      }
      closeModal()
      fetchGuides()
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(guide: LocationGuide) {
    if ((guide._count?.properties || 0) > 0) {
      alert(
        `Cannot delete — ${guide._count?.properties} propert${
          guide._count?.properties === 1 ? 'y is' : 'ies are'
        } using this guide. Unlink them first.`
      )
      return
    }
    if (!confirm(`Delete "${guide.title}"? This cannot be undone.`)) return
    try {
      const base = await apiBase()
      const res = await fetch(`${base}/api/location-guides/${guide.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || 'Delete failed')
      }
      fetchGuides()
    } catch (err: any) {
      alert(err?.message || 'Delete failed')
    }
  }

  const filtered = filterCountry
    ? guides.filter((g) => g.country === filterCountry)
    : guides

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Location Guides
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Region/city guides that can be linked to properties. Great for
            Beirut, coastal cities, and other Lebanese regions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          New Guide
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-slate-600">Country:</label>
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
        >
          <option value="">All</option>
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500 ml-2">
          {filtered.length} guide{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-lg p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No location guides yet
          </h3>
          <p className="text-gray-500 mb-6">
            Create a guide for each city or region you cover.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Create First Guide
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((guide) => (
            <div
              key={guide.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-800 transition-colors"
            >
              {guide.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.imageUrl}
                  alt={guide.title}
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {guide.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {guide.country}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3 w-3" />
                        {guide._count?.properties || 0} linked
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                  {guide.content}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(guide)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(guide)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Location Guide' : 'New Location Guide'}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Country <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Beirut — Neighborhood Guide"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  placeholder="Describe the region, lifestyle, investment outlook, key neighborhoods, etc."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Image URL <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {editingId ? 'Save Changes' : 'Create Guide'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
