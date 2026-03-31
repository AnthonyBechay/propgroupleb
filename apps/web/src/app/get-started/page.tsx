'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import { Button } from '@/components/ui/button'
import {
  Search,
  Phone,
  ArrowRight,
  Building2,
  Sparkles,
  MessageSquare,
  MapPin,
  CheckCircle2,
  Users,
  TrendingUp,
  Shield,
  ChevronRight,
} from 'lucide-react'

export default function GetStartedPage() {
  const { user } = useAuth()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-50 to-white">
      {/* Header */}
      <section className="pt-16 pb-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="PropGroup" width={64} height={64} />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 mb-4">
            How Would You Like to{' '}
            <span className="bg-gradient-to-r from-[#1B4965] to-[#C97B4B] bg-clip-text text-transparent">
              Get Started?
            </span>
          </h1>
          <p className="text-lg text-stone-600 max-w-2xl mx-auto">
            Whether you want to explore on your own or have our team guide you,
            we&apos;re here to help you invest in Georgia&apos;s real estate market.
          </p>
        </div>
      </section>

      {/* Two Paths */}
      <section className="pb-12 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Path 1: Explore */}
          <button
            onClick={() => setSelectedPath('explore')}
            className={`group text-left p-8 rounded-2xl border-2 transition-all duration-300 ${
              selectedPath === 'explore'
                ? 'border-[#1B4965] bg-[#E8F1F5] shadow-xl ring-2 ring-[#1B4965]/20'
                : 'border-stone-200 bg-white hover:border-[#1B4965]/40 hover:shadow-lg'
            }`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${
              selectedPath === 'explore' ? 'bg-[#1B4965]' : 'bg-[#E8F1F5] group-hover:bg-[#1B4965]'
            }`}>
              <Search className={`w-7 h-7 transition-colors ${
                selectedPath === 'explore' ? 'text-white' : 'text-[#1B4965] group-hover:text-white'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-3">
              I Want to Explore
            </h2>
            <p className="text-stone-600 mb-5">
              Browse properties at your own pace, use our AI-powered search, compare investments,
              and save your favorites. Create a free account to track everything.
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Browse all available properties
              </li>
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                AI-powered search by your criteria
              </li>
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ROI calculator & market analysis
              </li>
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Save favorites & build your portfolio
              </li>
            </ul>
            <div className={`mt-6 flex items-center gap-2 font-semibold transition-colors ${
              selectedPath === 'explore' ? 'text-[#1B4965]' : 'text-stone-400 group-hover:text-[#1B4965]'
            }`}>
              Start exploring
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>

          {/* Path 2: Contact Us */}
          <button
            onClick={() => setSelectedPath('contact')}
            className={`group text-left p-8 rounded-2xl border-2 transition-all duration-300 ${
              selectedPath === 'contact'
                ? 'border-[#C97B4B] bg-[#FDF6F0] shadow-xl ring-2 ring-[#C97B4B]/20'
                : 'border-stone-200 bg-white hover:border-[#C97B4B]/40 hover:shadow-lg'
            }`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${
              selectedPath === 'contact' ? 'bg-[#C97B4B]' : 'bg-[#FDF6F0] group-hover:bg-[#C97B4B]'
            }`}>
              <MessageSquare className={`w-7 h-7 transition-colors ${
                selectedPath === 'contact' ? 'text-white' : 'text-[#C97B4B] group-hover:text-white'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-3">
              I Want Guidance
            </h2>
            <p className="text-stone-600 mb-5">
              Tell us about your investment goals and budget. Our Georgia real estate experts
              will reach out with personalized property recommendations.
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Personal investment consultation
              </li>
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Curated properties matching your goals
              </li>
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Market insights & ROI projections
              </li>
              <li className="flex items-center gap-2 text-sm text-stone-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                End-to-end purchase support
              </li>
            </ul>
            <div className={`mt-6 flex items-center gap-2 font-semibold transition-colors ${
              selectedPath === 'contact' ? 'text-[#C97B4B]' : 'text-stone-400 group-hover:text-[#C97B4B]'
            }`}>
              Get in touch
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Action Buttons based on selection */}
        {selectedPath && (
          <div className="max-w-5xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`rounded-2xl p-6 sm:p-8 ${
              selectedPath === 'explore' ? 'bg-[#E8F1F5] border border-[#1B4965]/20' : 'bg-[#FDF6F0] border border-[#C97B4B]/20'
            }`}>
              {selectedPath === 'explore' ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 mb-1">Ready to explore?</h3>
                    <p className="text-stone-600 text-sm">
                      {user
                        ? 'Head to properties or try our AI search to find your ideal investment.'
                        : 'Create a free account to save favorites, use the ROI calculator, and more.'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link href="/properties">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto bg-[#1B4965] hover:bg-[#2B6985] text-white rounded-xl shadow-md"
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        Browse Properties
                      </Button>
                    </Link>
                    <Link href="/ai-search">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto border-[#1B4965] text-[#1B4965] hover:bg-[#E8F1F5] rounded-xl"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Search
                      </Button>
                    </Link>
                    {!user && (
                      <AuthModal defaultMode="signup">
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full sm:w-auto border-stone-300 text-stone-700 hover:bg-white rounded-xl"
                        >
                          Create Account
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </AuthModal>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-stone-900 mb-1">Let&apos;s connect</h3>
                    <p className="text-stone-600 text-sm">
                      Fill out our contact form with your investment interests and we&apos;ll get back to you within 24 hours.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link href="/contact">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto bg-[#C97B4B] hover:bg-[#B86A3A] text-white rounded-xl shadow-md"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Contact Us
                      </Button>
                    </Link>
                    <Link href="/properties">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto border-[#C97B4B] text-[#C97B4B] hover:bg-[#FDF6F0] rounded-xl"
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        Browse First
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Trust Section */}
      <section className="py-12 px-4 border-t border-stone-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#E8F1F5] rounded-xl flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-6 h-6 text-[#1B4965]" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Georgia Focus</h3>
              <p className="text-sm text-stone-600">
                Specialized in Tbilisi, Batumi, and emerging Georgian markets
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#E8F1F5] rounded-xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-[#1B4965]" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Smart Analysis</h3>
              <p className="text-sm text-stone-600">
                AI-powered insights and ROI projections for every property
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-[#E8F1F5] rounded-xl flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-[#1B4965]" />
              </div>
              <h3 className="font-bold text-stone-900 mb-1">Trusted Process</h3>
              <p className="text-sm text-stone-600">
                Transparent pricing, legal support, and full documentation
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
