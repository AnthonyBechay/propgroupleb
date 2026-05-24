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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <section className="pt-16 pb-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="PropGroup" width={64} height={64} />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            How Would You Like to{' '}
            <span className="text-slate-700">
              Get Started?
            </span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Whether you want to explore on your own or have our team guide you,
            we&apos;re here to help you navigate Lebanon&apos;s real estate market.
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
                ? 'border-slate-900 bg-slate-100 shadow-xl ring-2 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-lg'
            }`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${
              selectedPath === 'explore' ? 'bg-slate-900' : 'bg-slate-100 group-hover:bg-slate-900'
            }`}>
              <Search className={`w-7 h-7 transition-colors ${
                selectedPath === 'explore' ? 'text-white' : 'text-slate-700 group-hover:text-white'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              I Want to Explore
            </h2>
            <p className="text-slate-600 mb-5">
              Browse properties at your own pace, use our AI-powered search, compare investments,
              and save your favorites. Create a free account to track everything.
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Browse all available properties
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                AI-powered search by your criteria
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Property calculator & market analysis
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Save favorites & build your portfolio
              </li>
            </ul>
            <div className={`mt-6 flex items-center gap-2 font-semibold transition-colors ${
              selectedPath === 'explore' ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-900'
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
                ? 'border-slate-700 bg-slate-100 shadow-xl ring-2 ring-slate-700/10'
                : 'border-slate-200 bg-white hover:border-slate-400 hover:shadow-lg'
            }`}
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-colors ${
              selectedPath === 'contact' ? 'bg-slate-700' : 'bg-slate-100 group-hover:bg-slate-700'
            }`}>
              <MessageSquare className={`w-7 h-7 transition-colors ${
                selectedPath === 'contact' ? 'text-white' : 'text-slate-600 group-hover:text-white'
              }`} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              I Want Guidance
            </h2>
            <p className="text-slate-600 mb-5">
              Tell us about your goals and budget. Our Lebanon-focused team will reach out with
              personalized property recommendations.
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Personal consultation with our team
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Curated properties matching your needs
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                Local market insights & guidance
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                End-to-end transaction support
              </li>
            </ul>
            <div className={`mt-6 flex items-center gap-2 font-semibold transition-colors ${
              selectedPath === 'contact' ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-700'
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
              selectedPath === 'explore' ? 'bg-slate-100 border border-slate-200' : 'bg-slate-100 border border-slate-200'
            }`}>
              {selectedPath === 'explore' ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Ready to explore?</h3>
                    <p className="text-slate-600 text-sm">
                      {user
                        ? 'Head to properties or try our AI search to find your ideal property.'
                        : 'Create a free account to save favorites, use the property calculator, and more.'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link href="/properties">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md"
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        Browse Properties
                      </Button>
                    </Link>
                    <Link href="/ai-search">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto border-slate-300 text-slate-900 hover:bg-slate-50 rounded-xl"
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
                          className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-white rounded-xl"
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
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Let&apos;s connect</h3>
                    <p className="text-slate-600 text-sm">
                      Fill out our contact form with your property needs and we&apos;ll get back to you within 24 hours.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Link href="/contact">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Contact Us
                      </Button>
                    </Link>
                    <Link href="/properties">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto border-slate-300 text-slate-900 hover:bg-slate-50 rounded-xl"
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
      <section className="py-12 px-4 border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MapPin className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Lebanon Focus</h3>
              <p className="text-sm text-slate-600">
                Built for Beirut and Lebanon\u2019s key neighborhoods and coastal cities
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Smart Analysis</h3>
              <p className="text-sm text-slate-600">
                AI-powered search and market analysis for every buyer
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-slate-700" />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">Trusted Process</h3>
              <p className="text-sm text-slate-600">
                Transparent pricing, legal support, and full documentation
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
