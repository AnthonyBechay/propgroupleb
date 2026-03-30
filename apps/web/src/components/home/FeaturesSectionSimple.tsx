'use client'

import { useState, useEffect } from 'react'
import { Brain, Shield, TrendingUp, LineChart } from 'lucide-react'
import { fetchSectionContent } from '@/lib/content'

const defaultFeatures = [
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Advanced algorithms analyze Georgian market trends and predict investment potential.',
    bgColor: 'bg-[#1B4965]',
  },
  {
    icon: TrendingUp,
    title: 'ROI Projections',
    description: 'Detailed return estimates backed by comprehensive Georgia market analysis.',
    bgColor: 'bg-emerald-600',
  },
  {
    icon: LineChart,
    title: 'Market Insights',
    description: 'Real-time Georgia market analytics with detailed performance metrics and forecasts.',
    bgColor: 'bg-[#C97B4B]',
  },
  {
    icon: Shield,
    title: 'Secure Transactions',
    description: 'Bank-level encryption and multi-factor authentication for your safety.',
    bgColor: 'bg-amber-700',
  },
]

export function FeaturesSectionSimple() {
  const [cms, setCms] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchSectionContent('features').then(setCms)
  }, [])

  const features = defaultFeatures.map((f, i) => ({
    ...f,
    title: cms[`feature-${i + 1}-title`] || f.title,
    description: cms[`feature-${i + 1}-description`] || f.description,
  }))

  return (
    <section className="relative py-16 sm:py-20 bg-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 mb-4">
            {cms['features-title'] || <>Why Choose{' '}<span className="text-[#1B4965]">PropGroup</span></>}
          </h2>
          <p className="text-lg text-stone-600">
            {cms['features-subtitle'] || 'Smart tools for smarter real estate investments'}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="group bg-white border border-stone-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
              >
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.bgColor} shadow-md mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
