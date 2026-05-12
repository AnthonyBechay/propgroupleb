import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Building2, ShieldCheck, TrendingUp, ArrowRight } from 'lucide-react'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const TITLE = 'Invest in Lebanon Real Estate — Beirut, Coast & Beyond | PropGroup'
const DESCRIPTION =
  'Discover curated real estate opportunities across Lebanon — from Beirut apartments to coastal homes. Transparent pricing, clear due diligence steps, and buyer support from shortlist to closing.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/invest-in-lebanon` },
  keywords: [
    'invest in Lebanon',
    'Lebanon real estate',
    'Beirut apartments',
    'Lebanon property investment',
    'buy property in Lebanon',
    'Lebanon off-plan',
    'Lebanon new build',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/invest-in-lebanon`,
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Invest in Lebanon with PropGroup' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
}

const highlights = [
  { icon: MapPin, title: 'Neighborhood-first search', body: 'Filter by Beirut areas and coastal cities to match your lifestyle and budget.' },
  { icon: ShieldCheck, title: 'Due diligence focused', body: 'Clear steps for title, developer track record, and documentation — no guesswork.' },
  { icon: TrendingUp, title: 'Comparable options', body: 'See pricing across markets and compare units side-by-side before you decide.' },
  { icon: Building2, title: 'New-build & resale', body: 'Browse off-plan, new-build, and resale inventory with transparent status labels.' },
]

export default function InvestInLebanonPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-slate-900 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
            <MapPin className="w-4 h-4" /> Lebanon · Beirut · Coast
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            Invest in Lebanon real estate
            <span className="block text-slate-300">with clarity and local context.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-8">{DESCRIPTION}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/properties?country=LEBANON"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-slate-900 font-semibold transition-colors hover:bg-slate-100"
            >
              Browse Lebanon Listings <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold border border-white/20 transition-colors"
            >
              Talk to an Advisor
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-2">What PropGroup helps with</h2>
        <p className="text-center text-slate-600 max-w-2xl mx-auto mb-10">
          A clean workflow to shortlist properties, compare options, and move forward with confidence.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {highlights.map(h => (
            <div key={h.title} className="bg-white rounded-xl p-6 border border-slate-200">
              <h.icon className="w-6 h-6 text-slate-700 mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">{h.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{h.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

