'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  filters?: PropertyFilters
  count?: number
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
}

interface AIPropertySearchProps {
  variant?: 'inline' | 'modal' | 'page'
  onSearch?: (filters: PropertyFilters) => void
  placeholder?: string
}

const quickSuggestions = [
  { icon: Home, text: '2-bedroom apartment in Batumi under $100k' },
  { icon: TrendingUp, text: 'High ROI properties in Tbilisi' },
  { icon: DollarSign, text: 'New build apartments with payment plans' },
  { icon: MapPin, text: 'Beachfront properties in Batumi under $150k' },
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const navigateToResults = (filters: PropertyFilters, searchQuery: string) => {
    const params = new URLSearchParams()
    if (filters.country) params.append('country', filters.country)
    if (filters.city) params.append('city', filters.city)
    if (filters.minPrice) params.append('minPrice', filters.minPrice.toString())
    if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString())
    if (filters.bedrooms) params.append('bedrooms', filters.bedrooms.toString())
    if (filters.minBedrooms) params.append('minBedrooms', filters.minBedrooms.toString())
    if (filters.maxBedrooms) params.append('maxBedrooms', filters.maxBedrooms.toString())
    if (filters.status) params.append('status', filters.status)
    if (filters.propertyType) params.append('propertyType', filters.propertyType)
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
      const { filters, summary, count } = data.data

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: summary,
        timestamp: new Date(),
        filters,
        count,
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)

      // Auto-navigate after a short delay
      setTimeout(() => navigateToResults(filters, q), 1500)
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

  // ── Inline variant (used in hero) ──────────────────────
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

        {/* Quick suggestions */}
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
      </div>
    )
  }

  // ── Chat variant (modal + page) ───────────────────────
  return (
    <div className={`flex flex-col ${variant === 'page' ? 'h-[600px]' : 'h-[500px]'} bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1B4965] rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-stone-900">PropGroup AI</h3>
            <p className="text-[10px] text-stone-500">Ask anything about properties</p>
          </div>
        </div>
        {variant === 'modal' && (
          <button onClick={() => {}} className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 bg-[#E8F1F5] rounded-2xl flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-[#1B4965]" />
            </div>
            <h4 className="text-base font-semibold text-stone-900 mb-1">What are you looking for?</h4>
            <p className="text-sm text-stone-500 mb-6 max-w-sm">Describe your ideal property in plain English and I'll find matches from our listings.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
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
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-[#1B4965] text-white text-sm'
                  : 'bg-stone-100 text-stone-800 text-sm'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.role === 'assistant' && msg.count !== undefined && msg.count > 0 && msg.filters && (
                  <button
                    onClick={() => navigateToResults(msg.filters!, query || msg.content)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#1B4965] hover:underline"
                  >
                    View {msg.count} {msg.count === 1 ? 'property' : 'properties'}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-stone-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B4965]" />
              <span className="text-sm text-stone-500">Searching properties...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-stone-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Describe your ideal property..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            className="flex-1 h-10 px-4 text-sm bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-[#1B4965] focus:ring-1 focus:ring-[#1B4965]/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim() || isLoading}
            className="h-10 w-10 bg-[#1B4965] hover:bg-[#2B6985] text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-stone-400 mt-1.5 flex items-center gap-1 px-1">
          <Sparkles className="w-2.5 h-2.5 text-[#C97B4B]" />
          Powered by AI &middot; Try: &quot;apartments in Batumi under $150k&quot;
        </p>
      </div>
    </div>
  )
}
