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
  MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  filters?: PropertyFilters
}

interface PropertyFilters {
  country?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  bathrooms?: number
  goal?: string
  status?: string
  isGoldenVisaEligible?: boolean
}

interface AIPropertySearchProps {
  variant?: 'inline' | 'modal' | 'page'
  onSearch?: (filters: PropertyFilters) => void
  placeholder?: string
}

export function AIPropertySearch({
  variant = 'inline',
  onSearch,
  placeholder = "Tell me what you're looking for... (e.g., 'I want a 3-bedroom apartment in Cyprus under $500k')"
}: AIPropertySearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showChat, setShowChat] = useState(variant === 'page')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (showChat && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showChat])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSearch = async () => {
    if (!query.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    const currentQuery = query
    setQuery('')

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
      const response = await fetch(`${apiUrl}/api/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentQuery,
          context: {
            previousSearches: messages
              .filter(m => m.role === 'user')
              .map(m => m.content)
              .slice(-3)
          }
        })
      })

      if (!response.ok) throw new Error('AI search request failed')

      const data = await response.json()
      const { filters, summary } = data.data

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: summary,
        timestamp: new Date(),
        filters
      }

      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)

      setTimeout(() => {
        const params = new URLSearchParams()
        if (filters.country) params.append('country', filters.country)
        if (filters.minPrice) params.append('minPrice', filters.minPrice.toString())
        if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString())
        if (filters.bedrooms) params.append('bedrooms', filters.bedrooms.toString())
        if (filters.bathrooms) params.append('bathrooms', filters.bathrooms.toString())
        if (filters.goal) params.append('goal', filters.goal)
        if (filters.status) params.append('status', filters.status)
        if (filters.isGoldenVisaEligible) params.append('goldenVisa', 'true')
        params.append('q', currentQuery)

        if (onSearch) {
          onSearch(filters)
        } else {
          router.push(`/properties?${params.toString()}`)
        }
      }, 1000)
    } catch (error) {
      console.error('AI search error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble processing your request right now. Please try again or use the regular search filters.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const quickSuggestions = [
    { icon: Home, text: "3-bedroom apartment in Cyprus under $300k", color: "teal" },
    { icon: TrendingUp, text: "Properties with highest ROI in Greece", color: "emerald" },
    { icon: DollarSign, text: "Golden Visa eligible properties", color: "amber" },
    { icon: MapPin, text: "New build properties in Georgia", color: "stone" }
  ]

  if (variant === 'inline') {
    return (
      <div className="w-full">
        <div className="relative group">
          <div className="relative bg-white rounded-2xl shadow-lg border border-stone-200">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2 z-10">
              <div className="relative">
                <Bot className="w-6 h-6 text-[#1B4965]" />
                <Sparkles className="w-3 h-3 text-[#C97B4B] absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-16 pr-32 h-16 text-base bg-transparent border-0 focus:ring-2 focus:ring-[#1B4965] rounded-2xl text-stone-900 placeholder:text-stone-400"
            />
            <Button
              onClick={handleSearch}
              disabled={!query.trim() || isLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-12 px-6 bg-[#1B4965] hover:bg-[#2B6985] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              size="sm"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </div>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {quickSuggestions.map((suggestion, index) => {
            const colorClasses: Record<string, string> = {
              teal: 'bg-[#E8F1F5] border-[#1B4965]/20 hover:border-[#1B4965]/40 text-[#1B4965]',
              emerald: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-700',
              amber: 'bg-[#FBF0E7] border-[#C97B4B]/20 hover:border-[#C97B4B]/40 text-[#C97B4B]',
              stone: 'bg-stone-50 border-stone-200 hover:border-stone-400 text-stone-700'
            }
            const iconColorClasses: Record<string, string> = {
              teal: 'text-[#1B4965]',
              emerald: 'text-emerald-600',
              amber: 'text-[#C97B4B]',
              stone: 'text-stone-600'
            }
            return (
              <button
                key={index}
                onClick={() => setQuery(suggestion.text)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border rounded-xl transition-all duration-200 hover:shadow-md ${colorClasses[suggestion.color]}`}
              >
                <suggestion.icon className={`w-4 h-4 ${iconColorClasses[suggestion.color]}`} />
                <span className="font-medium">{suggestion.text}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-stone-500">
          <Sparkles className="w-3 h-3 text-[#C97B4B]" />
          <span>Powered by Google Gemini AI</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${variant === 'page' ? 'h-[calc(100vh-200px)]' : 'h-[600px]'} bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden`}>
      <div className="flex items-center justify-between p-4 border-b border-stone-200 bg-[#1B4965] text-white rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
            <Sparkles className="w-3 h-3 text-[#C97B4B] absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">PropGroup AI Assistant</h3>
            <p className="text-xs text-white/90">Powered by Google Gemini</p>
          </div>
        </div>
        {variant === 'modal' && (
          <Button variant="ghost" size="sm" onClick={() => setShowChat(false)} className="text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#E8F1F5] rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-[#1B4965]" />
            </div>
            <h4 className="text-lg font-semibold text-stone-900 mb-2">How can I help you today?</h4>
            <p className="text-stone-600 mb-6">Describe your ideal property and I&apos;ll find the perfect matches</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {quickSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(suggestion.text)}
                  className="flex items-center gap-3 p-4 text-left bg-stone-50 border border-stone-200 rounded-lg hover:border-[#1B4965] transition-all group"
                >
                  <div className="w-10 h-10 bg-[#E8F1F5] rounded-lg flex items-center justify-center">
                    <suggestion.icon className="w-5 h-5 text-[#1B4965]" />
                  </div>
                  <span className="text-sm text-stone-700 group-hover:text-[#1B4965]">{suggestion.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                message.role === 'user'
                  ? 'bg-[#1B4965] text-white'
                  : 'bg-stone-50 text-stone-900 border border-stone-200'
              }`}>
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.filters && Object.keys(message.filters).length > 0 && (
                  <div className={`mt-2 pt-2 border-t text-xs opacity-80 ${message.role === 'user' ? 'border-white/30' : 'border-stone-300'}`}>
                    <span className="font-semibold">Filters applied:</span>{' '}
                    {Object.entries(message.filters).filter(([_, v]) => v).length} criteria
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-stone-100 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B4965]" />
              <span className="text-stone-600">Analyzing your request...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-stone-200 bg-stone-50 rounded-b-xl">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Describe your ideal property..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="w-full bg-white border-2 border-stone-200 focus:border-[#1B4965] rounded-xl h-12"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="h-12 px-4 bg-[#1B4965] hover:bg-[#2B6985] shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
        <p className="text-xs text-stone-500 mt-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#C97B4B]" />
          <span>Try: &quot;2-bedroom in Cyprus under $400k&quot; or &quot;Golden Visa properties in Greece&quot;</span>
        </p>
      </div>
    </div>
  )
}
