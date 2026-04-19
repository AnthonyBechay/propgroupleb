'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PropertyCard } from '@/components/PropertyCard'
import { PropertyFilters } from '@/components/properties/PropertyFilters'
import { PropertySort } from '@/components/properties/PropertySort'
import { PropertyGridSkeleton } from '@/components/properties/PropertyGridSkeleton'
import { MapView } from '@/components/properties/MapView'
import { AIPropertySearch } from '@/components/ai/AIPropertySearch'
import {
  Grid3x3,
  Map,
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
  searchParams
}: {
  initialProperties: Property[]
  searchParams: any
}) {
  const router = useRouter()
  const urlSearchParams = useSearchParams()
  const [properties, setProperties] = useState(initialProperties)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [showAISearch, setShowAISearch] = useState(false)
  const filteredProperties = useMemo(() => {
    let filtered = [...initialProperties]

    if (searchParams.country) {
      filtered = filtered.filter(p =>
        p.country.toLowerCase() === searchParams.country.toLowerCase()
      )
    }

    if (searchParams.status) {
      filtered = filtered.filter(p =>
        p.status.toLowerCase() === searchParams.status.toLowerCase()
      )
    }

    if (searchParams.minPrice) {
      filtered = filtered.filter(p => p.price >= parseInt(searchParams.minPrice))
    }

    if (searchParams.maxPrice) {
      filtered = filtered.filter(p => p.price <= parseInt(searchParams.maxPrice))
    }

    if (searchParams.goal === 'GOLDEN_VISA' || searchParams.isGoldenVisaEligible === 'true') {
      filtered = filtered.filter(p => p.isGoldenVisaEligible)
    }

    if (searchParams.city) {
      const needle = searchParams.city.toLowerCase()
      filtered = filtered.filter(p => (p.city || '').toLowerCase().includes(needle))
    }

    if (searchParams.propertyType) {
      filtered = filtered.filter(p =>
        p.propertyType?.toLowerCase() === searchParams.propertyType.toLowerCase()
      )
    }

    if (searchParams.bedrooms) {
      const minBd = parseInt(searchParams.bedrooms)
      filtered = filtered.filter(p => (p.bedrooms ?? 0) >= minBd)
    }

    if (searchParams.minArea) {
      const minA = parseFloat(searchParams.minArea)
      filtered = filtered.filter(p => (p.area ?? 0) >= minA)
    }
    if (searchParams.maxArea) {
      const maxA = parseFloat(searchParams.maxArea)
      filtered = filtered.filter(p => (p.area ?? 0) <= maxA)
    }

    if (searchParams.highRoi === 'true') {
      filtered = filtered.filter(p => (p.investmentData?.expectedROI ?? 0) >= 15)
    }

    if (searchParams.sort) {
      switch (searchParams.sort) {
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
  }, [initialProperties, searchParams])

  const handleFilterChange = (filters: any) => {
    const params = new URLSearchParams(urlSearchParams.toString())

    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params.set(key, filters[key])
      } else {
        params.delete(key)
      }
    })

    router.push(`/properties?${params.toString()}`)
  }

  const handleSortChange = (sort: string) => {
    const params = new URLSearchParams(urlSearchParams.toString())
    params.set('sort', sort)
    router.push(`/properties?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push('/properties')
  }

  const activeFiltersCount = Object.keys(searchParams).filter(
    key => key !== 'sort' && searchParams[key]
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

            {/* View mode toggle */}
            <div className="flex items-center bg-white rounded-lg shadow-sm border-2 border-slate-200">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`rounded-r-none ${
                  viewMode === 'grid'
                    ? 'bg-[#1B3A5C] text-white hover:bg-[#24507D]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('map')}
                className={`rounded-l-none ${
                  viewMode === 'map'
                    ? 'bg-[#1B3A5C] text-white hover:bg-[#24507D]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Map className="w-4 h-4" />
              </Button>
            </div>

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
            value={searchParams.sort || 'newest'}
            onChange={handleSortChange}
          />
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-2">
            <PropertyFilters
              filters={searchParams}
              onChange={handleFilterChange}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {/* Results summary */}
        {(searchParams.q || searchParams.goal || searchParams.budget) && (
          <div className="mb-4 p-4 bg-[#E0EDF7] border border-[#1B3A5C]/20 rounded-xl shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center shrink-0">
                  {searchParams.q ? <Bot className="w-4 h-4 text-white" /> : <Search className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {searchParams.q ? 'AI Search Results' : 'Search Results'}
                    {searchParams.q && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#C49A2E]/10 text-[#C49A2E] rounded-full">
                        <Sparkles className="w-2.5 h-2.5" />
                        AI
                      </span>
                    )}
                  </span>
                  {searchParams.q && (
                    <p className="text-xs text-slate-600 mt-0.5">&quot;{searchParams.q}&quot;</p>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-slate-700 bg-white px-3 py-1.5 rounded-md">
                <span className="font-bold text-[#1B3A5C]">{filteredProperties.length}</span> found
                {searchParams.goal && ` for ${searchParams.goal.replace('_', ' ').toLowerCase()}`}
                {searchParams.budget && ` under $${parseInt(searchParams.budget).toLocaleString()}`}
              </span>
            </div>
          </div>
        )}

        {/* Content - Properties Grid */}
        {loading ? (
          <PropertyGridSkeleton />
        ) : viewMode === 'grid' ? (
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
        ) : (
          <MapView properties={filteredProperties} />
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
