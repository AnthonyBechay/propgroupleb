'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Sparkles, X, Loader2, ArrowRight, SlidersHorizontal } from 'lucide-react'
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
  cazas: string[]
  cities: string[]
  kinds: string[]
  cazaRegion: Record<string, string>
  cityRegion: Record<string, string>
  priceMin: number
  priceMax: number
  bedroomsMax: number
}

interface FilterState {
  intent: string
  search: string
  mohafazat: string
  caza: string
  city: string
  kind: string
  minBeds: string
  minPrice: string
  maxPrice: string
  minArea: string
  maxArea: string
  sort: string // "" = newest, else "price:asc" | "price:desc"
}

const EMPTY: FilterState = {
  intent: '', search: '', mohafazat: '', caza: '', city: '', kind: '',
  minBeds: '', minPrice: '', maxPrice: '', minArea: '', maxArea: '', sort: '',
}

function parseFromParams(sp: URLSearchParams): FilterState {
  const by = sp.get('sortBy')
  return {
    intent: sp.get('intent') ?? '',
    search: sp.get('search') ?? '',
    mohafazat: sp.get('mohafazat') ?? '',
    caza: sp.get('caza') ?? '',
    city: sp.get('city') ?? '',
    kind: sp.get('kind') ?? '',
    minBeds: sp.get('minBeds') ?? '',
    minPrice: sp.get('minPrice') ?? '',
    maxPrice: sp.get('maxPrice') ?? '',
    minArea: sp.get('minArea') ?? '',
    maxArea: sp.get('maxArea') ?? '',
    sort: by ? `${by}:${sp.get('sortOrder') || 'desc'}` : '',
  }
}

function buildQuery(f: FilterState): string {
  const p = new URLSearchParams()
  if (f.intent) p.set('intent', f.intent)
  if (f.search.trim()) p.set('search', f.search.trim())
  if (f.mohafazat) p.set('mohafazat', f.mohafazat)
  if (f.caza) p.set('caza', f.caza)
  if (f.city) p.set('city', f.city)
  if (f.kind) p.set('kind', f.kind)
  if (f.minBeds) p.set('minBeds', f.minBeds)
  if (f.minPrice) p.set('minPrice', f.minPrice)
  if (f.maxPrice) p.set('maxPrice', f.maxPrice)
  if (f.minArea) p.set('minArea', f.minArea)
  if (f.maxArea) p.set('maxArea', f.maxArea)
  if (f.sort) { const [b, o] = f.sort.split(':'); p.set('sortBy', b); p.set('sortOrder', o) }
  p.sort()
  return p.toString()
}

// Catalog filter params the AI parser can populate.
const AI_PARAM_KEYS = ['intent', 'kind', 'mohafazat', 'city', 'minPrice', 'maxPrice', 'minBeds', 'sortBy', 'sortOrder'] as const

export function ListingsFilterBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const apiBase = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')

  // Single source of truth for the controls. Initialised from the URL ONCE.
  // The inputs are never driven off the (lagging) URL again, which is what made
  // the old search box stutter and "un-delete" characters.
  const [filters, setFilters] = useState<FilterState>(() => parseFromParams(new URLSearchParams(searchParams.toString())))
  const set = useCallback((patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch })), [])

  const [facets, setFacets] = useState<Facets | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // ── Push local filters to the URL (debounced) ──────────────────────────────
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    const target = buildQuery(filters)
    const t = setTimeout(() => {
      const cur = new URLSearchParams(window.location.search)
      cur.delete('page'); cur.sort()
      if (cur.toString() === target) return // already there (e.g. after a back/forward)
      router.push(target ? `${pathname}?${target}` : pathname, { scroll: false })
    }, 300)
    return () => clearTimeout(t)
  }, [filters, pathname, router])

  // Back/forward: adopt the URL into the controls (never during typing — only on popstate).
  useEffect(() => {
    const onPop = () => setFilters(parseFromParams(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // ── DB-driven facets ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${apiBase}/api/listings/facets`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setFacets(j?.data ?? j ?? null))
      .catch(() => {})
  }, [apiBase])

  // ── AI inline box ──────────────────────────────────────────────────────────
  const [aiEnabled, setAiEnabled] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${apiBase}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const v = (j?.data ?? j)?.aiSearchEnabled; if (typeof v === 'boolean') setAiEnabled(v) })
      .catch(() => {})
  }, [apiBase])

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
      const parsed = (data?.filters ?? {}) as Record<string, unknown>
      const clean: Record<string, string> = {}
      for (const k of AI_PARAM_KEYS) {
        const v = parsed[k]
        if (v !== null && v !== undefined && v !== '') clean[k] = String(v)
      }
      if (Object.keys(clean).length) {
        // Reflect the AI's picks in the controls (which pushes them to the URL).
        setFilters((f) => ({
          ...f,
          intent: clean.intent ?? f.intent,
          kind: clean.kind ?? f.kind,
          mohafazat: clean.mohafazat ?? f.mohafazat,
          city: clean.city ?? f.city,
          minPrice: clean.minPrice ?? f.minPrice,
          maxPrice: clean.maxPrice ?? f.maxPrice,
          minBeds: clean.minBeds ?? f.minBeds,
          sort: clean.sortBy ? `${clean.sortBy}:${clean.sortOrder || 'desc'}` : f.sort,
        }))
        setAiSummary(data?.summary || 'Here’s what I found:')
      } else {
        setAiSummary(data?.summary || 'Sorry, I couldn’t turn that into filters — try rephrasing, or use the filters below.')
      }
    } catch {
      setAiSummary('AI search is unavailable right now — please try the filters below.')
    } finally {
      setAiLoading(false)
    }
  }

  function clearAll() {
    setAiSummary(null)
    setAiQuery('')
    setAiOpen(false)
    setFilters(EMPTY)
  }

  // ── Options (cascade district/city to the chosen region) ───────────────────
  const regionOpts = facets?.mohafazat ?? Object.keys(MOHAFAZAT_LABELS)
  const cazaOpts = useMemo(() => {
    const all = facets?.cazas ?? []
    return filters.mohafazat ? all.filter((c) => (facets?.cazaRegion?.[c] ?? '') === filters.mohafazat) : all
  }, [facets, filters.mohafazat])
  const cityOpts = useMemo(() => {
    const all = facets?.cities ?? []
    return filters.mohafazat ? all.filter((c) => (facets?.cityRegion?.[c] ?? '') === filters.mohafazat) : all
  }, [facets, filters.mohafazat])
  const kindOpts = facets?.kinds ?? Object.keys(KIND_LABELS)
  const maxBeds = facets?.bedroomsMax && facets.bedroomsMax > 0 ? Math.min(facets.bedroomsMax, 6) : 4

  // ── Active-filter chips (everything except the free-text search) ────────────
  const chips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = []
    if (filters.intent) out.push({ key: 'intent', label: filters.intent === 'FOR_SALE' ? 'For Sale' : 'For Rent', clear: () => set({ intent: '' }) })
    if (filters.mohafazat) out.push({ key: 'mohafazat', label: MOHAFAZAT_LABELS[filters.mohafazat] ?? filters.mohafazat, clear: () => set({ mohafazat: '', caza: '', city: '' }) })
    if (filters.caza) out.push({ key: 'caza', label: filters.caza, clear: () => set({ caza: '' }) })
    if (filters.city) out.push({ key: 'city', label: filters.city, clear: () => set({ city: '' }) })
    if (filters.kind) out.push({ key: 'kind', label: KIND_LABELS[filters.kind] ?? filters.kind, clear: () => set({ kind: '' }) })
    if (filters.minBeds) out.push({ key: 'minBeds', label: `${filters.minBeds}+ beds`, clear: () => set({ minBeds: '' }) })
    if (filters.minPrice || filters.maxPrice) out.push({ key: 'price', label: `$${filters.minPrice || '0'}–${filters.maxPrice || '∞'}`, clear: () => set({ minPrice: '', maxPrice: '' }) })
    if (filters.minArea || filters.maxArea) out.push({ key: 'area', label: `${filters.minArea || '0'}–${filters.maxArea || '∞'} m²`, clear: () => set({ minArea: '', maxArea: '' }) })
    return out
  }, [filters, set])

  const panelCount = chips.length - (filters.intent ? 1 : 0) // filters shown in the panel (intent is its own control)
  const anyActive = chips.length > 0 || !!filters.search || !!filters.sort

  const selCls = 'h-11 w-full px-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500'
  const numCls = 'h-11 w-full px-2.5 text-base sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500'
  const fieldLbl = 'block text-[11px] font-medium text-slate-500 mb-1'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-lg space-y-3">
      {/* Search + AI */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            placeholder="Search area, project or keyword…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="w-full h-12 pl-11 pr-9 text-base sm:text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600/15 focus:border-sky-500"
          />
          {filters.search && (
            <button type="button" onClick={() => set({ search: '' })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {aiEnabled && (
          <button
            type="button"
            onClick={() => setAiOpen((o) => !o)}
            className={`shrink-0 inline-flex items-center gap-1.5 h-12 px-3.5 rounded-xl text-sm font-medium shadow-sm transition-colors ${
              aiOpen ? 'bg-slate-900 text-white' : 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI search</span>
          </button>
        )}
      </div>

      {/* AI panel */}
      {aiOpen && aiEnabled && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 pointer-events-none" />
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runAiSearch() }}
                placeholder="e.g. 2-bed apartment in Beirut under $200k"
                className="w-full pl-9 pr-3 h-11 text-base sm:text-sm border border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={runAiSearch}
              disabled={aiLoading || !aiQuery.trim()}
              className="inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Search
            </button>
          </div>
          {aiSummary && (
            <div className="text-sm text-slate-700 bg-white border border-violet-200 rounded-lg px-3 py-2">{aiSummary}</div>
          )}
        </div>
      )}

      {/* Intent tabs + mobile "Filters" toggle */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 sm:flex-none sm:w-fit gap-1 bg-slate-100 rounded-xl p-1">
          {[['', 'All'], [ListingIntent.FOR_SALE, 'Buy'], [ListingIntent.FOR_RENT, 'Rent']].map(([val, label]) => (
            <button
              key={label}
              onClick={() => set({ intent: val })}
              className={`flex-1 sm:flex-none sm:px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                filters.intent === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="sm:hidden shrink-0 inline-flex items-center gap-1.5 h-11 px-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {panelCount > 0 && <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-600 text-white text-[10px] font-bold">{panelCount}</span>}
        </button>
      </div>

      {/* Filter fields — always visible on sm+, toggle on mobile */}
      <div className={`${panelOpen ? 'grid' : 'hidden'} sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5`}>
        <div>
          <label className={fieldLbl}>Region</label>
          <select value={filters.mohafazat} onChange={(e) => set({ mohafazat: e.target.value, caza: '', city: '' })} className={selCls}>
            <option value="">All regions</option>
            {regionOpts.map((v) => <option key={v} value={v}>{MOHAFAZAT_LABELS[v] ?? v}</option>)}
          </select>
        </div>

        {cazaOpts.length > 0 && (
          <div>
            <label className={fieldLbl}>District</label>
            <select value={filters.caza} onChange={(e) => set({ caza: e.target.value })} className={selCls}>
              <option value="">All districts</option>
              {cazaOpts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        {cityOpts.length > 0 && (
          <div>
            <label className={fieldLbl}>City / Town</label>
            <select value={filters.city} onChange={(e) => set({ city: e.target.value })} className={selCls}>
              <option value="">All cities</option>
              {cityOpts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={fieldLbl}>Type</label>
          <select value={filters.kind} onChange={(e) => set({ kind: e.target.value })} className={selCls}>
            <option value="">All types</option>
            {kindOpts.map((v) => <option key={v} value={v}>{KIND_LABELS[v] ?? v}</option>)}
          </select>
        </div>

        <div>
          <label className={fieldLbl}>Bedrooms</label>
          <select value={filters.minBeds} onChange={(e) => set({ minBeds: e.target.value })} className={selCls}>
            <option value="">Any</option>
            {Array.from({ length: maxBeds }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className={fieldLbl}>Price ($)</label>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" placeholder="Min" value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value })} className={numCls} />
            <span className="text-slate-300">–</span>
            <input type="number" inputMode="numeric" placeholder="Max" value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} className={numCls} />
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className={fieldLbl}>Area (m²)</label>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" placeholder="Min" value={filters.minArea} onChange={(e) => set({ minArea: e.target.value })} className={numCls} />
            <span className="text-slate-300">–</span>
            <input type="number" inputMode="numeric" placeholder="Max" value={filters.maxArea} onChange={(e) => set({ maxArea: e.target.value })} className={numCls} />
          </div>
        </div>

        <div>
          <label className={fieldLbl}>Sort by</label>
          <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className={selCls}>
            <option value="">Newest</option>
            <option value="price:asc">Price: Low → High</option>
            <option value="price:desc">Price: High → Low</option>
          </select>
        </div>
      </div>

      {/* Active chips */}
      {(chips.length > 0 || anyActive) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {chips.map((c) => (
            <button key={c.key} onClick={c.clear} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-xs font-medium hover:bg-sky-100">
              {c.label}
              <X className="w-3 h-3" />
            </button>
          ))}
          {anyActive && (
            <button onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium">
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
