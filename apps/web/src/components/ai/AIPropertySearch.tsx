'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PropertyCard } from '@/components/PropertyCard'
import {
  Search,
  Sparkles,
  Send,
  Loader2,
  TrendingUp,
  Home,
  DollarSign,
  MapPin,
  Bot,
  MessageSquare,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
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
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Build conversation history for backend context
  const getConversationHistory = () => {
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  }

  // Get the latest filters from the conversation
  const getLatestFilters = () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.filters)
    return lastAssistant?.filters
  }

  // Get property IDs from last result
  const getLatestPropertyIds = () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.properties)
    return lastAssistant?.properties?.map(p => p.id) || []
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

      const isFollowUp = messages.length > 0
      const body: Record<string, unknown> = { query: q }
      if (isFollowUp) {
        body.conversationHistory = getConversationHistory()
        body.previousFilters = getLatestFilters()
        body.previousPropertyIds = getLatestPropertyIds()
      }

      const response = await fetch(`${apiUrl}/api/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    setExpandedCards({})
    setQuery('')
    inputRef.current?.focus()
  }

  const toggleExpanded = (messageId: string) => {
    setExpandedCards(prev => ({ ...prev, [messageId]: !prev[messageId] }))
  }

  // Get the latest assistant message with results
  const latestResult = [...messages].reverse().find(m => m.role === 'assistant' && m.properties)

  // ── Inline variant (used in hero and properties page) ──────
  if (variant === 'inline') {
    return (
      <div className="w-full">
        <div className="relative bg-white rounded-2xl shadow-lg border border-slate-200 flex items-center">
          <div className="pl-4 flex items-center gap-2 shrink-0">
            <Bot className="w-5 h-5 text-[#1B3A5C]" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 h-14 px-3 text-sm sm:text-base bg-transparent border-0 outline-none text-slate-900 placeholder:text-slate-400"
          />
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || isLoading}
            className="m-1.5 h-11 px-5 bg-[#1B3A5C] hover:bg-[#24507D] text-white font-medium rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 text-sm"
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/80 border border-slate-200 rounded-full text-slate-600 hover:border-[#1B3A5C] hover:text-[#1B3A5C] transition-all"
              >
                <s.icon className="w-3 h-3" />
                {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Inline AI Answer — compact, latest only */}
        {latestResult && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            <InlineResultSummary
              message={latestResult}
              onViewAll={() => navigateToResults(latestResult.filters!, latestResult.content)}
              onNewSearch={handleNewSearch}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Page variant — full conversational flow ───────────────────────
  const hasConversation = messages.length > 0

  return (
    <div className="space-y-6">
      {/* Search box — always visible at top */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1B3A5C] rounded-xl flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={hasConversation ? "Ask a follow-up question..." : "Describe your ideal property..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                className="flex-1 h-12 px-4 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1B3A5C] focus:ring-1 focus:ring-[#1B3A5C]/20 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSearch()}
                disabled={!query.trim() || isLoading}
                className="h-12 px-5 bg-[#1B3A5C] hover:bg-[#24507D] text-white font-medium rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 text-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Ask</span>
                  </>
                )}
              </button>
            </div>
            {hasConversation && (
              <button
                onClick={handleNewSearch}
                className="h-9 px-3 text-xs font-medium text-slate-500 hover:text-[#1B3A5C] hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                title="Start new search"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!hasConversation && (
            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 pl-12">
              <Sparkles className="w-2.5 h-2.5 text-[#C49A2E]" />
              Powered by AI &middot; Ask anything about our properties
            </p>
          )}
          {hasConversation && (
            <div className="mt-2 pl-12 flex flex-wrap gap-1.5">
              {['Which has a pool?', 'Show only under $60k', 'Which has the highest ROI?', 'Off-plan only'].map((hint, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(hint)}
                  className="px-2.5 py-1 text-[10px] font-medium bg-slate-50 border border-slate-200 rounded-full text-slate-500 hover:border-[#1B3A5C] hover:text-[#1B3A5C] transition-all"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick suggestions — only when no conversation yet */}
        {!hasConversation && (
          <div className="px-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(s.text)}
                  className="flex items-center gap-2.5 p-3 text-left bg-slate-50 border border-slate-200 rounded-xl hover:border-[#1B3A5C] hover:bg-[#E0EDF7]/50 transition-all group text-xs"
                >
                  <div className="w-8 h-8 bg-white border border-slate-200 group-hover:border-[#1B3A5C]/30 rounded-lg flex items-center justify-center shrink-0">
                    <s.icon className="w-4 h-4 text-[#1B3A5C]" />
                  </div>
                  <span className="text-slate-700 group-hover:text-[#1B3A5C] font-medium">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center">
          <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#1B3A5C]" />
            <span className="text-sm text-slate-600 font-medium">Searching properties...</span>
          </div>
        </div>
      )}

      {/* Conversation thread */}
      {hasConversation && (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id}>
              {/* User message */}
              {msg.role === 'user' && (
                <div className="flex justify-end mb-4">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-[#1B3A5C] text-white text-sm shadow-sm">
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )}

              {/* AI response */}
              {msg.role === 'assistant' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {/* Summary card */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-[#1B3A5C] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-bold text-[#1B3A5C]">PropGroup AI</span>
                          {msg.aiPowered && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#C49A2E]/10 text-[#C49A2E] rounded-full">
                              <Sparkles className="w-2.5 h-2.5" />
                              AI
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                        {/* Actions */}
                        {msg.count !== undefined && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                              (msg.properties?.length || 0) > 0
                                ? 'bg-[#1B3A5C]/10 text-[#1B3A5C]'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              <Search className="w-3 h-3" />
                              {msg.count} {msg.count === 1 ? 'property' : 'properties'} found
                            </span>

                            {(msg.properties?.length || 0) > 3 && (
                              <button
                                onClick={() => toggleExpanded(msg.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1B3A5C] hover:bg-[#1B3A5C]/5 rounded-lg transition-colors"
                              >
                                {expandedCards[msg.id] ? (
                                  <>Show less <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                  <>Show all {msg.properties!.length} <ChevronDown className="w-3 h-3" /></>
                                )}
                              </button>
                            )}

                            {msg.filters && (msg.properties?.length || 0) > 0 && (
                              <button
                                onClick={() => navigateToResults(msg.filters!, msg.content)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                Open in listings
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Property cards — show 3 by default, expand to all */}
                  {(msg.properties?.length || 0) > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {msg.properties!
                        .slice(0, expandedCards[msg.id] ? undefined : 3)
                        .map((property: Property, index: number) => (
                        <div
                          key={property.id}
                          className="animate-in fade-in slide-in-from-bottom-2"
                          style={{ animationDelay: `${index * 60}ms` }}
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

                  {/* Show more button below cards */}
                  {(msg.properties?.length || 0) > 3 && !expandedCards[msg.id] && (
                    <div className="text-center">
                      <button
                        onClick={() => toggleExpanded(msg.id)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#1B3A5C] bg-white border-2 border-[#1B3A5C]/20 hover:border-[#1B3A5C] hover:bg-[#E0EDF7] rounded-xl transition-all"
                      >
                        Show all {msg.properties!.length} properties
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ── Compact inline result summary (for hero/properties page) ──────

function InlineResultSummary({
  message,
  onViewAll,
  onNewSearch,
}: {
  message: Message
  onViewAll?: () => void
  onNewSearch: () => void
}) {
  const properties = message.properties || []
  const hasResults = properties.length > 0

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-[#1B3A5C]">PropGroup AI</span>
            {message.aiPowered && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-[#C49A2E]/10 text-[#C49A2E] rounded-full">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{message.content}</p>

          {message.count !== undefined && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                hasResults ? 'bg-[#1B3A5C]/10 text-[#1B3A5C]' : 'bg-slate-100 text-slate-500'
              }`}>
                <Search className="w-3 h-3" />
                {hasResults ? `${message.count} ${message.count === 1 ? 'property' : 'properties'} found` : 'No matches'}
              </span>

              {hasResults && onViewAll && (
                <button
                  onClick={onViewAll}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#1B3A5C] hover:bg-[#1B3A5C]/5 rounded-lg transition-colors"
                >
                  View properties
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}

              <button
                onClick={onNewSearch}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                New search
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
