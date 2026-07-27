'use client'

import { useRef, useState } from 'react'
import { X, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface ParsedRow {
  name: string
  type: string
  market: string
  askingFor: string
  phone: string
  areas: string[]
  notes: string
  contactIntervalDays: number
  lastContactAt: string | null
}

/** Split a CSV line, honouring quoted cells that contain commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

/** Map a spreadsheet header to our field, tolerating the sheet's own wording. */
function fieldFor(header: string): string | null {
  const h = header.toLowerCase().replace(/[^a-z]/g, '')
  if (h.includes('clientname') || h === 'name') return 'name'
  if (h.includes('clienttype') || h === 'type') return 'type'
  if (h.includes('market') || h.includes('country')) return 'market'
  if (h.includes('askingfor') || h.includes('lookingfor') || h.includes('request')) return 'askingFor'
  if (h.includes('phone') || h.includes('mobile') || h.includes('number')) return 'phone'
  if (h.includes('whatsapp')) return 'whatsapp'
  if (h.includes('email')) return 'email'
  if (h.includes('area') || h.includes('location') || h.includes('region')) return 'areas'
  if (h.includes('interval')) return 'contactIntervalDays'
  if (h.includes('lastcontact')) return 'lastContactAt'
  if (h.includes('note') || h.includes('action') || h.includes('comment')) return 'notes'
  return null
}

function parseType(v: string): string {
  const s = (v || '').toLowerCase()
  if (s.includes('sell')) return 'SELLER'
  if (s.includes('land') || s.includes('owner')) return 'LANDLORD'
  if (s.includes('rent')) return 'RENTER'
  if (s.includes('invest')) return 'INVESTOR'
  return 'BUYER'
}

function parseDate(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Import clients from the team's spreadsheet. Accepts a CSV export (Excel:
 * File → Save As → CSV) and maps the familiar column names automatically.
 */
export function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  async function readFile(file: File) {
    setError(null); setDone(null)
    setFileName(file.name)
    const text = await file.text()
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) { setError('That file has no data rows.'); return }

    const headers = splitCsvLine(lines[0]).map(fieldFor)
    if (!headers.includes('name')) {
      setError('Could not find a "Client Name" column. Make sure the first row is the header.')
      return
    }

    const parsed: ParsedRow[] = []
    for (const line of lines.slice(1)) {
      const cells = splitCsvLine(line)
      const rec: Record<string, string> = {}
      headers.forEach((field, i) => { if (field) rec[field] = cells[i] ?? '' })
      if (!rec.name?.trim()) continue

      parsed.push({
        name: rec.name.trim(),
        type: parseType(rec.type),
        market: (rec.market || '').toLowerCase().includes('georg') ? 'GEORGIA' : 'LEBANON',
        askingFor: (rec.askingFor || '').trim(),
        phone: (rec.phone || '').trim(),
        // Areas are free text in the sheet; keep them as notes-worthy hints and
        // let the team re-pick proper areas from the catalogue after import.
        areas: [],
        notes: [rec.notes, rec.areas ? `Areas from sheet: ${rec.areas}` : ''].filter(Boolean).join('\n').trim(),
        contactIntervalDays: Number(rec.contactIntervalDays) || 7,
        lastContactAt: parseDate(rec.lastContactAt),
      })
    }

    if (!parsed.length) setError('No valid rows found (every row needs a client name).')
    setRows(parsed)
  }

  async function doImport() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: rows.map((r) => ({
            name: r.name,
            type: r.type,
            market: r.market,
            status: 'NEW',
            source: 'MANUAL',
            askingFor: r.askingFor || null,
            phone: r.phone || null,
            areas: r.areas,
            regions: [],
            unitKinds: [],
            notes: r.notes || null,
            contactIntervalDays: r.contactIntervalDays,
            lastContactAt: r.lastContactAt,
            currency: 'USD',
          })),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.message || j.error || 'Import failed'); return }
      setDone(j.data?.count ?? rows.length)
      onImported()
    } catch {
      setError('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Import clients
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {done !== null ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-900 mt-3">{done} clients imported</p>
              <p className="text-sm text-slate-500 mt-1">They&apos;re in the <strong>New</strong> column, ready to work.</p>
              <button onClick={onClose} className="mt-4 px-5 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700">
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Export your sheet as <strong>CSV</strong> (File → Save As → CSV), then drop it here.
                Columns like <em>Client Name</em>, <em>Client Type</em>, <em>Asking for</em>, <em>Phone Number</em>,
                <em> Interval</em> and <em>Notes</em> are detected automatically.
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{error}
                </div>
              )}

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-slate-400 transition-colors"
              >
                <Upload className="h-7 w-7 text-slate-300 mx-auto mb-1.5" />
                <p className="text-sm font-medium text-slate-600">{fileName || 'Choose a CSV file'}</p>
                <p className="text-xs text-slate-400 mt-0.5">.csv exported from Excel or Google Sheets</p>
              </button>
              <input
                ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }}
              />

              {rows.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                    Preview — {rows.length} client{rows.length === 1 ? '' : 's'}
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {rows.slice(0, 20).map((r, i) => (
                      <div key={i} className="px-3 py-2 text-sm flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800 truncate">{r.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {r.type} · {r.market === 'GEORGIA' ? '🇬🇪' : '🇱🇧'} · {r.phone || 'no phone'}
                        </span>
                      </div>
                    ))}
                    {rows.length > 20 && <div className="px-3 py-2 text-xs text-slate-400">…and {rows.length - 20} more</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {done === null && (
          <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
            <button
              onClick={doImport}
              disabled={busy || rows.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Import {rows.length > 0 && `${rows.length} clients`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
