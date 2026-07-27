'use client'

import { useMemo, useRef, useState } from 'react'
import { MapPin, X, Search, Check } from 'lucide-react'
import { searchAreas, regionsFor, regionLabel, type Market } from '@/lib/crm-locations'

/**
 * Region + area selection for a CRM client, always from the curated catalogue —
 * never free text, so leads and listings speak the same vocabulary and matching
 * actually works.
 *
 * A client may pick whole regions (open to anywhere in Mount Lebanon), specific
 * areas, or both. Choosing regions narrows the area list to those regions.
 * The catalogue is market-scoped: Georgian areas only appear for Georgia leads.
 */
export function LocationPicker({
  market,
  regions,
  areas,
  onChange,
}: {
  market: Market
  regions: string[]
  areas: string[]
  onChange: (patch: { regions?: string[]; areas?: string[] }) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const regionOpts = useMemo(() => regionsFor(market), [market])
  const results = useMemo(
    () => searchAreas(market, query, regions, 40).filter((a) => !areas.includes(a.name)),
    [market, query, regions, areas],
  )

  function toggleRegion(value: string) {
    const next = regions.includes(value) ? regions.filter((r) => r !== value) : [...regions, value]
    // Drop any selected area that no longer belongs to the chosen regions.
    const stillValid = next.length
      ? areas.filter((a) => searchAreas(market, '', next, 10_000).some((o) => o.name === a))
      : areas
    onChange({ regions: next, areas: stillValid })
  }

  function addArea(name: string) {
    if (!areas.includes(name)) onChange({ areas: [...areas, name] })
    setQuery('')
  }

  function removeArea(name: string) {
    onChange({ areas: areas.filter((a) => a !== name) })
  }

  return (
    <div className="space-y-3">
      {/* Regions */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Regions <span className="text-slate-400">— pick one or more if they&apos;re open to a whole region</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {regionOpts.map((r) => {
            const on = regions.includes(r.value)
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => toggleRegion(r.value)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {on && <Check className="h-3 w-3" />}
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Areas */}
      <div ref={boxRef}>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Specific areas <span className="text-slate-400">— optional, leave empty for the whole region</span>
        </label>

        {areas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {areas.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium">
                <MapPin className="h-3 w-3" />
                {a}
                <button type="button" onClick={() => removeArea(a)} className="hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={regions.length ? 'Search areas in the selected regions…' : 'Search any area…'}
            className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          {open && results.length > 0 && (
            <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-xl">
              {results.map((a) => (
                <button
                  key={`${a.name}-${a.caza}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addArea(a.name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-sky-50 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0"
                >
                  <span className="font-medium text-slate-800 truncate">
                    {a.name}
                    {a.city && <span className="font-normal text-slate-400"> · {a.city}</span>}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{a.caza} · {regionLabel(a.region)}</span>
                </button>
              ))}
            </div>
          )}
          {open && query && results.length === 0 && (
            <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl px-3 py-2.5 text-sm text-slate-400">
              No area found{regions.length ? ' in the selected regions' : ''}. Try another spelling.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
