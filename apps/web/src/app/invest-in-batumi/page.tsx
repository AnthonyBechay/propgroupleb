import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, TrendingUp, Plane, Building2, Sun, Ship, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react'

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === 'production' ? 'https://bechays.com' : 'http://localhost:3000')

const TITLE = 'Invest in Batumi Real Estate — Off-Plan & New Build Projects | PropGroup'
const DESCRIPTION =
  "Batumi is Georgia's fastest-growing Black Sea resort city — strong tourism, no capital gains tax on primary residence, rental yields up to 12%. Browse vetted investment projects with transparent ROI and flexible payment plans."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/invest-in-batumi` },
  keywords: [
    'invest in Batumi',
    'Batumi real estate',
    'Batumi apartments for sale',
    'Batumi investment properties',
    'Batumi sea view apartments',
    'Batumi rental yield',
    'Black Sea real estate',
    'Adjara property',
    'Batumi off-plan',
    'Batumi short-term rental',
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/invest-in-batumi`,
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Invest in Batumi with PropGroup' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
}

const stats = [
  { label: 'Tourist arrivals (2025, est.)', value: '9.5M+', icon: Plane },
  { label: 'Average rental yield', value: '8–12%', icon: TrendingUp },
  { label: 'Foreign ownership', value: '100% legal', icon: ShieldCheck },
  { label: 'Capital gains on primary residence', value: '0%', icon: Sparkles },
]

const reasons = [
  {
    title: 'Booming tourism',
    icon: Sun,
    body: 'Batumi is the Black Sea\u2019s fastest-growing resort city, with summer peak occupancies above 90% for well-located short-term rental stock.',
  },
  {
    title: 'Direct international access',
    icon: Plane,
    body: 'Batumi International Airport and the highway to Tbilisi connect the city to Europe, the Middle East and the CIS year-round.',
  },
  {
    title: 'Investor-friendly tax regime',
    icon: ShieldCheck,
    body: 'No capital gains tax on primary residence after two years, a flat 20% income tax, and 5% rental income tax for small-business owners.',
  },
  {
    title: 'Deep-water port & trade gateway',
    icon: Ship,
    body: 'As Georgia\u2019s commercial capital, Batumi benefits from long-term infrastructure investment and a diversifying economy beyond tourism.',
  },
  {
    title: 'Affordable entry price',
    icon: Building2,
    body: 'Sea-view new-build apartments start from a fraction of comparable Mediterranean markets — with payment plans spread over the build.',
  },
  {
    title: 'PropGroup vets every project',
    icon: Sparkles,
    body: 'We only list developers we\u2019ve visited, with independent legal review, transparent payment plans and post-handover rental support.',
  },
]

const neighborhoods = [
  { name: 'New Boulevard', tagline: 'Resort-zone sea-view towers — peak short-term rental demand.' },
  { name: 'Old Boulevard', tagline: 'Established promenade, highest nightly rates in the city.' },
  { name: 'Gonio & Kvariati', tagline: 'Beachfront villages 15 min south — holiday homes and villa plots.' },
  { name: 'Khimshiashvili', tagline: 'Central, walkable, strong year-round long-term rental demand.' },
]

export default function InvestInBatumiPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Place',
        '@id': `${SITE_URL}/invest-in-batumi#place`,
        name: 'Batumi',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Batumi',
          addressRegion: 'Adjara',
          addressCountry: 'Georgia',
        },
        description: DESCRIPTION,
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Can foreigners buy property in Batumi?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Foreign nationals can own apartments in Batumi outright, with the same rights as Georgian citizens. Only agricultural land is restricted.',
            },
          },
          {
            '@type': 'Question',
            name: 'What rental yield can I expect in Batumi?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Well-located, well-managed short-term rental apartments in Batumi typically deliver 8\u201312% gross annual yield, depending on season length and operator quality.',
            },
          },
          {
            '@type': 'Question',
            name: 'How much does a Batumi apartment cost?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Off-plan sea-view apartments typically start from $1,200\u2013$2,500/m\u00b2 depending on finish level, view and building quality. PropGroup lists current pricing per project.',
            },
          },
          {
            '@type': 'Question',
            name: 'What taxes apply to rental income in Batumi?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Individual landlords pay a flat 5% tax on gross rental income under the Small Business Status regime, one of the lowest rates in the region.',
            },
          },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative bg-[#1B3A5C] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <Image src="/og-image.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C49A2E] mb-4">
            <MapPin className="w-4 h-4" /> Batumi · Georgia · Black Sea
          </div>
          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            Invest in Batumi real estate
            <span className="block text-[#C49A2E]">with clarity, not guesswork.</span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mb-8">
            {DESCRIPTION}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/properties?city=Batumi"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#C49A2E] hover:bg-[#B38824] text-white font-semibold transition-colors"
            >
              Browse Batumi Projects <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/30 transition-colors"
            >
              Talk to an Advisor
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center">
            <s.icon className="w-5 h-5 text-[#C49A2E] mx-auto mb-2" />
            <div className="text-2xl md:text-3xl font-black text-[#1B3A5C]">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Reasons */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-2">Why Batumi, right now</h2>
        <p className="text-center text-slate-600 max-w-2xl mx-auto mb-10">
          A rare combination of high short-term rental yield, low transaction cost, and a Mediterranean-grade coastline.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map(r => (
            <div key={r.title} className="bg-white rounded-xl p-6 border border-slate-200 hover:border-[#C49A2E] transition-colors">
              <r.icon className="w-6 h-6 text-[#C49A2E] mb-3" />
              <h3 className="font-bold text-slate-900 mb-2">{r.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Neighborhoods */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-2">Where to buy in Batumi</h2>
          <p className="text-center text-slate-600 max-w-2xl mx-auto mb-10">
            Different neighborhoods fit different strategies — rental-yield, capital growth, or lifestyle.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {neighborhoods.map(n => (
              <div key={n.name} className="bg-white rounded-xl p-5 border border-slate-200">
                <div className="text-xs font-bold text-[#C49A2E] uppercase tracking-wider mb-1">Batumi</div>
                <h3 className="font-bold text-slate-900 mb-2">{n.name}</h3>
                <p className="text-sm text-slate-600">{n.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Ready to see the shortlist?</h2>
        <p className="text-slate-600 mb-8 max-w-xl mx-auto">
          PropGroup's Batumi shortlist is live and priced in USD. No lead magnets, no hidden fees — full payment plans and documents available on every project.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/properties?city=Batumi"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1B3A5C] hover:bg-[#24507D] text-white font-semibold transition-colors"
          >
            See Batumi Projects <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/invest-in-georgia"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white border-2 border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#1B3A5C] hover:text-white font-semibold transition-colors"
          >
            Explore Georgia
          </Link>
        </div>
      </section>
    </div>
  )
}
