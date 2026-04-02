'use client'

import { useState } from 'react'
import { Brain, Shield, TrendingUp, LineChart, Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Advanced algorithms analyze market trends and predict investment potential.',
    bgColor: 'bg-[#1B4965]',
  },
  {
    icon: TrendingUp,
    title: 'ROI Projections',
    description: 'Detailed return estimates backed by comprehensive market analysis.',
    bgColor: 'bg-emerald-600',
  },
  {
    icon: LineChart,
    title: 'Market Insights',
    description: 'Real-time analytics with detailed performance metrics and forecasts.',
    bgColor: 'bg-[#C97B4B]',
  },
  {
    icon: Shield,
    title: 'Secure Transactions',
    description: 'Bank-level encryption and multi-factor authentication for your safety.',
    bgColor: 'bg-amber-700',
  },
]

const testimonials = [
  {
    name: 'Sarah Mitchell',
    role: 'Real Estate Investor',
    location: 'New York, USA',
    rating: 5,
    text: "PropGroup transformed my investment strategy. Their AI-powered insights helped me identify opportunities I would have never found on my own.",
    investment: '$1.2M invested',
    returns: '14.5% annual return',
  },
  {
    name: 'Ahmed Al-Rashid',
    role: 'Tech Entrepreneur',
    location: 'Dubai, UAE',
    rating: 5,
    text: "The platform's transparency and data-driven approach gave me the confidence to diversify internationally. The golden visa support was invaluable.",
    investment: '$2.5M invested',
    returns: '16.2% annual return',
  },
  {
    name: 'Maria Gonz\u00e1lez',
    role: 'Portfolio Manager',
    location: 'Madrid, Spain',
    rating: 5,
    text: "As a professional investor, I appreciate the depth of market analysis PropGroup provides. Their team's expertise has been instrumental in achieving consistent returns.",
    investment: '$3.8M invested',
    returns: '13.8% annual return',
  },
]

export function WhyPropGroup() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const t = testimonials[currentIndex]

  return (
    <section className="py-16 sm:py-20 bg-white overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-3xl sm:text-4xl font-black text-stone-900 mb-3">
            Why Choose <span className="text-[#1B4965]">PropGroup</span>
          </h2>
          <p className="text-stone-600">
            Smart tools and proven results for smarter investments
          </p>
        </div>

        {/* Features grid — compact row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-14">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={index}
                className="bg-stone-50 border border-stone-200 rounded-xl p-5 hover:shadow-md transition-all"
              >
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${feature.bgColor} shadow-sm mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-stone-900 mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* Investor Success — compact testimonial */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-black text-stone-900">
              Investor <span className="text-[#1B4965]">Success</span>
            </h3>
            <p className="text-sm text-stone-500 mt-1">Real results from real investors</p>
          </div>

          <div className="relative">
            <Quote className="absolute -top-2 -left-2 w-12 h-12 text-[#1B4965]/10" />

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                {/* Avatar + info */}
                <div className="text-center sm:text-left shrink-0">
                  <div className="w-16 h-16 rounded-full bg-[#1B4965] flex items-center justify-center text-white text-lg font-bold mx-auto sm:mx-0">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 mt-2">{t.name}</h4>
                  <p className="text-xs text-stone-500">{t.role}</p>
                  <p className="text-xs text-stone-400">{t.location}</p>
                  <div className="flex justify-center sm:justify-start gap-0.5 mt-1.5">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                </div>

                {/* Quote + stats */}
                <div className="flex-1 min-w-0">
                  <p className="text-stone-700 leading-relaxed italic text-sm sm:text-base">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-stone-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-xs font-semibold text-stone-800">{t.investment}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-[#1B4965] rounded-full" />
                      <span className="text-xs font-semibold text-stone-800">{t.returns}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-center items-center gap-3 mt-5">
              <button onClick={prevTestimonial} className="p-2 rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="Previous">
                <ChevronLeft className="w-4 h-4 text-stone-600" />
              </button>
              <div className="flex items-center gap-1.5">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-1.5 transition-all duration-300 rounded-full ${
                      index === currentIndex ? 'w-6 bg-[#1B4965]' : 'w-1.5 bg-stone-300 hover:bg-stone-400'
                    }`}
                    aria-label={`Testimonial ${index + 1}`}
                  />
                ))}
              </div>
              <button onClick={nextTestimonial} className="p-2 rounded-full bg-white shadow hover:shadow-md transition-all" aria-label="Next">
                <ChevronRight className="w-4 h-4 text-stone-600" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
