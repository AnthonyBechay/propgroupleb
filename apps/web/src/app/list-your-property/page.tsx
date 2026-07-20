import { BadgePercent, ShieldCheck, Camera, PhoneCall } from 'lucide-react'
import { SubmitPropertyForm } from './SubmitPropertyForm'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  title: 'List Your Property Free — 0% Commission | PropGroup Lebanon',
  description:
    'Sell or rent your apartment in Lebanon with zero commission. Fill the form, our team reviews and publishes your property on PropGroup — free for both you and the buyer.',
  alternates: { canonical: `${SITE_URL}/list-your-property` },
  openGraph: {
    title: 'List Your Property Free — 0% Commission | PropGroup Lebanon',
    description:
      'Sell or rent your property in Lebanon with zero commission. Submit your details and photos — we review, approve and publish it for free.',
    url: `${SITE_URL}/list-your-property`,
    type: 'website',
  },
}

// Static marketing shell; the form itself is a client component.
export const revalidate = 3600

const STEPS = [
  { icon: Camera, title: 'Fill the form', text: 'Describe your property, add photos or a video, and your asking price. No photos? Ask for our free photo visit.' },
  { icon: ShieldCheck, title: 'We review it', text: 'Our team checks the details, visits if needed, and calls you to confirm everything.' },
  { icon: BadgePercent, title: 'Published — 0% commission', text: 'Your property goes live on PropGroup. No commission from you, none from the buyer.' },
]

export default function ListYourPropertyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'List Your Property Free — 0% Commission',
            url: `${SITE_URL}/list-your-property`,
            description: 'Submit your property in Lebanon for free. PropGroup reviews and publishes it with zero commission.',
          }),
        }}
      />

      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-700 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-18 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40 text-emerald-300 text-xs font-semibold uppercase tracking-wider px-3 py-1.5">
            <BadgePercent className="w-3.5 h-3.5" /> Limited campaign — 0% commission
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            List your property. Pay nothing.
          </h1>
          <p className="mt-4 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
            Selling or renting your apartment in Lebanon? Fill in the details below — our team reviews every
            submission, contacts you, and publishes it on PropGroup. <strong className="text-white">Zero commission</strong> between
            us and you.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-slate-700" />
                </div>
                <span className="text-xs font-semibold text-slate-400">STEP {i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <SubmitPropertyForm />

        <p className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <PhoneCall className="w-3.5 h-3.5" />
          We only use your contact details to review and publish your property — never for anything else.
        </p>
      </div>
    </div>
  )
}
