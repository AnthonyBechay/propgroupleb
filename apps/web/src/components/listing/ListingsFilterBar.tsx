'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Search, Sparkles, X, Loader2, ArrowRight } from 'lucide-react'
import { ListingIntent } from '@/types'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { track } from '@/lib/analytics'

const MOHAFAZAT_LABELS: Record<string, string> = {
  BEIRUT: 'Beirut', MOUNT_LEBANON: 'Mount Lebanon', NORTH: 'North Lebanon',
  SOUTH: 'South Lebanon', BEKAA: 'Bekaa', NABATIEH: 'Nabatieh',
  AKKAR: 'Akkar', BAALBEK_HERMEL: 'Baalbek-Hermel',
}
const KIND_LABELS: Record<string, string> = {
  APARTMENT: 'Apartment', STUDIO: 'Studio', DUPLEX: 'Duplex', PENTHOUSE: 'Penthouse',
  VILLA: 'Villa', TOWNHOUSE: 'Townhouse', SHOP: 'Shop', OFFICE: 'Office',
  LAND_PARCEL: 'Land', STORAGE: 'Storage', PARKING: 'Parking',
}

interface Facets {
  mohafazat: string[]
  cities: string[]
  kinds: string[]
  priceMin: number
  priceMax: number
  bedroomsMax: number
}

// Catalog filter params the AI parser can populate.
const AI_PARAM_KEYS = ['intent', 'kind', 'mohafazat', 'city', 'minPrice', 'maxPrice', 'minBeds', 'sortBy', 'sortOrder'] as const

export function ListingsFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  const intent = searchParams.get('intent') ?? ''
  const mohafazat = searchParams.get('mohafazat') ?? ''
  const city = searchParams.get('city') ?? ''
  const unitKind = searchParams.get('kind') ?? ''
  const minPrice = searchParams.get('minPrice') ?? ''
  const maxPrice = searchParams.get('maxPrice') ?? ''
  const minBedrooms = searchParams.get('minBeds') ?? ''
  const search = searchParams.get('search') ?? ''
  const sortBy = searchParams.get('sortBy') ?? ''
  const sortOrder = searchParams.get('sortOrder') ?? ''
  const sortValue = sortBy ? `${sortBy}:${sortOrder || 'desc'}` : ''

  const hasFilters = !!(intent || mohafazat || city || unitKind || minBedrooms || minPrice || maxPrice || search || sortBy)

  // ── DB-driven facets ──────────────────────────────────────────────────────
  const [facets, setFacets] = useState<Facets | null>(null)
  useEffect(() => {
    fetch(`${apiBase}/api/listings/facets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setFacets(j?.data ?? j ?? null))
      .catch(() => {})
  }, [apiBase])

  // ── AI inline box ─────────────────────────────────────────────────────────
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  // Debounced text/number inputs. Typing must not navigate on every keystroke —
  // that refetched the catalog per character and made the cursor jump. We keep a
  // local draft and push to the URL after a short pause.
  const [searchDraft, setSearchDraft] = useState(search)
  const [minPriceDraft, setMinPriceDraft] = useState(minPrice)
  const [maxPriceDraft, setMaxPriceDraft] = useState(maxPrice)
  // Re-sync drafts when the URL changes from elsewhere (Clear all, AI search, back/forward).
  useEffect(() => { setSearchDraft(search) }, [search])
  useEffect(() => { setMinPriceDraft(minPrice) }, [minPrice])
  useEffect(() => { setMaxPriceDraft(maxPrice) }, [maxPrice])

  useEffect(() => {
    fetch(`${apiBase}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const v = (j?.data ?? j)?.aiSearchEnabled; if (typeof v === 'boolean') setAiEnabled(v) })
      .catch(() => {})
  }, [apiBase])

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const updateSort = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        const [by, order] = value.split(':')
        params.set('sortBy', by)
        params.set('sortOrder', order)
      } else {
        params.delete('sortBy')
        params.delete('sortOrder')
      }
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  // Push debounced drafts to the URL 400ms after the user stops typing.
  useEffect(() => {
    if (searchDraft === search) return
    const t = setTimeout(() => updateParam('search', searchDraft), 400)
    return () => clearTimeout(t)
  }, [searchDraft, search, updateParam])
  useEffect(() => {
    if (minPriceDraft === minPrice) return
    const t = setTimeout(() => updateParam('minPrice', minPriceDraft), 500)
    return () => clearTimeout(t)
  }, [minPriceDraft, minPrice, updateParam])
  useEffect(() => {
    if (maxPriceDraft === maxPrice) return
    const t = setTimeout(() => updateParam('maxPrice', maxPriceDraft), 500)
    return () => clearTimeout(t)
  }, [maxPriceDraft, maxPrice, updateParam])

  function clearAll() {
    setAiSummary(null)
    setAiQuery('')
    setAiOpen(false)
    setSearchDraft('')
    setMinPriceDraft('')
    setMaxPriceDraft('')
    router.push(pathname)
  }

  async function runAiSearch() {
    const q = aiQuery.trim()
    if (!q || aiLoading) return
    setAiLoading(true)
    setAiSummary(null)
    track('search', { meta: { query: q, source: 'inline' } })
    try {
      const res = await fetch(`${apiBase}/api/ai-search/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const json = await res.json()
      const data = json?.data ?? json
      const filters = (data?.filters ?? {}) as Record<string, unknown>
      // Apply parsed filters to the catalog URL → results render in the normal grid.
      const params = new URLSearchParams()
      for (const k of AI_PARAM_KEYS) {
        const v = filters[k]
        if (v !== null && v !== undefined && v !== '') params.set(k, String(v))
      }
      if (params.toString()) {
        setAiSummary(data?.summary || 'Here’s what I found:')
        router.push(`${pathname}?${params.toString()}`)
      } else {
        // AI returned no usable filters (unavailable, or it couldn't parse the
        // request). Don't wipe the user's current filters — just explain.
        setAiSummary(data?.summary || 'Sorry, I couldn’t turn that into filters — try rephrasing, or use the filters below.')
      }
    } catch {
      setAiSummary('AI search is unavailable right now — please try the filters below.')
    } finally {
      setAiLoading(false)
    }
  }

  const inputCls = 'h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500 bg-white'

  const regionOpts = facets?.mohafazat ?? Object.keys(MOHAFAZAT_LABELS)
  const cityOpts = facets?.cities ?? []
  const kindOpts = facets?.kinds ?? Object.keys(KIND_LABELS)
  const maxBeds = facets?.bedroomsMax && facets.bedroomsMax > 0 ? Math.min(facets.bedroomsMax, 6) : 4

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-lg">
      {/* Top row: intent tabs + Try AI */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-fit">
          {[['', 'All'], [ListingIntent.FOR_SALE, 'For Sale'], [ListingIntent.FOR_RENT, 'For Rent']].map(([val, label]) => (
            <button
              key={label}
              onClick={() => updateParam('intent', val)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                intent === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {aiEnabled && (
          <button
            type="button"
            onClick={() => setAiOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-colors ${
              aiOpen ? 'bg-slate-900 text-white' : 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Try AI search
          </button>
        )}
      </div>

      {/* AI inline panel */}
      {aiOpen && aiEnabled && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 pointer-events-none" />
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runAiSearch() }}
                placeholder="e.g. 2-bed apartment in Beirut under $200k with a sea view"
                className="w-full pl-9 pr-3 h-10 text-sm border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={runAiSearch}
              disabled={aiLoading || !aiQuery.trim()}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Search
            </button>
          </div>
          {aiSummary && (
            <div className="text-sm text-slate-700 bg-white border border-violet-200 rounded-lg px-3 py-2">
              {aiSummary}
            </div>
          )}
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or location…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className={`${inputCls} w-full pl-9`}
          />
        </div>

        <select value={mohafazat} onChange={(e) => updateParam('mohafazat', e.target.value)} className={inputCls}>
          <option value="">All Regions</option>
          {regionOpts.map((v) => <option key={v} value={v}>{MOHAFAZAT_LABELS[v] ?? v}</option>)}
        </select>

        {cityOpts.length > 0 && (
          <select value={city} onChange={(e) => updateParam('city', e.target.value)} className={inputCls}>
            <option value="">All Cities</option>
            {cityOpts.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        )}

        <select value={unitKind} onChange={(e) => updateParam('kind', e.target.value)} className={inputCls}>
          <option value="">All Types</option>
          {kindOpts.map((v) => <option key={v} value={v}>{KIND_LABELS[v] ?? v}</option>)}
        </select>

        <select value={minBedrooms} onChange={(e) => updateParam('minBeds', e.target.value)} className={inputCls}>
          <option value="">Any Beds</option>
          {Array.from({ length: maxBeds }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}+</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input type="number" placeholder={facets?.priceMin ? `Min $${facets.priceMin.toLocaleString()}` : 'Min $'} value={minPriceDraft} onChange={(e) => setMinPriceDraft(e.target.value)} className={`${inputCls} w-28`} />
          <span className="text-slate-400 text-sm">–</span>
          <input type="number" placeholder={facets?.priceMax ? `Max $${facets.priceMax.toLocaleString()}` : 'Max $'} value={maxPriceDraft} onChange={(e) => setMaxPriceDraft(e.target.value)} className={`${inputCls} w-28`} />
        </div>

        <select value={sortValue} onChange={(e) => updateSort(e.target.value)} className={inputCls}>
          <option value="">Sort: Newest</option>
          <option value="price:asc">Price: Low → High</option>
          <option value="price:desc">Price: High → Low</option>
        </select>

        {(hasFilters || aiSummary) && (
          <button
            onClick={clearAll}
            className="h-9 px-3 text-sm text-slate-500 hover:text-slate-900 flex items-center gap-1.5 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
