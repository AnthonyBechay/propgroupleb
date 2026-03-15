import { TrendingUp, Shield, Globe, Award } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { fetchSectionContent } from '@/lib/content'

export const metadata = {
  title: 'About PropGroup - Real Estate Investment Platform',
  description: 'AI-powered platform for verified real estate investments with data-driven ROI projections.',
}

export default async function AboutPage() {
  const content = await fetchSectionContent('about')

  return (
    <main className="min-h-screen bg-white dark:bg-[#0a1628]">
      {/* Hero Section */}
      <section className="relative py-20 sm:py-24 bg-gradient-to-br from-[#0a1628] to-[#1e293b] overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6">
              {content['about-title'] || <>Smart Real Estate{' '}<span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Investments</span></>}
            </h1>
            <p className="text-xl text-slate-300">
              {content['about-description'] || 'We help investors make data-driven real estate decisions with AI-powered analysis and verified ROI data'}
            </p>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 bg-white dark:bg-[#0a1628]">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md mb-4">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Verified ROI
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Real projections backed by comprehensive market analysis
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-md mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Secure Process
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Bank-level security with comprehensive legal compliance
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-md mb-4">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Global Markets
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Access premium international real estate opportunities
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-xl p-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-md mb-4">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Expert Analysis
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  AI-powered insights and professional market research
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-[#0a1628] to-[#1e293b]">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Start Investing?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Browse verified properties with transparent ROI data
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/properties">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-14 px-10 text-base font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl shadow-xl transition-all"
                >
                  Browse Properties
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-14 px-10 text-base font-semibold bg-white/5 border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/30 rounded-xl backdrop-blur-sm transition-all"
                >
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
