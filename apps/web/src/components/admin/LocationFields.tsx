'use client'

import { useState } from 'react'
import { Search, MapPin, X, Check, AlertTriangle } from 'lucide-react'
import { searchLocations, isKnownLocation, MOHAFAZAT_LABEL, type LebanonLocation } from '@/lib/lebanon-locations'
import { GEORGIA_AREAS } from '@/lib/crm-locations'

export interface LocationValue {
  mohafazat: string
  caza: string
  city: string
  neighborhood: string
}

/**
 * Search-only location block used by both the Create and Edit property forms.
 * Admins can ONLY pick a town/area from our curated gazetteer — there is no
 * free-text entry, so an unknown location can never be saved. When an existing
 * property loads with a location that isn't in the list, a red error is shown
 * forcing the admin to re-pick a valid one. Validity is also enforced on submit
 * via `isKnownLocation` in the parent forms.
 */
export function LocationFields({
  value,
  onChange,
  country = 'LEBANON',
}: {
  value: LocationValue
  onChange: (patch: Partial<LocationValue>) => void
  /** Which market the property is in — decides how location is captured. */
  country?: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LebanonLocation[]>([])

  // Outside Lebanon there is no curated gazetteer, and mohafazat/caza are
  // meaningless — a Batumi tower has neither. Locking those markets to the
  // Lebanese list made every imported Georgian property unsavable, so they get
  // a suggest-but-allow-anything field instead.
  if (country !== 'LEBANON') {
    return <InternationalLocation value={value} onChange={onChange} country={country} />
  }

  const onQuery = (v: string) => { setQ(v); setResults(searchLocations(v)) }
  const pick = (l: LebanonLocation) => {
    onChange({ mohafazat: l.mohafazat, caza: l.caza, city: l.city ?? l.name, neighborhood: l.city ? l.name : '' })
    setQ('')
    setResults([])
  }
  const clear = () => onChange({ mohafazat: '', caza: '', city: '', neighborhood: '' })

  const hasLocation = !!(value.city || value.neighborhood)
  const known = isKnownLocation(value)
  const summary = [
    value.neighborhood,
    value.city,
    value.caza,
    value.mohafazat ? (MOHAFAZAT_LABEL[value.mohafazat] ?? value.mohafazat) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      {/* Invalid saved location (e.g. an old property) — force a re-pick */}
      {hasLocation && !known && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">This location isn’t in our list anymore.</p>
            <p className="text-red-600/90 text-xs mt-0.5">
              Saved as “{summary || '—'}”. Please search and pick a valid town/area below before saving.
            </p>
          </div>
        </div>
      )}

      {/* Prominent search box — the ONLY way to set location */}
      <div className={`relative rounded-xl border-2 p-3 transition-colors ${hasLocation && !known ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50/60 focus-within:border-slate-400'}`}>
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
          <Search className="w-3.5 h-3.5" /> Search the town or area
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => onQuery(e.target.value)}
            className="w-full pl-10 pr-3 h-11 text-base border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500"
            placeholder="Start typing — e.g. Fanar, Achrafieh, Bouchrieh, Amchit…"
            autoComplete="off"
          />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto">
              {results.map((l, i) => (
                <button key={i} type="button" onClick={() => pick(l)} className="w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0">
                  <span className="font-medium text-slate-800 truncate">
                    {l.name}{l.city ? <span className="font-normal text-slate-400"> · {l.city}</span> : null}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">{l.caza} · {MOHAFAZAT_LABEL[l.mohafazat]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected location summary */}
        {hasLocation && known ? (
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <Check className="w-3.5 h-3.5" /> {summary}
            </span>
            <button type="button" onClick={clear} className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1">
              <X className="w-3 h-3" /> clear
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-2">
            Pick a result to fill the region, district and city automatically. Can’t find a place? Ask us to add it — only listed locations can be saved.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Location capture outside Lebanon.
 *
 * We curate a gazetteer for Lebanon because the team sells there daily and a
 * typo splits a neighbourhood in two. For resold international stock we don't
 * have that — and never will for every country — so this suggests the cities
 * we know and accepts anything else. `mohafazat` and `caza` stay empty: they
 * are Lebanese administrative divisions and mean nothing in Batumi.
 */
function InternationalLocation({
  value,
  onChange,
  country,
}: {
  value: LocationValue
  onChange: (patch: Partial<LocationValue>) => void
  country: string
}) {
  // Cities we already sell in, offered as a datalist rather than a hard list.
  const known = Array.from(
    new Set(
      GEORGIA_AREAS.map((a) => a.city ?? a.name).filter(Boolean) as string[]
    )
  ).sort()

  const label = 'block text-sm font-medium text-slate-700 mb-1'
  const input =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15'

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          This property is in <strong>{country.charAt(0) + country.slice(1).toLowerCase()}</strong>, so it
          appears on propgrp.com. Type the city and district freely — the Lebanese
          region/district list doesn&apos;t apply here.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>City</label>
          <input
            list="intl-cities"
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value, mohafazat: '', caza: '' })}
            className={input}
            placeholder="Batumi"
          />
          <datalist id="intl-cities">
            {known.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label className={label}>District / area</label>
          <input
            value={value.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            className={input}
            placeholder="Old Boulevard, Gonio…"
          />
        </div>
      </div>

      {(value.city || value.neighborhood) && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-3.5 h-3.5" />
          {[value.neighborhood, value.city].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  )
}
