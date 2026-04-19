import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, TrendingUp, ShieldCheck, Scale, Globe2, Wallet, Building2, ArrowRight } from 'lucide-react'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === 'production' ? 'https://bechays.com' : 'http://localhost:3000')

const TITLE = 'Invest in Georgia Real Estate — Tbilisi, Batumi & Beyond | PropGroup'
const DESCRIPTION =
  "Georgia combines a low-tax regime, 100% foreign ownership, and two fast-growing investment hubs — Tbilisi and Batumi. PropGroup curates vetted projects with transparent ROI across the country."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/invest-in-georgia` },
  keywords: [
    'invest in Georgia',
    'Georgia real estate',
    'Tbilisi apartments',
    'Batumi apartments',
    'Georgia property investment',
    'Georgia residency by investment',
    'Georgia rental yield',
    'Georgia off-plan',
    'Caucasus real estate',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/invest-in-georgia`,
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Invest in Georgia with PropGroup' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
}

const pillars = [
  { icon: Scale, title: 'Low, flat tax system', body: '20% personal income tax, 5% rental tax under Small Business Status, 0% capital gains on primary residence held >2 years.' },
  { icon: ShieldCheck, title: '100% foreign ownership', body: 'Foreigners can own apartments and commercial property outright. No nominee structures required for non-agricultural assets.' },
  { icon: Globe2, title: 'Residency pathway', body: 'Property purchase above the threshold provides a pathway to Georgian temporary residence for the investor and family.' },
  { icon: TrendingUp, title: 'Yield + growth', body: 'Short-term rental in Batumi delivers 8\u201312% gross yield; Tbilisi long-term rentals are more stable with 6\u20139% yield.' },
  { icon: Wallet, title: 'Low friction', body: 'Transfer tax ~1%, no annual property tax for non-commercial use below threshold, notary-based closing in days, not months.' },
  { icon: Building2, title: 'Two distinct markets', body: 'Tbilisi = capital-growth & long-term rental. Batumi = seasonal short-term rental & resort demand. PropGroup covers both.' },
]

const cities = [
  {
    name: 'Batumi',
    tagline: 'Black Sea resort · short-term rental yield',
    href: '/invest-in-batumi',
    stats: '8\u201312% yield · 9.5M+ tourists/yr',
  },
  {
    name: 'Tbilisi',
    tagline: 'Capital city · long-term rental & capital growth',
    href: '/properties?city=Tbilisi',
    stats: '6\u20139% yield · diversified economy',
  },
  {
    name: 'Kutaisi',
    tagline: 'Emerging budget-airline gateway',
    href: '/properties?city=Kutaisi',
    stats: 'Entry-level pricing · low competition',
  },
]

export default function InvestInGeorgiaPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Country',
        '@id': `${SITE_URL}/invest-in-georgia#country`,
        name: 'Georgia',
        description: DESCRIPTION,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Can foreigners buy property in Georgia?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Foreign nationals enjoy 100% ownership rights on apartments and commercial property in Georgia. Only agricultural land is restricted to Georgian citizens and companies.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does buying property in Georgia give residency?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Purchasing property above the statutory threshold (typically $100,000+) provides a pathway to short-term residence in Georgia for the investor and close family members, renewable annually.',
            },
          },
          {
            '@type': 'Question',
            name: 'What is the rental tax in Georgia?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Individual landlords can register under the Small Business Status and pay a flat 5% tax on gross rental income \u2014 one of the most competitive rates in Europe and the wider region.',
            },
          },
          {
            '@type': 'Question',
            name: 'Should I buy in Tbilisi or Batumi?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tbilisi suits long-term rental and capital-growth investors looking for lower volatility. Batumi suits short-term rental investors chasing higher summer yields with more seasonality.',
            },
          },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-[#1B3A5C] text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C49A2E] mb-4">
            <MapPin className="w-4 h-4" /> Georgia · Caucasus · EU candidate
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            Invest in Georgia real estate
            <span className="block text-[#C49A2E]">Low tax. Strong yield. Clear title.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-8">{DESCRIPTION}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/properties?country=GEORGIA"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#C49A2E] hover:bg-[#B38824] text-white font-semibold transition-colors"
            >
              Browse Georgia Projects <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/invest-in-batumi"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/30 transition-colors"
            >
              Focus on Batumi
            </Link>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-2">Why investors choose Georgia</h2>
        <p className="text-center text-slate-600 max-w-2xl mx-auto mb-10">
          The combination of low-tax regime, clear foreign-ownership law, and two very different investable cities is rare in the region.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map(p => (
            <div key={p.title} className="bg-white rounded-xl p-6 border border-slate-200">
              <p.icon className="w-6 h-6 text-[#C49A2E] mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">{p.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cities */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-2">Two markets, one country</h2>
          <p className="text-center text-slate-600 max-w-2xl mx-auto mb-10">Pick the city that matches your strategy.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cities.map(c => (
              <Link
                key={c.name}
                href={c.href}
                className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-[#C49A2E] hover:shadow-lg transition-all"
              >
                <div className="text-xs font-bold text-[#C49A2E] uppercase tracking-wider mb-2">Georgia</div>
                <h3 className="text-2xl font-black text-[#1B3A5C] mb-1">{c.name}</h3>
                <p className="text-sm text-slate-600 mb-3">{c.tagline}</p>
                <p className="text-xs text-slate-500">{c.stats}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1B3A5C] group-hover:text-[#C49A2E] transition-colors">
                  View Projects <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Talk to a Georgia specialist</h2>
        <p className="text-slate-600 mb-8 max-w-xl mx-auto">
          PropGroup's advisors are on the ground in Georgia. We'll share the live shortlist, current prices, and help structure the purchase end-to-end.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1B3A5C] hover:bg-[#24507D] text-white font-semibold transition-colors"
        >
          Book a Call <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  )
}
