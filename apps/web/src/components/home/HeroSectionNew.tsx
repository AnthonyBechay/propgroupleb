import { Sparkles, ArrowRight, TrendingUp, Shield, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIPropertySearch } from '@/components/ai/AIPropertySearch'
import Link from 'next/link'

export function HeroSectionNew() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden w-full">
      {/* Neutral gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }} />
      {/* Bottom fade to white */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full max-w-7xl">
        <div className="max-w-5xl mx-auto">

          {/* Main Headline */}
          <div className="text-center space-y-4 sm:space-y-6 mb-10 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
              <Sparkles className="w-4 h-4 text-white/90" />
              <span className="text-sm font-semibold text-white/90">Lebanon Real Estate</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight">
              <span className="block text-white mb-2">
                Invest Smart in
              </span>
              <span className="block text-slate-300">
                Lebanese Real Estate
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto">
              Curated listings with clear pricing, neighborhood context, and buyer support from shortlist to closing.
            </p>
          </div>

          {/* AI Search Section */}
          <div className="max-w-3xl mx-auto mb-10">
            <div className="bg-white/95 backdrop-blur-sm border border-white/50 rounded-2xl p-5 sm:p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-3 text-sm text-[#1B3A5C]">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">AI-Powered Search</span>
              </div>

              <AIPropertySearch
                variant="inline"
                placeholder="e.g., 2-bedroom apartment in Beirut under $200k near Hamra"
              />
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12">
            <Link href="/properties">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-white hover:bg-slate-100 text-[#1B3A5C] rounded-xl shadow-lg transition-all"
              >
                <span className="flex items-center gap-2">
                  Browse Projects
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Button>
            </Link>

            <Link href="/get-started">
              <Button
                size="lg"
                className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-slate-200/90 hover:bg-slate-100 text-[#0F2137] border-2 border-white/40 rounded-xl shadow-lg transition-all"
              >
                Start Investing
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {[
              { icon: TrendingUp, text: '8-15% ROI' },
              { icon: Shield, text: 'Verified Returns' },
              { icon: Globe, text: '16+ Projects' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-white/60">
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
