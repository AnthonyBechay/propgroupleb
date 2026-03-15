'use client'

import { useState, useEffect } from 'react'
import { Search, Sparkles, TrendingUp, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIPropertySearch } from '@/components/ai/AIPropertySearch'
import Link from 'next/link'

export function HeroSectionNew() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'traditional'>('ai')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f2439] to-[#1e293b] w-full">
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full max-w-7xl">
          <div className="max-w-5xl mx-auto text-center space-y-4 sm:space-y-6">
            <div className="h-16 sm:h-20 md:h-24 lg:h-28 bg-white/5 rounded-xl animate-pulse mx-auto max-w-xl" />
            <div className="h-8 bg-white/5 rounded-lg animate-pulse mx-auto max-w-md" />
            <div className="h-40 bg-white/5 rounded-2xl animate-pulse mx-auto max-w-3xl mt-10" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f2439] to-[#1e293b] w-full">
      {/* Simplified Background - No animations */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 -left-40 w-[600px] h-[600px] rounded-full opacity-15 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full max-w-7xl">
        <div className="max-w-5xl mx-auto">

          {/* Main Headline */}
          <div className="text-center space-y-4 sm:space-y-6 mb-10 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
              <span className="block text-white mb-2">
                Smart Real Estate
              </span>
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Investments
              </span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto">
              AI-powered property search with verified ROI data
            </p>
          </div>

          {/* AI Search Section */}
          <div className="max-w-3xl mx-auto mb-10">
            <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 sm:p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-3 text-sm text-cyan-400">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">AI-Powered Search</span>
              </div>

              <AIPropertySearch
                variant="inline"
                placeholder="e.g., 3-bedroom villa in Cyprus under $500k with high ROI"
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto mb-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">12.5%</div>
              <div className="text-sm text-slate-400">Avg ROI</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">25+</div>
              <div className="text-sm text-slate-400">Countries</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">5K+</div>
              <div className="text-sm text-slate-400">Properties</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/properties">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl shadow-lg transition-all"
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
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-white/5 border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 rounded-xl backdrop-blur-sm transition-all"
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
