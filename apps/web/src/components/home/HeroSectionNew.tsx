'use client'

import { useState, useEffect } from 'react'
import { Search, Sparkles, TrendingUp, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIPropertySearch } from '@/components/ai/AIPropertySearch'
import { fetchSectionContent } from '@/lib/content'
import Link from 'next/link'

export function HeroSectionNew() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'traditional'>('ai')
  const [cms, setCms] = useState<Record<string, string>>({})

  useEffect(() => {
    setMounted(true)
    fetchSectionContent('hero').then(setCms)
  }, [])

  if (!mounted) {
    return (
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-50 via-white to-[#E8F1F5] w-full">
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full max-w-7xl">
          <div className="max-w-5xl mx-auto text-center space-y-4 sm:space-y-6">
            <div className="h-16 sm:h-20 md:h-24 lg:h-28 bg-stone-200 rounded-xl animate-pulse mx-auto max-w-xl" />
            <div className="h-8 bg-stone-200 rounded-lg animate-pulse mx-auto max-w-md" />
            <div className="h-40 bg-stone-200 rounded-2xl animate-pulse mx-auto max-w-3xl mt-10" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-stone-50 via-white to-[#E8F1F5] w-full">
      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full max-w-7xl">
        <div className="max-w-5xl mx-auto">

          {/* Main Headline */}
          <div className="text-center space-y-4 sm:space-y-6 mb-10 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
              <span className="block text-stone-900 mb-2">
                {(cms['hero-title'] || 'Smart Real Estate').split(' ').slice(0, -1).join(' ') || 'Smart Real Estate'}
              </span>
              <span className="block bg-gradient-to-r from-[#1B4965] to-[#C97B4B] bg-clip-text text-transparent">
                {cms['hero-title'] ? cms['hero-title'].split(' ').slice(-1)[0] : 'Investments'}
              </span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-stone-600 max-w-2xl mx-auto">
              {cms['hero-subtitle'] || 'Your gateway to Georgia real estate investment'}
            </p>
          </div>

          {/* AI Search Section */}
          <div className="max-w-3xl mx-auto mb-10">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-md">
              <div className="flex items-center gap-2 mb-3 text-sm text-[#1B4965]">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">AI-Powered Search</span>
              </div>

              <AIPropertySearch
                variant="inline"
                placeholder="e.g., 2-bedroom apartment in Batumi under $150k with high ROI"
              />
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/properties">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-[#C97B4B] hover:bg-[#B86A3A] text-white rounded-xl shadow-lg transition-all"
              >
                <span className="flex items-center gap-2">
                  Browse Properties
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Button>
            </Link>

            <Link href="/auth/signup">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold border-2 border-[#1B4965] text-[#1B4965] hover:bg-[#E8F1F5] rounded-xl transition-all"
              >
                Start Investing
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
