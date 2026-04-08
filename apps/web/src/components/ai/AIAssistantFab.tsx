'use client'

import { useState, useRef } from 'react'
import {
  Bot,
  X,
  Sparkles,
  Send,
  Loader2,
  Search,
  RotateCcw,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// WhatsApp icon as inline SVG
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

interface FabMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  count?: number
  aiPowered?: boolean
  filters?: Record<string, unknown>
}

const WHATSAPP_NUMBER = '96171934001'

function buildFilterUrl(filters?: Record<string, unknown>): string {
  if (!filters) return '/properties'
  const params = new URLSearchParams()
  const keys = ['country', 'city', 'minPrice', 'maxPrice', 'bedrooms', 'minBedrooms', 'status', 'propertyType']
  for (const key of keys) {
    if (filters[key] !== undefined && filters[key] !== null) {
      params.append(key, String(filters[key]))
    }
  }
  if (filters.isGoldenVisaEligible) params.append('goldenVisa', 'true')
  const qs = params.toString()
  return qs ? `/properties?${qs}` : '/properties'
}

export function AIAssistantFab() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<FabMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }

  const handleSearch = async (searchText?: string) => {
    const q = (searchText || query).trim()
    if (!q) return

    const userMsg: FabMessage = { id: Date.now().toString(), role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setQuery('')
    setTimeout(scrollToBottom, 50)

    try {
      const { normalizeApiUrl } = await import('@/lib/utils/api-url')
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

      const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }))
      const body: Record<string, unknown> = { query: q }
      if (conversationHistory.length > 0) {
        body.conversationHistory = conversationHistory
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.filters)
        if (lastAssistant?.filters) {
          body.previousFilters = lastAssistant.filters
        }
      }

      const response = await fetch(`${apiUrl}/api/ai-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      const { summary, count, aiPowered, filters } = data.data

      const assistantMsg: FabMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: summary,
        count,
        aiPowered,
        filters,
      }

      setMessages(prev => [...prev, assistantMsg])
      setIsLoading(false)
      setTimeout(scrollToBottom, 50)
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
      setIsLoading(false)
      setTimeout(scrollToBottom, 50)
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

  const openWhatsApp = (prefill?: string) => {
    const text = prefill || 'Hi, I found your properties on PropGroup and I\'d like to learn more.'
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleOpen = () => {
    setIsOpen(true)
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {/* WhatsApp button */}
          <button
            onClick={() => openWhatsApp()}
            className="w-12 h-12 rounded-full shadow-lg bg-[#25D366] hover:bg-[#20BD5A] flex items-center justify-center transition-all hover:scale-105"
            aria-label="Chat on WhatsApp"
          >
            <WhatsAppIcon className="w-6 h-6 text-white" />
          </button>

          {/* AI button */}
          <button
            onClick={handleOpen}
            className="w-16 h-16 rounded-full shadow-2xl bg-[#1B3A5C] hover:bg-[#24507D] flex items-center justify-center transition-all hover:scale-105 group"
            aria-label="Open AI assistant"
          >
            <div className="relative">
              <Bot className="w-7 h-7 text-white" />
              <Sparkles className="w-3 h-3 text-[#C49A2E] absolute -top-1 -right-1 animate-pulse" />
            </div>
          </button>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Chat window */}
          <div className="fixed bottom-6 right-6 w-[calc(100vw-3rem)] max-w-md z-50 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[520px] overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#1B3A5C] text-white rounded-t-2xl shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">PropGroup AI</h3>
                    <p className="text-[10px] text-white/70">Ask anything about our properties</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={handleNewSearch}
                      className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      aria-label="New search"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close assistant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages area — scrollable, fixed height */}
              <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-2">
                    <div className="w-12 h-12 bg-[#E0EDF7] rounded-xl flex items-center justify-center mb-3">
                      <MessageCircle className="w-6 h-6 text-[#1B3A5C]" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-1">How can I help?</h4>
                    <p className="text-xs text-slate-500 mb-4">Ask about properties, prices, ROI, locations, or anything else.</p>

                    <div className="space-y-2 w-full">
                      {[
                        'Best ROI properties in Batumi',
                        'Apartments under $60k',
                        'Off-plan with payment plans',
                      ].map((hint, i) => (
                        <button
                          key={i}
                          onClick={() => handleSearch(hint)}
                          className="w-full text-left px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:border-[#1B3A5C] hover:text-[#1B3A5C] transition-all"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#1B3A5C] text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        {msg.role === 'assistant' && msg.count !== undefined && msg.count > 0 && (
                          <a
                            href={buildFilterUrl(msg.filters)}
                            className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#1B3A5C] hover:underline"
                          >
                            <Search className="w-3 h-3" />
                            View {msg.count} {msg.count === 1 ? 'property' : 'properties'}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl px-3.5 py-2.5 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B3A5C]" />
                      <span className="text-xs text-slate-500">Searching...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp bar */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 shrink-0">
                <button
                  onClick={() => openWhatsApp(
                    messages.length > 0
                      ? `Hi, I was searching on PropGroup for: "${messages.find(m => m.role === 'user')?.content}". Can you help?`
                      : undefined
                  )}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-[#25D366] bg-[#25D366]/10 hover:bg-[#25D366]/20 rounded-lg transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  Prefer WhatsApp? Chat with our team
                </button>
              </div>

              {/* Input — always at bottom */}
              <div className="px-3 py-3 border-t border-slate-100 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={messages.length > 0 ? "Ask a follow-up..." : "Ask about properties..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1 h-10 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1B3A5C] focus:ring-1 focus:ring-[#1B3A5C]/20 transition-all disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSearch()}
                    disabled={!query.trim() || isLoading}
                    className="h-10 w-10 bg-[#1B3A5C] hover:bg-[#24507D] text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
