'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Upload, X, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

const DOC_TYPES = ['FLOOR_PLAN', 'BROCHURE', 'CONTRACT', 'LEGAL_DOCUMENT', 'CERTIFICATE', 'OTHER']
const DOC_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan', BROCHURE: 'Brochure', CONTRACT: 'Contract',
  LEGAL_DOCUMENT: 'Legal Document', CERTIFICATE: 'Certificate', OTHER: 'Other',
}

interface Doc { id: string; title: string; type: string; isPublic: boolean; fileUrl: string; unitId?: string | null }

/**
 * Live documents manager for the property Edit form — lists existing
 * building-level documents and lets the admin upload, retype, toggle public,
 * and delete. Mirrors the documents section of the create form, but operates
 * against the saved building.
 */
export function BuildingDocumentsManager({ buildingId }: { buildingId: string }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/documents?propertyId=${buildingId}`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const j = await res.json()
        const all: Doc[] = j.data ?? j ?? []
        setDocs(all.filter((d) => !d.unitId)) // property-level docs
      }
    } finally { setLoading(false) }
  }, [apiUrl, buildingId])
  useEffect(() => { load() }, [load])

  async function upload(files: FileList) {
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('propertyId', buildingId)
        fd.append('title', file.name.replace(/\.[^.]+$/, ''))
        fd.append('type', 'OTHER')
        fd.append('isPublic', 'false')
        await fetch(`${apiUrl}/api/documents`, { method: 'POST', credentials: 'include', body: fd })
      } catch { /* skip */ }
    }
    setUploading(false)
    load()
  }
  async function update(id: string, patch: Partial<Pick<Doc, 'title' | 'type' | 'isPublic'>>) {
    setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d))) // optimistic
    try {
      await fetch(`${apiUrl}/api/documents/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    } catch { load() }
  }
  async function remove(id: string) {
    if (!confirm('Delete this document? This removes the file permanently.')) return
    setDocs((ds) => ds.filter((d) => d.id !== id))
    try { await fetch(`${apiUrl}/api/documents/${id}`, { method: 'DELETE', credentials: 'include' }) } catch { load() }
  }

  const inp = 'px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10'

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading documents…</div>
      ) : docs.length > 0 ? (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
              <FileText className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
              <input defaultValue={d.title} onBlur={(e) => e.target.value !== d.title && update(d.id, { title: e.target.value })} className={inp + ' flex-1'} placeholder="Title" />
              <select value={d.type} onChange={(e) => update(d.id, { type: e.target.value })} className={inp + ' sm:w-44'}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap px-1">
                <input type="checkbox" checked={d.isPublic} onChange={(e) => update(d.id, { isPublic: e.target.checked })} className="rounded border-slate-300" /> Public
              </label>
              <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-900 underline px-1">View</a>
              <button type="button" onClick={() => remove(d.id)} className="p-1.5 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No documents yet.</p>
      )}

      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add documents
      </button>
      <p className="text-xs text-slate-400">PDF, images, Word or Excel. Public documents show on the property page; private ones are admin-only.</p>
      <input ref={inputRef} type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }} />
    </div>
  )
}
