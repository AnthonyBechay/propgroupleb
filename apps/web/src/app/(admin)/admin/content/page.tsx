'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { FileText, Save, Trash2, Plus, Search } from 'lucide-react'
import { apiClient } from '@/lib/api/client'

interface ContentItem {
  id: string
  key: string
  section: string
  title: string | null
  content: string | null
  sortOrder: number
  isActive: boolean
  updatedAt: string
}

interface ApiResponse {
  success: boolean
  data: ContentItem[]
}

export default function AdminContentPage() {
  const { user } = useAuth()
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [filterSection, setFilterSection] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  // New content form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newSection, setNewSection] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  useEffect(() => {
    fetchContent()
  }, [])

  async function fetchContent() {
    try {
      const response = await apiClient.getAllContent() as ApiResponse
      setContent(response.data || [])
    } catch (error) {
      console.error('Failed to fetch content:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(key: string) {
    setSaving(true)
    try {
      await apiClient.updateContent(key, {
        title: editTitle,
        content: editValue,
      })
      setEditingKey(null)
      await fetchContent()
    } catch (error) {
      console.error('Failed to save content:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate() {
    if (!newKey || !newSection) return
    setSaving(true)
    try {
      await apiClient.updateContent(newKey, {
        section: newSection,
        title: newTitle,
        content: newContent,
      })
      setShowNewForm(false)
      setNewKey('')
      setNewSection('')
      setNewTitle('')
      setNewContent('')
      await fetchContent()
    } catch (error) {
      console.error('Failed to create content:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(key: string) {
    if (!confirm('Are you sure you want to delete this content?')) return
    try {
      await apiClient.deleteContent(key)
      await fetchContent()
    } catch (error) {
      console.error('Failed to delete content:', error)
    }
  }

  function startEditing(item: ContentItem) {
    setEditingKey(item.key)
    setEditValue(item.content || '')
    setEditTitle(item.title || '')
  }

  const sections = [...new Set(content.map(c => c.section))].sort()

  const filtered = content.filter(item => {
    if (filterSection && item.section !== filterSection) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        item.key.toLowerCase().includes(q) ||
        (item.title?.toLowerCase().includes(q) ?? false) ||
        (item.content?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return <div className="p-8 text-center text-gray-500">Access denied</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Content</h1>
          <p className="text-gray-500 mt-1">Manage website text content and copy</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Content
        </button>
      </div>

      {/* Section mapping info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Section &rarr; Page Mapping</p>
        <p>
          <span className="font-medium">hero</span> &rarr; Homepage hero &nbsp;|&nbsp;{' '}
          <span className="font-medium">features</span> &rarr; Homepage features &nbsp;|&nbsp;{' '}
          <span className="font-medium">cta</span> &rarr; Homepage CTA &nbsp;|&nbsp;{' '}
          <span className="font-medium">about</span> &rarr; About page &nbsp;|&nbsp;{' '}
          <span className="font-medium">contact</span> &rarr; Contact page &nbsp;|&nbsp;{' '}
          <span className="font-medium">footer</span> &rarr; Site footer
        </p>
      </div>

      {/* New content form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">New Content Entry</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g., hero_title"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select a section...</option>
                <option value="hero">hero</option>
                <option value="about">about</option>
                <option value="features">features</option>
                <option value="cta">cta</option>
                <option value="contact">contact</option>
                <option value="footer">footer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Display name"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              placeholder="Content text..."
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || !newKey || !newSection}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search content..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={filterSection}
          onChange={(e) => setFilterSection(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All sections</option>
          {sections.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No content found. Add your first content entry above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl border p-4">
              {editingKey === item.key ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSave(item.key)}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => startEditing(item)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {item.section}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{item.key}</span>
                    </div>
                    {item.title && (
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    )}
                    <p className="text-sm text-gray-600 truncate mt-0.5">
                      {item.content || <span className="italic text-gray-400">Empty</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item.key)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition ml-2"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
