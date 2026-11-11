'use client'

import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/api/use-admin-data'
import { countryLabel, countryWithFlag, normaliseCountry } from '@/lib/market'

const ADD = '__add__'

interface MarketRow { code: string; label: string; properties: number }

/**
 * Pick where a property is.
 *
 * Lebanon, or one of the markets the office has added (Settings → Markets).
 * "Add a new market…" adds one on the spot — Bulgaria, Dubai, anything — and
 * it is on the list for every property after that. This used to be a fixed
 * choice of four countries backed by a database enum, so a project anywhere
 * else could not be saved at all.
 */
export function CountryPicker({
  value, onChange, disabled, className, id,
}: {
  value: string
  onChange: (country: string) => void
  disabled?: boolean
  className?: string
  id?: string
}) {
  const current = normaliseCountry(value) || 'LEBANON'
  const [markets, setMarkets] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API_URL}/api/markets`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setMarkets(((j.data ?? []) as MarketRow[]).map((m) => m.code)) })
      // The list is a convenience: without it the current value is still shown and kept.
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Whatever is on the record is always an option, listed or not.
  const options = Array.from(new Set(['LEBANON', ...markets, current]))
  const code = normaliseCountry(draft)

  async function add() {
    if (code.length < 2 || busy) return
    setBusy(true); setError(null)
    try {
      if (code !== 'LEBANON') {
        const res = await fetch(`${API_URL}/api/markets`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: draft }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Could not add it')
        setMarkets((m) => Array.from(new Set([...m, code])).sort())
      }
      onChange(code)
      setAdding(false); setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it')
    } finally {
      setBusy(false)
    }
  }

  if (adding) {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          <input
            id={id}
            autoFocus
            value={draft}
            disabled={disabled || busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void add() }
              if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
            placeholder="e.g. Bulgaria, Dubai"
            autoComplete="off"
            className={`${className ?? ''} min-w-40 flex-1`}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={code.length < 2 || busy}
            className="min-h-11 shrink-0 rounded-lg bg-slate-900 px-3.5 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {busy ? 'Adding…' : `Add${code.length >= 2 ? ` ${countryLabel(code)}` : ''}`}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setDraft(''); setError(null) }}
            className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <select
      id={id}
      value={current}
      disabled={disabled}
      onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}
      className={className}
    >
      {options.map((c) => <option key={c} value={c}>{countryWithFlag(c)}</option>)}
      <option value={ADD}>＋ Add a new market…</option>
    </select>
  )
}
