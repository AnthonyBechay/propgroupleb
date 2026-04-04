'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PropertyCard } from '@/components/PropertyCard'
import {
  Search,
  Sparkles,
  Send,
  X,
  Loader2,
  TrendingUp,
  Home,
  DollarSign,
  MapPin,
  Bot,
  MessageSquare,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  filters?: PropertyFilters
  count?: number
  properties?: Property[]
  aiPowered?: boolean
}

interface PropertyFilters {
  country?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  minBedrooms?: number
  maxBedrooms?: number
  bathrooms?: number
  goal?: string
  status?: string
  propertyType?: string
  isGoldenVisaEligible?: boolean
  [key: string]: unknown
}

interface Property {
  id: string
  title: string
  description: string
  price: number
  currency: string
  bedrooms: number
  bathrooms: number
  area: number
  country: string
  status: string
  images: string[]
  isGoldenVisaEligible?: boolean
  investmentData?: {
    expectedROI?: number | null
    rentalYield?: number | null
    capitalGrowth?: number | null
  }
  favoriteProperties?: any[]
}

interface AIPropertySearchProps {
  variant?: 'inline' | 'modal' | 'page'
  onSearch?: (filters: PropertyFilters) => void
  placeholder?: string
}

const quickSuggestions = [
  { icon: Home, text: '2-bedroom apartment in Batumi under $100k' },
  { icon: TrendingUp, text: 'High ROI properties above 12%' },
  { icon: DollarSign, text: 'Affordable apartments under $50k' },
  { icon: MapPin, text: 'Beachfront properties with sea views' },
]

export function AIPropertySearch({
  variant = 'inline',
  onSearch,
  placeholder = "Describe your ideal property...",
}: AIPropertySearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const navigateToResults = (filters: PropertyFilters, searchQuery: string) => {
    const params = new URLSearchParams()
    if (filters.country) params.append('country', String(filters.country))
    if (filters.city) params.append('city', String(filters.city))
    if (filters.minPrice) params.append('minPrice', String(filters.minPrice))
    if (filters.maxPrice) params.append('maxPrice', String(filters.maxPrice))
    if (filters.bedrooms) params.append('bedrooms', String(filters.bedrooms))
    if (filters.minBedrooms) params.append('minBedrooms', String(filters.minBedrooms))
    if (filters.maxBedrooms) params.append('maxBedrooms', String(filters.maxBedrooms))
    if (filters.status) params.append('status', String(filters.status))
    if (filters.propertyType) params.append('propertyType', String(filters.propertyType))
    if (filters.isGoldenVisaEligible) params.append('goldenVisa', 'true')
    params.append('q', searchQuery)

    if (onSearch) {
      onSearch(filters)
    } else {
      router.push(`/properties?${params.toString()}`)
    }
  }

  const handleSearch = async (searchText?: string) => {
    const q = (searchText || query).trim()
    if (!q) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setQuery('')

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const response = await fetch(`${apiUrl}/api/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      const { filters, summary, properties, count, aiPowered } = data.data

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: summary,
        timestamp: new Date(),
        filters,
        count,
        properties: properties || [],
        aiPowered,
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Something went wrong. Please try again or use the property filters directly.",
          timestamp: new Date(),
        },
      ])
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleNewSearch = () => {
    setMessages([])
    setQuery('')
    inputRef.current?.focus()
  }

  // Get the latest assistant message with results
  const latestResult = [...messages].reverse().find(m => m.role === 'assistant' && m.properties)

  // ── Inline variant (used in hero and properties page) ──────
  if (variant === 'inline') {
    return (
      <div className="w-full">
        <div className="relative bg-white rounded-2xl shadow-lg border border-stone-200 flex items-center">
          <div className="pl-4 flex items-center gap-2 shrink-0">
            <Bot className="w-5 h-5 text-[#1B4965]" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 h-14 px-3 text-sm sm:text-base bg-transparent border-0 outline-none text-stone-900 placeholder:text-stone-400"
          />
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || isLoading}
            className="m-1.5 h-11 px-5 bg-[#1B4965] hover:bg-[#2B6985] text-white font-medium rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 text-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Search</span>
              </>
            )}
          </button>
        </div>

        {/* Quick suggestions — hide when we have results */}
        {!latestResult && (
          <div className="mt-4 flex flex-wrap gap-2">
            {quickSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setQuery(s.text); handleSearch(s.text) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/80 border border-stone-200 rounded-full text-stone-600 hover:border-[#1B4965] hover:text-[#1B4965] transition-all"
              >
                <s.icon className="w-3 h-3" />
                {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Inline AI Answer */}
        {latestResult && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            <AIResultCard
              message={latestResult}
              onViewAll={() => navigateToResults(latestResult.filters!, latestResult.content)}
              onNewSearch={handleNewSearch}
              compact
            />
          </div>
        )}
      </div>
    )
  }

  // ── Page variant ───────────────────────
  return (
    <div className="space-y-6">
      {/* Search box — always visible at top */}
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Input area */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1B4965] rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Describe your ideal property..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className="flex-1 h-12 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-[#1B4965] focus:ring-1 focus:ring-[#1B4965]/20 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSearch()}
                disabled={!query.trim() || isLoading}
                className="h-12 px-5 bg-[#1B4965] hover:bg-[#2B6985] text-white font-medium rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 text-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">Search</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-2 flex items-center gap-1 pl-12">
            <Sparkles className="w-2.5 h-2.5 text-[#C97B4B]" />
            Powered by AI &middot; Describe what you want in plain English
          </p>
        </div>

        {/* Quick suggestions — only when no results yet */}
        {messages.length === 0 && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(s.text)}
                  className="flex items-center gap-2.5 p-3 text-left bg-stone-50 border border-stone-200 rounded-xl hover:border-[#1B4965] hover:bg-[#E8F1F5]/50 transition-all group text-xs"
                >
                  <div className="w-8 h-8 bg-white border border-stone-200 group-hover:border-[#1B4965]/30 rounded-lg flex items-center justify-center shrink-0">
                    <s.icon className="w-4 h-4 text-[#1B4965]" />
                  </div>
                  <span className="text-stone-700 group-hover:text-[#1B4965] font-medium">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center">
          <div className="bg-white border border-stone-200 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#1B4965]" />
            <span className="text-sm text-stone-600 font-medium">Searching properties...</span>
          </div>
        </div>
      )}

      {/* AI Answer + Property Results — outside the chat box */}
      {latestResult && (
        <div className="animate-in fade-in slide-in-from-bottom-3 space-y-6">
          {/* AI Summary card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-[#1B4965] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-[#1B4965]">PropGroup AI</span>
                  {latestResult.aiPowered && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#C97B4B]/10 text-[#C97B4B] rounded-full">
                      <Sparkles className="w-2.5 h-2.5" />
                      AI
                    </span>
                  )}
                </div>
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{latestResult.content}</p>

                {/* Actions row */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {latestResult.count !== undefined && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                      (latestResult.properties?.length || 0) > 0
                        ? 'bg-[#1B4965]/10 text-[#1B4965]'
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      <Search className="w-3 h-3" />
                      {latestResult.count} {latestResult.count === 1 ? 'property' : 'properties'} found
                    </span>
                  )}
                  <button
                    onClick={handleNewSearch}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    New search
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Property cards — full-width grid */}
          {(latestResult.properties?.length || 0) > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {latestResult.properties!.map((property: Property, index: number) => (
                <div
                  key={property.id}
                  className="animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 80}ms` }}
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
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}


// ── AI Result Card — shows summary + property cards ──────────────

function AIResultCard({
  message,
  onViewAll,
  onNewSearch,
  compact = false,
}: {
  message: Message
  onViewAll?: () => void
  onNewSearch: () => void
  compact?: boolean
}) {
  const properties = message.properties || []
  const hasResults = properties.length > 0
  const displayLimit = compact ? 3 : 6

  return (
    <div className="space-y-3">
      {/* AI Summary */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-[#1B4965] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#1B4965]">PropGroup AI</span>
              {message.aiPowered && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#C97B4B]/10 text-[#C97B4B] rounded-full">
                  <Sparkles className="w-2.5 h-2.5" />
                  AI
                </span>
              )}
            </div>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{message.content}</p>

            {/* Result count badge */}
            {message.count !== undefined && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                  hasResults
                    ? 'bg-[#1B4965]/10 text-[#1B4965]'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  <Search className="w-3 h-3" />
                  {hasResults ? `${message.count} ${message.count === 1 ? 'property' : 'properties'} found` : 'No matches'}
                </span>

                {hasResults && onViewAll && properties.length > displayLimit && (
                  <button
                    onClick={onViewAll}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1B4965] hover:bg-[#1B4965]/5 rounded-lg transition-colors"
                  >
                    View all in listings
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                <button
                  onClick={onNewSearch}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  New search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Property Cards Grid */}
      {hasResults && (
        <div className={`grid gap-4 ${compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {properties.slice(0, displayLimit).map((property: Property, index: number) => (
            <div
              key={property.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 80}ms` }}
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
              />
            </div>
          ))}
        </div>
      )}

      {/* Show more link */}
      {hasResults && properties.length > displayLimit && onViewAll && (
        <div className="text-center pt-2">
          <button
            onClick={onViewAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1B4965] hover:bg-[#2B6985] rounded-xl shadow-md transition-all"
          >
            View all {properties.length} properties
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
