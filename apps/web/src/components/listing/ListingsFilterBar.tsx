'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import Link from 'next/link'
import { Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { UnitKind, ListingIntent } from '@/types'

const MOHAFAZAT_OPTIONS = [
  { value: '', label: 'All Regions' },
  { value: 'BEIRUT', label: 'Beirut' },
  { value: 'MOUNT_LEBANON', label: 'Mount Lebanon' },
  { value: 'NORTH', label: 'North Lebanon' },
  { value: 'SOUTH', label: 'South Lebanon' },
  { value: 'BEKAA', label: 'Bekaa' },
  { value: 'NABATIEH', label: 'Nabatieh' },
  { value: 'AKKAR', label: 'Akkar' },
  { value: 'BAALBEK_HERMEL', label: 'Baalbek-Hermel' },
]

const UNIT_KIND_OPTIONS: { value: UnitKind | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: UnitKind.APARTMENT, label: 'Apartment' },
  { value: UnitKind.VILLA, label: 'Villa' },
  { value: UnitKind.PENTHOUSE, label: 'Penthouse' },
  { value: UnitKind.DUPLEX, label: 'Duplex' },
  { value: UnitKind.STUDIO, label: 'Studio' },
  { value: UnitKind.OFFICE, label: 'Office' },
  { value: UnitKind.SHOP, label: 'Shop' },
  { value: UnitKind.LAND_PARCEL, label: 'Land' },
]

const BEDROOMS_OPTIONS = [
  { value: '', label: 'Any Beds' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
]

export function ListingsFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // NOTE: param names must match the backend listings query (kind, minBeds) —
  // previously these were 'unitKind'/'minBedrooms', which the API ignored, so
  // the type and bedroom filters silently did nothing.
  const intent = searchParams.get('intent') ?? ''
  const mohafazat = searchParams.get('mohafazat') ?? ''
  const unitKind = searchParams.get('kind') ?? ''
  const minPrice = searchParams.get('minPrice') ?? ''
  const maxPrice = searchParams.get('maxPrice') ?? ''
  const minBedrooms = searchParams.get('minBeds') ?? ''
  const search = searchParams.get('search') ?? ''

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      // Reset to page 1 on filter change
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-lg">
      {/* Top row: intent tabs + "Try AI search" shortcut */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => updateParam('intent', '')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              !intent ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => updateParam('intent', ListingIntent.FOR_SALE)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              intent === ListingIntent.FOR_SALE ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            For Sale
          </button>
          <button
            onClick={() => updateParam('intent', ListingIntent.FOR_RENT)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              intent === ListingIntent.FOR_RENT ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            For Rent
          </button>
        </div>

        <Link
          href="/ai-search"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Try AI search
        </Link>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search listings…"
            value={search}
            onChange={(e) => updateParam('search', e.target.value)}
            className="w-full pl-9 pr-3 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500"
          />
        </div>

        {/* Region */}
        <select
          value={mohafazat}
          onChange={(e) => updateParam('mohafazat', e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white"
        >
          {MOHAFAZAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Unit kind */}
        <select
          value={unitKind}
          onChange={(e) => updateParam('kind', e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white"
        >
          {UNIT_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Bedrooms */}
        <select
          value={minBedrooms}
          onChange={(e) => updateParam('minBeds', e.target.value)}
          className="h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white"
        >
          {BEDROOMS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Price range */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => updateParam('minPrice', e.target.value)}
            className="w-24 h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500"
          />
          <span className="text-slate-400 text-sm">–</span>
          <input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => updateParam('maxPrice', e.target.value)}
            className="w-24 h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500"
          />
        </div>

        {/* Clear filters */}
        {(intent || mohafazat || unitKind || minBedrooms || minPrice || maxPrice || search) && (
          <button
            onClick={() => router.push(pathname)}
            className="h-9 px-3 text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1.5 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
