'use client'

import { useState, useEffect } from 'react'
import { Brain, Shield, TrendingUp, LineChart } from 'lucide-react'
import { fetchSectionContent } from '@/lib/content'

const defaultFeatures = [
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Advanced algorithms analyze market trends and predict investment potential.',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    icon: TrendingUp,
    title: 'Verified ROI Data',
    description: 'Real projections backed by comprehensive market analysis and legal guarantees.',
    gradient: 'from-green-500 to-emerald-600',
  },
  {
    icon: LineChart,
    title: 'Market Insights',
    description: 'Real-time analytics with detailed performance metrics and forecasts.',
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    icon: Shield,
    title: 'Secure Transactions',
    description: 'Bank-level encryption and multi-factor authentication for your safety.',
    gradient: 'from-orange-500 to-red-600',
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
    <section className="relative py-16 sm:py-20 bg-white dark:from-[#0a1628] dark:to-[#0f2439] overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
            {cms['features-title'] || <>Why Choose{' '}<span className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-500 bg-clip-text text-transparent">PropGroup</span></>}
          </h2>
          <p className="text-lg text-gray-600 dark:text-slate-300">
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
                className="group bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/50 rounded-xl p-6 hover:shadow-lg transition-all duration-300"
              >
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-md mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
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
