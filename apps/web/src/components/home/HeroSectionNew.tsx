'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, Sparkles } from 'lucide-react'
import Link from 'next/link'

const INTENT_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'For Sale', value: 'FOR_SALE' },
  { label: 'For Rent', value: 'FOR_RENT' },
] as const

const REGIONS = [
  { label: 'All Regions', value: '' },
  { label: 'Beirut', value: 'BEIRUT' },
  { label: 'Mount Lebanon', value: 'MOUNT_LEBANON' },
  { label: 'North Lebanon', value: 'NORTH' },
  { label: 'South Lebanon', value: 'SOUTH' },
  { label: 'Bekaa', value: 'BEKAA' },
  { label: 'Nabatieh', value: 'NABATIEH' },
  { label: 'Akkar', value: 'AKKAR' },
  { label: 'Baalbek-Hermel', value: 'BAALBEK_HERMEL' },
]

const TYPES = [
  { label: 'All Types', value: '' },
  { label: 'Apartment', value: 'APARTMENT' },
  { label: 'Villa', value: 'VILLA' },
  { label: 'Penthouse', value: 'PENTHOUSE' },
  { label: 'Studio', value: 'STUDIO' },
  { label: 'Duplex', value: 'DUPLEX' },
  { label: 'Office', value: 'OFFICE' },
  { label: 'Shop', value: 'SHOP' },
  { label: 'Land', value: 'LAND_PARCEL' },
]

const BEDS = [
  { label: 'Any Beds', value: '' },
  { label: '1+', value: '1' },
  { label: '2+', value: '2' },
  { label: '3+', value: '3' },
  { label: '4+', value: '4' },
]

export function HeroSectionNew() {
  const router = useRouter()
  const [intent, setIntent] = useState<string>('')
  const [region, setRegion] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [beds, setBeds] = useState<string>('')
  const [query, setQuery] = useState<string>('')

  function handleSearch() {
    const sp = new URLSearchParams()
    if (intent) sp.set('intent', intent)
    if (region) sp.set('mohafazat', region)
    if (type) sp.set('unitKind', type)
    if (beds) sp.set('minBedrooms', beds)
    if (query.trim()) sp.set('search', query.trim())
    sp.set('status', 'ACTIVE')
    router.push(`/listings?${sp.toString()}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  const selectCls =
    'w-full appearance-none bg-white border border-zinc-200 rounded-lg px-3 py-2.5 pr-8 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 cursor-pointer'

  return (
    <section className="relative overflow-hidden w-full" style={{ minHeight: '380px' }}>
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-700" />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v1H0zM0 0v60h1V0z' fill='%23ffffff'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Bottom fade — blends into the white listings section */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />

      <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-14 sm:pb-20">
        {/* Eyebrow */}
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/50 mb-4">
          Lebanon Real Estate
        </p>

        {/* Headline */}
        <h1 className="text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight mb-8 max-w-2xl">
          Find Your Next{' '}
          <span className="text-zinc-300">Property</span>{' '}
          in Lebanon
        </h1>

        {/* Search card */}
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Intent tabs — sits flush at the top of the card */}
          <div className="flex border-b border-zinc-100">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setIntent(opt.value)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  intent === opt.value
                    ? 'text-zinc-900 border-b-2 border-sky-600 bg-white'
                    : 'text-zinc-500 hover:text-zinc-700 bg-zinc-50/60 hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="p-4 sm:p-5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Region */}
              <div className="relative">
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectCls}>
                  {REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              {/* Type */}
              <div className="relative">
                <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              {/* Beds */}
              <div className="relative">
                <select value={beds} onChange={(e) => setBeds(e.target.value)} className={selectCls}>
                  {BEDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              {/* Keyword */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="City, area…"
                  className="w-full bg-white border border-zinc-200 rounded-lg pl-9 pr-3 py-2.5 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500"
                />
              </div>
            </div>

            {/* Search button */}
            <button
              onClick={handleSearch}
              className="w-full h-11 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-sm font-bold rounded-xl transition-colors"
            >
              <Search className="w-4 h-4" />
              Search Properties
            </button>
          </div>
        </div>

        {/* AI search link */}
        <div className="mt-5">
          <Link
            href="/ai-search"
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Try AI-powered search
          </Link>
        </div>
      </div>
    </section>
  )
}
