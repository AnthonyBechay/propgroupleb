'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { PropertyCard } from '@/components/PropertyCard'
import { PropertyFilters } from '@/components/properties/PropertyFilters'
import { PropertySort } from '@/components/properties/PropertySort'
import { PropertyGridSkeleton } from '@/components/properties/PropertyGridSkeleton'

// AI search is only shown when the filter banner indicates a q/goal/budget —
// defer its bundle (chat state, markdown, icons) until that banner renders.
const AIPropertySearch = dynamic(
  () => import('@/components/ai/AIPropertySearch').then(m => ({ default: m.AIPropertySearch })),
  { ssr: false, loading: () => null },
)
import {
  Filter,
  X,
  Sparkles,
  TrendingUp,
  Globe,
  Search,
  Bot
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Property {
  id: string
  title: string
  description: string
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  area: number
  city?: string
  country: string
  status: string
  propertyType?: string
  images: string[]
  isGoldenVisaEligible?: boolean
  investmentData?: {
    expectedROI?: number | null
    rentalYield?: number | null
    capitalGrowth?: number | null
  }
  favoriteProperties?: any[]
}

export function PropertiesClient({
  initialProperties,
  searchParams: serverSearchParams
}: {
  initialProperties: Property[]
  searchParams: any
}) {
  const router = useRouter()
  const urlSearchParams = useSearchParams()
  const [properties, setProperties] = useState(initialProperties)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showAISearch, setShowAISearch] = useState(false)

  // Read live URL params — keeps filter results reactive without a server roundtrip.
  // Falls back to the server-rendered params on first paint before hydration.
  const liveParams = useMemo(() => {
    const out: Record<string, string> = { ...serverSearchParams }
    urlSearchParams.forEach((v, k) => { out[k] = v })
    return out
  }, [urlSearchParams, serverSearchParams])

  const filteredProperties = useMemo(() => {
    let filtered = [...initialProperties]

    // `ids` is set by the AI search when "View properties" is clicked — it
    // pins the listing to exactly the properties the AI semantically matched.
    // Must run before the broad filters so sort order is preserved.
    if (liveParams.ids) {
      const wanted = new Set(liveParams.ids.split(',').filter(Boolean))
      if (wanted.size > 0) {
        filtered = filtered.filter(p => wanted.has(p.id))
      }
    }

    if (liveParams.country) {
      filtered = filtered.filter(p =>
        p.country.toLowerCase() === liveParams.country.toLowerCase()
      )
    }

    if (liveParams.status) {
      filtered = filtered.filter(p =>
        p.status.toLowerCase() === liveParams.status.toLowerCase()
      )
    }

    if (liveParams.minPrice) {
      filtered = filtered.filter(p => p.price >= parseInt(liveParams.minPrice))
    }

    if (liveParams.maxPrice) {
      filtered = filtered.filter(p => p.price <= parseInt(liveParams.maxPrice))
    }

    if (liveParams.goal === 'GOLDEN_VISA' || liveParams.isGoldenVisaEligible === 'true') {
      filtered = filtered.filter(p => p.isGoldenVisaEligible)
    }

    if (liveParams.city) {
      const needle = liveParams.city.toLowerCase()
      filtered = filtered.filter(p => (p.city || '').toLowerCase().includes(needle))
    }

    if (liveParams.propertyType) {
      filtered = filtered.filter(p =>
        p.propertyType?.toLowerCase() === liveParams.propertyType.toLowerCase()
      )
    }

    if (liveParams.bedrooms) {
      const minBd = parseInt(liveParams.bedrooms)
      filtered = filtered.filter(p => (p.bedrooms ?? 0) >= minBd)
    }

    if (liveParams.minArea) {
      const minA = parseFloat(liveParams.minArea)
      filtered = filtered.filter(p => (p.area ?? 0) >= minA)
    }
    if (liveParams.maxArea) {
      const maxA = parseFloat(liveParams.maxArea)
      filtered = filtered.filter(p => (p.area ?? 0) <= maxA)
    }

    if (liveParams.highRoi === 'true') {
      filtered = filtered.filter(p => (p.investmentData?.expectedROI ?? 0) >= 15)
    }

    if (liveParams.sort) {
      switch (liveParams.sort) {
        case 'price-asc':
          filtered.sort((a, b) => a.price - b.price)
          break
        case 'price-desc':
          filtered.sort((a, b) => b.price - a.price)
          break
        case 'roi-desc':
          filtered.sort((a, b) =>
            (b.investmentData?.expectedROI || 0) - (a.investmentData?.expectedROI || 0)
          )
          break
        case 'area-desc':
          filtered.sort((a, b) => b.area - a.area)
          break
      }
    }

    return filtered
  }, [initialProperties, liveParams])

  // Update URL in-place without triggering a server roundtrip.
  // `window.history.replaceState` in Next.js 15 App Router is honored by
  // `useSearchParams()`, so the filtered list updates instantly (no skeleton,
  // no scroll jump, no full page reload).
  const writeUrl = (params: URLSearchParams) => {
    const qs = params.toString()
    const url = qs ? `/properties?${qs}` : '/properties'
    window.history.replaceState(null, '', url)
    // Force React to re-read useSearchParams on the next tick.
    // Next.js rebinds useSearchParams when history changes; dispatching popstate
    // ensures any external listeners also sync.
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleFilterChange = (filters: any) => {
    const params = new URLSearchParams(urlSearchParams.toString())

    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params.set(key, filters[key])
      } else {
        params.delete(key)
      }
    })

    writeUrl(params)
  }

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(urlSearchParams.toString())
    params.set('sort', sort)
    writeUrl(params)
  }

  const clearFilters = () => {
    writeUrl(new URLSearchParams())
  }

  const activeFiltersCount = Object.keys(liveParams).filter(
    key => key !== 'sort' && liveParams[key]
  ).length

  return (
    <div className="min-h-screen bg-white">
      {/* Compact Hero Section */}
      <section className="relative py-6 sm:py-8 bg-[#1B3A5C] text-white overflow-hidden">
        <div className="pg-container max-w-7xl mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#C49A2E]" />
              <span className="text-white/80">CURATED PROJECTS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-2">
              <span className="text-white">Premium Investment </span>
              <span className="text-[#C49A2E]">Projects</span>
            </h1>
            <p className="text-sm sm:text-base text-white/70 mb-4 max-w-2xl mx-auto">
              Hand-picked opportunities with verified returns
            </p>

            <div className="text-xl sm:text-2xl font-bold text-white">
              {filteredProperties.length} <span className="text-sm font-normal text-white/60">projects available</span>
            </div>
          </div>
        </div>
      </section>

      <div className="pg-container max-w-7xl mx-auto py-6 sm:py-8">
        {/* AI Search Banner - More Compact */}
        {!showAISearch && (
          <div className="mb-6 p-4 bg-[#1B3A5C] rounded-xl text-white shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-white">AI-Powered Search</h3>
                    <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-semibold bg-[#C49A2E] text-white rounded-full">
                      NEW
                    </span>
                  </div>
                  <p className="text-xs text-white/70">
                    Describe what you want in plain English
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowAISearch(true)}
                className="bg-[#C49A2E] hover:bg-[#A98327] text-white rounded-lg shadow-md transition-all flex-shrink-0"
                size="sm"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Try Now
              </Button>
            </div>
          </div>
        )}

        {/* AI Search Interface - Compact */}
        {showAISearch && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  AI Property Search
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAISearch(false)}
                  className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <AIPropertySearch variant="inline" />
            </div>
          </div>
        )}

        {/* Toolbar - Compact */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* AI Search button */}
            {!showAISearch && (
              <Button
                onClick={() => setShowAISearch(true)}
                className="bg-[#1B3A5C] hover:bg-[#24507D] text-white border-0 shadow-md"
              >
                <Bot className="w-4 h-4 mr-2" />
                AI Search
              </Button>
            )}

            {/* Filter button */}
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className={`relative border-2 shadow-sm ${
                showFilters
                  ? 'bg-[#1B3A5C] text-white border-[#1B3A5C] hover:bg-[#24507D]'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#C49A2E] text-white text-xs rounded-full flex items-center justify-center font-bold shadow-md">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            {/* Active filters */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          {/* Sort dropdown */}
          <PropertySort
            value={liveParams.sort || 'newest'}
            onChange={handleSortChange}
          />
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-2">
            <PropertyFilters
              filters={liveParams}
              onChange={handleFilterChange}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* Results summary */}
        {(liveParams.q || liveParams.goal || liveParams.budget) && (
          <div className="mb-4 p-4 bg-[#E0EDF7] border border-[#1B3A5C]/20 rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center shrink-0">
                  {liveParams.q ? <Bot className="w-4 h-4 text-white" /> : <Search className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {liveParams.q ? 'AI Search Results' : 'Search Results'}
                    {liveParams.q && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#C49A2E]/10 text-[#C49A2E] rounded-full">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                      </span>
                    )}
                  </span>
                  {liveParams.q && (
                    <p className="text-xs text-slate-600 mt-0.5">&quot;{liveParams.q}&quot;</p>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-slate-700 bg-white px-3 py-1.5 rounded-md">
                <span className="font-bold text-[#1B3A5C]">{filteredProperties.length}</span> found
                {liveParams.goal && ` for ${liveParams.goal.replace('_', ' ').toLowerCase()}`}
                {liveParams.budget && ` under $${parseInt(liveParams.budget).toLocaleString()}`}
              </span>
            </div>
          </div>
        )}

        {/* Content - Properties Grid */}
        {loading ? (
          <PropertyGridSkeleton />
        ) : (
          filteredProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property: Property, index: number) => (
                <div
                  key={property.id}
                  className="fade-in"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
                  <PropertyCard
                    id={property.id}
                    title={property.title}
                    description={property.description}
                    price={property.price}
                    currency={property.currency}
                    bedrooms={property.bedrooms}
                    bathrooms={property.bathrooms}
                    area={property.area}
                    country={property.country.toLowerCase()}
                    status={property.status}
                    images={property.images}
                    isGoldenVisaEligible={property.isGoldenVisaEligible}
                    investmentData={{
                      expectedROI: property.investmentData?.expectedROI,
                      rentalYield: property.investmentData?.rentalYield,
                      capitalGrowth: property.investmentData?.capitalGrowth,
                    }}
                    isFavorited={property.favoriteProperties?.length ? property.favoriteProperties.length > 0 : false}
                    featured={index < 3}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">
                  No projects found
                </h3>
                <p className="text-sm text-slate-600 mb-6">
                  Try adjusting your filters or search criteria
                </p>
                <Button
                  onClick={clearFilters}
                  className="bg-[#1B3A5C] hover:bg-[#24507D] text-white rounded-lg shadow-md px-6"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  View All Properties
                </Button>
              </div>
            </div>
          )
        )}

        {/* Load more button - Compact */}
        {filteredProperties.length > 0 && filteredProperties.length % 9 === 0 && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              className="min-w-[180px] border-2 border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white font-semibold rounded-lg shadow-sm transition-all"
            >
              Load More Properties
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
