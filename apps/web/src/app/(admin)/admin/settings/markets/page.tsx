'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/ui/layout'
import { API_URL } from '@/lib/api/use-admin-data'
import { countryFlag, countryLabel, normaliseCountry } from '@/lib/market'

interface MarketRow { code: string; label: string; properties: number }

/**
 * The places we sell in outside Lebanon.
 *
 * Add one here — Bulgaria, Dubai — and it becomes a choice on every property.
 * A property filed under any of them appears on propgrp.com with the rest of
 * the international projects; nothing else has to be set up.
 */
export default function MarketsSettingsPage() {
  const [rows, setRows] = useState<MarketRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/markets`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error()
      setRows((await res.json()).data ?? [])
    } catch {
      setError('Could not load the markets.')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const code = normaliseCountry(draft)
  const exists = code === 'LEBANON' || Boolean(rows?.some((r) => r.code === code))

  async function call(method: 'POST' | 'DELETE', path: string, body?: unknown) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method, credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'That did not work.')
      setDraft('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Markets"
        description="Where we sell outside Lebanon. Everything here shows on propgrp.com; Lebanon shows on propgrouplb.com."
        backHref="/admin/settings"
        backLabel="Settings"
      />

      <form
        onSubmit={(e) => { e.preventDefault(); if (code.length >= 2 && !exists) void call('POST', '/api/markets', { name: draft }) }}
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <label className="min-w-48 flex-1">
          <span className="text-xs font-medium text-slate-500">Add a market</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Bulgaria, Dubai"
            autoComplete="off"
            className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>
        <button
          type="submit"
          disabled={busy || code.length < 2 || exists}
          className="mt-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:bg-slate-300"
        >
          <Plus className="h-4 w-4" /> Add{code.length >= 2 && !exists ? ` ${countryLabel(code)}` : ''}
        </button>
        {exists && code.length >= 2 && (
          <p className="w-full text-xs text-slate-500">
            {code === 'LEBANON' ? 'Lebanon is the other website, not a market to add.' : `${countryLabel(code)} is already on the list.`}
          </p>
        )}
      </form>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {rows === null ? (
          <p className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No markets yet. Add the first one above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.code} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-lg" aria-hidden="true">{countryFlag(r.code)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{r.label}</span>
                  <span className="block text-xs text-slate-500">
                    {r.properties === 0 ? 'No properties yet' : `${r.properties} propert${r.properties === 1 ? 'y' : 'ies'}`}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy || r.properties > 0}
                  title={r.properties > 0 ? 'Has properties — move or delete them first' : `Remove ${r.label}`}
                  aria-label={`Remove ${r.label}`}
                  onClick={() => void call('DELETE', `/api/markets/${encodeURIComponent(r.code)}`)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
