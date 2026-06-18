import { TrendingUp, Shield, Globe, Award } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { fetchSectionContent } from '@/lib/content'
import { ContactSection } from '@/components/contact/ContactSection'

export const metadata = {
  title: 'About PropGroup - Lebanon Real Estate Brokerage',
  description: 'PropGroup is Lebanon\'s trusted real estate brokerage for buying, renting, selling, and managing properties.',
}

// ISR: Without this, the page is built once at deploy time with whatever
// content the API returned then (often nothing if the backend wasn't up
// during build). With revalidate, Next regenerates the page in the
// background at most every 60s, so admin CMS edits surface within a
// minute instead of requiring a redeploy.
export const revalidate = 20

export default async function AboutPage() {
  const content = await fetchSectionContent('about')

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 sm:py-24 bg-slate-900 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              {content['about-title'] || <>Lebanon&apos;s Real Estate{' '}<span className="text-slate-300">Brokerage</span></>}
            </h1>
            <p className="text-xl text-slate-300">
              {content['about-description'] || 'Your trusted partner for buying, renting, selling, and managing real estate across Lebanon'}
            </p>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 shadow-md mb-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Market Expertise
                </h3>
                <p className="text-sm text-slate-600">
                  In-depth knowledge of Lebanon&apos;s neighborhoods and market trends
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 shadow-md mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Secure Process
                </h3>
                <p className="text-sm text-slate-600">
                  Bank-level security with comprehensive legal compliance
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 shadow-md mb-4">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Local Market Focus
                </h3>
                <p className="text-sm text-slate-600">
                  Built for Lebanon\u2019s neighborhoods and buyer workflows
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 shadow-md mb-4">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Expert Analysis
                </h3>
                <p className="text-sm text-slate-600">
                  AI-powered insights and professional market research
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Find Your Property?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Browse our listings and connect with our brokerage team
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/properties">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-14 px-10 text-base font-bold bg-slate-100 hover:bg-white text-slate-900 rounded-xl shadow-xl transition-all"
                >
                  Browse Properties
                </Button>
              </Link>
              <a href="#contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-14 px-10 text-base font-semibold bg-white/5 border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 rounded-xl backdrop-blur-sm transition-all"
                >
                  Contact Us
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contact (merged from the old /contact page) */}
      <ContactSection />
    </main>
  )
}
