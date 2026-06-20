'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { searchLocations, MOHAFAZAT_LABEL, type LebanonLocation } from '@/lib/lebanon-locations'

const MOHAFAZAT = ['BEIRUT', 'MOUNT_LEBANON', 'NORTH', 'SOUTH', 'BEKAA', 'NABATIEH', 'AKKAR', 'BAALBEK_HERMEL']

export interface LocationValue {
  mohafazat: string
  caza: string
  city: string
  neighborhood: string
}

/**
 * Shared location block (search typeahead + region/district/city/neighborhood)
 * used by both the Create and Edit property forms so they behave identically.
 * Picking a town auto-fills region/district/city; fields remain editable.
 */
export function LocationFields({ value, onChange }: { value: LocationValue; onChange: (patch: Partial<LocationValue>) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<LebanonLocation[]>([])

  const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400'
  const lbl = 'block text-sm font-medium text-slate-700 mb-1'

  const onQuery = (v: string) => { setQ(v); setResults(searchLocations(v)) }
  const pick = (l: LebanonLocation) => {
    // A sub-area entry (has a parent `city`) fills both the city and neighborhood
    // fields; a plain town fills city and clears neighborhood.
    onChange({
      mohafazat: l.mohafazat,
      caza: l.caza,
      city: l.city ?? l.name,
      neighborhood: l.city ? l.name : '',
    })
    setQ(l.city ? `${l.name}, ${l.city} — ${MOHAFAZAT_LABEL[l.mohafazat]}` : `${l.name} — ${l.caza}, ${MOHAFAZAT_LABEL[l.mohafazat]}`)
    setResults([])
  }

  return (
    <>
      <div className="relative">
        <label className={lbl}>Search location</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input value={q} onChange={(e) => onQuery(e.target.value)} className={inp + ' pl-9'} placeholder="Type a town — e.g. Fanar, Achrafieh, Amchit" />
        </div>
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
            {results.map((l, i) => (
              <button key={i} type="button" onClick={() => pick(l)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800 truncate">
                  {l.name}{l.city ? <span className="font-normal text-slate-400"> · {l.city}</span> : null}
                </span>
                <span className="text-xs text-slate-400 shrink-0">{l.caza} · {MOHAFAZAT_LABEL[l.mohafazat]}</span>
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1">Start typing to find a town — it fills region, district and city. You can still edit the fields below.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Region (Mohafazat)</label>
          <select value={value.mohafazat} onChange={(e) => onChange({ mohafazat: e.target.value })} className={inp}>
            <option value="">— Select region —</option>
            {MOHAFAZAT.map((m) => <option key={m} value={m}>{MOHAFAZAT_LABEL[m]}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Caza (District)</label><input value={value.caza} onChange={(e) => onChange({ caza: e.target.value })} className={inp} placeholder="e.g., Metn" /></div>
        <div><label className={lbl}>City / Town</label><input value={value.city} onChange={(e) => onChange({ city: e.target.value })} className={inp} placeholder="e.g., Fanar" /></div>
        <div><label className={lbl}>Neighborhood</label><input value={value.neighborhood} onChange={(e) => onChange({ neighborhood: e.target.value })} className={inp} placeholder="optional" /></div>
      </div>
    </>
  )
}
