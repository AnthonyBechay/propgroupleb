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
      // Call backend AI search API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const response = await fetch(`${apiUrl}/ai-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      if (!response.ok) {
        throw new Error('AI search request failed')
      }

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

      // Navigate to properties with filters after a short delay
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
    { icon: Home, text: "3-bedroom apartment in Cyprus under $300k", color: "blue" },
    { icon: TrendingUp, text: "Properties with highest ROI in Greece", color: "green" },
    { icon: DollarSign, text: "Golden Visa eligible properties", color: "yellow" },
    { icon: MapPin, text: "New build properties in Georgia", color: "purple" }
  ]

  if (variant === 'inline') {
    return (
      <div className="w-full">
        {/* Enhanced Search Input with Gradient Border */}
        <div className="relative group">
          {/* Gradient border wrapper */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-50 group-hover:opacity-100 blur-sm transition-all duration-300"></div>

          <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2 z-10">
              <div className="relative">
                <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
            </div>

            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-16 pr-32 h-16 text-base bg-transparent border-2 border-transparent focus:border-transparent focus:ring-0 rounded-2xl text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />

            <Button
              onClick={handleSearch}
              disabled={!query.trim() || isLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-12 px-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Quick suggestions with improved styling */}
        <div className="mt-6 flex flex-wrap gap-3">
          {quickSuggestions.map((suggestion, index) => {
            const colorClasses = {
              blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-500 text-blue-700 dark:text-blue-300',
              green: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-500 text-emerald-700 dark:text-emerald-300',
              yellow: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-500 text-amber-700 dark:text-amber-300',
              purple: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300'
            }

            const iconColorClasses = {
              blue: 'text-blue-600 dark:text-blue-400',
              green: 'text-emerald-600 dark:text-emerald-400',
              yellow: 'text-amber-600 dark:text-amber-400',
              purple: 'text-purple-600 dark:text-purple-400'
            }

            return (
              <button
                key={index}
                onClick={() => setQuery(suggestion.text)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm border rounded-xl transition-all duration-200 hover:shadow-md hover:scale-105 ${colorClasses[suggestion.color as keyof typeof colorClasses]}`}
              >
                <suggestion.icon className={`w-4 h-4 ${iconColorClasses[suggestion.color as keyof typeof iconColorClasses]}`} />
                <span className="font-medium">
                  {suggestion.text}
                </span>
              </button>
            )
          })}
        </div>

        {/* AI Badge */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Powered by Google Gemini AI</span>
        </div>
      </div>
    )
  }

  // Chat interface for modal or page variant
  return (
    <div className={`flex flex-col ${variant === 'page' ? 'h-[calc(100vh-200px)]' : 'h-[600px]'} bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}>
      {/* Header with Enhanced Gradient */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6" />
            <Sparkles className="w-3 h-3 text-amber-400 absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">PropGroup AI Assistant</h3>
            <p className="text-xs text-white/90 flex items-center gap-1">
              <span>Powered by Google Gemini</span>
            </p>
          </div>
        </div>
        {variant === 'modal' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChat(false)}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              How can I help you today?
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Describe your ideal property and I'll find the perfect matches
            </p>

            {/* Quick suggestions in chat */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              {quickSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(suggestion.text)}
                  className="flex items-center gap-3 p-4 text-left bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
                >
                  <div className={`w-10 h-10 bg-${suggestion.color}-100 dark:bg-${suggestion.color}-900/30 rounded-lg flex items-center justify-center`}>
                    <suggestion.icon className={`w-5 h-5 text-${suggestion.color}-600 dark:text-${suggestion.color}-400`} />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {suggestion.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white'
                    : 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.filters && Object.keys(message.filters).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600 text-xs opacity-80">
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
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-gray-600 dark:text-gray-400">Analyzing your request...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input with Enhanced Styling */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 rounded-b-xl">
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
              className="w-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 rounded-xl h-12"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || isLoading}
            className="h-12 px-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Try: "2-bedroom in Cyprus under $400k" or "Golden Visa properties in Greece"</span>
        </p>
      </div>
    </div>
  )
}
