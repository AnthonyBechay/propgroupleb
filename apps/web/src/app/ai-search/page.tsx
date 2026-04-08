import { AIPropertySearch } from '@/components/ai/AIPropertySearch'
import { Bot, Search, Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'AI Property Search | PropGroup',
  description: 'Find your perfect investment property using AI-powered natural language search',
}

export default function AISearchPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <section className="bg-[#1B3A5C] text-white py-8 sm:py-10">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3 h-3 text-[#C49A2E]" />
            AI-POWERED
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Find Properties with AI
          </h1>
          <p className="text-sm text-white/80 max-w-md mx-auto">
            Describe what you're looking for in plain English — our AI searches the database and finds matching properties instantly.
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <AIPropertySearch variant="page" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-bold text-slate-900 text-center mb-6">How It Works</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Describe', desc: 'Type what you want in plain English' },
                { step: '2', title: 'AI Filters', desc: 'Our AI extracts search criteria' },
                { step: '3', title: 'Results', desc: 'View matching properties instantly' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-9 h-9 bg-[#1B3A5C] text-white rounded-full flex items-center justify-center mx-auto mb-2 text-sm font-bold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{item.title}</h3>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/properties"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#1B3A5C] hover:underline"
              >
                Or browse all properties
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
