'use client'

import { useState } from 'react'
import { Search, MapPin, X, Check, AlertTriangle } from 'lucide-react'
import { searchLocations, isKnownLocation, MOHAFAZAT_LABEL, type LebanonLocation } from '@/lib/lebanon-locations'
import { GEORGIA_AREAS, GEORGIA_REGION_LABEL, type AreaOption } from '@/lib/crm-locations'

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
 * Same curated-list discipline as Lebanon — a typo splits a district in two
 * either way — but against the Georgian catalogue, which the CRM already uses
 * for client area preferences. Picking here fills city and district together so
 * a Batumi tower and a Batumi buyer describe their location identically and can
 * actually be matched.
 *
 * `mohafazat` and `caza` stay empty: they are Lebanese administrative divisions
 * and mean nothing abroad. The region is kept in `caza` — the nearest column we
 * have — so it survives a round trip.
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
  const [q, setQ] = useState('')

  // Only Georgia is catalogued today. Another country falls back to free text
  // rather than blocking the save on a list that doesn't exist yet.
  const catalogue: AreaOption[] = country === 'GEORGIA' ? GEORGIA_AREAS : []
  const hasCatalogue = catalogue.length > 0

  const results = q.trim().length < 2 ? [] : catalogue
    .filter((a) =>
      a.name.toLowerCase().includes(q.toLowerCase()) ||
      (a.city ?? '').toLowerCase().includes(q.toLowerCase())
    )
    .slice(0, 40)

  const pick = (a: AreaOption) => {
    // City is the parent town, neighbourhood the specific area — same shape the
    // Lebanese picker produces, so downstream code needs no special case.
    onChange({ city: a.city ?? a.name, neighborhood: a.city ? a.name : '', caza: a.region, mohafazat: '' })
    setQ('')
  }

  const summary = [value.neighborhood, value.city].filter(Boolean).join(' · ')
  const label = 'block text-sm font-medium text-slate-700 mb-1'
  const input =
    'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15'

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          In <strong>{country.charAt(0) + country.slice(1).toLowerCase()}</strong>, so it appears on
          propgrp.com. {hasCatalogue
            ? 'Pick the area from the list — the same one the CRM uses, so buyers looking here get matched.'
            : 'No curated list for this country yet, so type the city and district.'}
        </p>
      </div>

      {hasCatalogue ? (
        <div className="relative rounded-xl border-2 border-slate-200 bg-slate-50/60 p-3 focus-within:border-slate-400">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
            <Search className="w-3.5 h-3.5" /> Search the area
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-3 h-11 text-base border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15"
              placeholder="Start typing — e.g. Gonio, New Boulevard, Vake, Kobuleti…"
              autoComplete="off"
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                {results.map((a, i) => (
                  <button
                    key={`${a.name}-${i}`}
                    type="button"
                    onClick={() => pick(a)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 flex items-center justify-between gap-3 border-b border-slate-50 last:border-0"
                  >
                    <span className="font-medium text-slate-800 truncate">
                      {a.name}
                      {a.city && a.city !== a.name && (
                        <span className="font-normal text-slate-400"> · {a.city}</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {GEORGIA_REGION_LABEL[a.region] ?? a.region}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {summary ? (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                <Check className="w-3.5 h-3.5" /> {summary}
                {value.caza && (
                  <span className="text-emerald-600/80">
                    · {GEORGIA_REGION_LABEL[value.caza] ?? value.caza}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onChange({ city: '', neighborhood: '', caza: '', mohafazat: '' })}
                className="text-xs text-slate-400 hover:text-red-600 inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> clear
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              Pick a result to fill the city and district together.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>City</label>
            <input
              value={value.city}
              onChange={(e) => onChange({ city: e.target.value, mohafazat: '', caza: '' })}
              className={input}
            />
          </div>
          <div>
            <label className={label}>District / area</label>
            <input
              value={value.neighborhood}
              onChange={(e) => onChange({ neighborhood: e.target.value })}
              className={input}
            />
          </div>
        </div>
      )}
    </div>
  )
}
