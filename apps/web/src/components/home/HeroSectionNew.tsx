'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const INTENT_OPTIONS = [
  { label: 'All Properties', value: '' },
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

  return (
    <section className="relative flex flex-col justify-center overflow-hidden w-full" style={{ minHeight: '340px' }}>
      {/* Dark charcoal background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1.5' fill='%23ffffff'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Bottom fade to white — connects visually to the listings grid below */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 w-full max-w-5xl">
        {/* Brand pill */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
            <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">
              Lebanon Real Estate Brokerage
            </span>
          </div>
        </div>

        {/* H1 */}
        <h1 className="text-center text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-6">
          Find Your Next Property in Lebanon
        </h1>

        {/* Search card */}
        <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-5 max-w-4xl mx-auto">
          {/* Intent toggle pills */}
          <div className="flex gap-2 mb-4">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setIntent(opt.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  intent === opt.value
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {/* Region */}
            <div className="relative">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Type */}
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Beds */}
            <div className="relative">
              <select
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              >
                {BEDS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Text search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Keyword..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              />
            </div>
          </div>

          {/* Search button */}
          <Button
            onClick={handleSearch}
            className="w-full h-11 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors"
          >
            <Search className="w-4 h-4 mr-2" />
            Search Properties
          </Button>
        </div>

        {/* AI search subtle link */}
        <div className="flex justify-center mt-4">
          <Link
            href="/ai-search"
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Try AI Search
            <span className="text-white/30">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
