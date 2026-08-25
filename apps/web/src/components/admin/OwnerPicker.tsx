'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Check, Loader2, UserPlus, X } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * Who owns this property.
 *
 * A brokerage sells other people's stock, so the owner is a CRM client — not a
 * site user and not a free-text name. Until now a property had no owner link at
 * all, which meant "what does this client own" could only be answered from the
 * separate LeadProperty shadow record, and a property created in the catalogue
 * was connected to nobody.
 *
 * The owner is usually someone already in the CRM, so search comes first. When
 * they aren't, creating them here beats sending the user to another screen and
 * losing the half-filled property form.
 */

export type OwnerRef = { id: string; name: string; phone?: string | null }

export function OwnerPicker({
  value,
  onChange,
  label = 'Owner',
  hint = 'The client who owns this property. Leave empty for developer stock.',
}: {
  value: OwnerRef | null
  onChange: (owner: OwnerRef | null) => void
  label?: string
  hint?: string
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<OwnerRef[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const needle = q.trim()
    if (value || needle.length < 2) { setResults([]); return }
    const mine = ++seq.current
    const ctl = new AbortController()
    // A picker that spins forever tells the user nothing.
    const bail = setTimeout(() => ctl.abort(), 12000)
    const t = setTimeout(async () => {
      setBusy(true); setError(null)
      try {
        const res = await fetch(
          `${apiUrl}/api/crm?search=${encodeURIComponent(needle)}&limit=8`,
          { credentials: 'include', cache: 'no-store', signal: ctl.signal }
        )
        if (mine !== seq.current) return
        if (!res.ok) { setError(`Client search failed (${res.status})`); setResults([]); return }
        const j = await res.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = j.data?.items ?? j.data ?? []
        setResults(rows.map((l) => ({ id: l.id, name: l.name, phone: l.phone ?? l.whatsapp ?? null })))
      } catch (e) {
        if (mine !== seq.current) return
        setResults([])
        setError((e as Error)?.name === 'AbortError' ? 'Search timed out.' : 'Could not reach the API.')
      } finally {
        clearTimeout(bail)
        if (mine === seq.current) setBusy(false)
      }
    }, 250)
    return () => { clearTimeout(t); clearTimeout(bail); ctl.abort() }
  }, [q, apiUrl, value])

  if (value) {
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm text-slate-800 truncate flex-1">
            {value.name}
            {value.phone && <span className="text-slate-500"> · {value.phone}</span>}
          </span>
          <button
            type="button"
            onClick={() => { onChange(null); setQ('') }}
            className="text-slate-400 hover:text-slate-700 shrink-0"
            title="Remove owner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>

      {creating ? (
        <NewClientInline
          apiUrl={apiUrl}
          initialName={q.trim()}
          onCancel={() => setCreating(false)}
          onCreated={(owner) => { setCreating(false); onChange(owner) }}
        />
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients by name, phone or email…"
              className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {busy && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>

          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

          {q.trim().length >= 2 && (
            <div className="mt-1 space-y-1 max-h-52 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChange(r)}
                  className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-800">{r.name}</span>
                  {r.phone && <span className="text-xs text-slate-400 block">{r.phone}</span>}
                </button>
              ))}

              {!busy && !error && results.length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-1">No client matches “{q.trim()}”.</p>
              )}

              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-left inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add “{q.trim()}” as a new client
              </button>
            </div>
          )}

          <p className="text-xs text-slate-400 mt-1">{hint}</p>
        </>
      )}
    </div>
  )
}

/**
 * Create the client without leaving the property form.
 *
 * Deliberately only the fields you'd have to hand while listing someone's
 * property. Everything else is edited in the CRM afterwards.
 */
function NewClientInline({
  apiUrl, initialName, onCancel, onCreated,
}: {
  apiUrl: string
  initialName: string
  onCancel: () => void
  onCreated: (owner: OwnerRef) => void
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) { setError('A name is required'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          // They own something we're listing, so they're selling it.
          type: 'SELLER',
          source: 'MANUAL',
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.message || j.error || 'Could not create the client'); return }
      const lead = j.data ?? j
      onCreated({ id: lead.id, name: lead.name, phone: lead.phone ?? null })
    } catch {
      setError('Could not reach the API.')
    } finally {
      setSaving(false)
    }
  }

  const cls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10'

  return (
    <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New client</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input value={name} onChange={(e) => setName(e.target.value)} className={cls} placeholder="Client name" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} className={cls} placeholder="Phone (optional)" />
      <p className="text-[11px] text-slate-400">
        Added as a seller. You can complete their details in the CRM later.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create &amp; link
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  )
}
