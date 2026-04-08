'use client'

import { useState } from 'react'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import Image from 'next/image'

const testimonials = [
  {
    id: 1,
    name: 'Sarah Mitchell',
    role: 'Real Estate Investor',
    location: 'New York, USA',
    image: '/testimonials/sarah.jpg',
    rating: 5,
    text: "PropGroup transformed my investment strategy. Their AI-powered insights helped me identify opportunities I would have never found on my own. My portfolio has grown by 40% in just 18 months!",
    investment: '$1.2M invested',
    returns: '14.5% annual return',
  },
  {
    id: 2,
    name: 'Ahmed Al-Rashid',
    role: 'Tech Entrepreneur',
    location: 'Dubai, UAE',
    image: '/testimonials/ahmed.jpg',
    rating: 5,
    text: "The platform's transparency and data-driven approach gave me the confidence to diversify internationally. The golden visa support was invaluable for my family's future planning.",
    investment: '$2.5M invested',
    returns: '16.2% annual return',
  },
  {
    id: 3,
    name: 'Maria González',
    role: 'Portfolio Manager',
    location: 'Madrid, Spain',
    image: '/testimonials/maria.jpg',
    rating: 5,
    text: "As a professional investor, I appreciate the depth of market analysis PropGroup provides. Their team's expertise in emerging markets has been instrumental in achieving consistent returns.",
    investment: '$3.8M invested',
    returns: '13.8% annual return',
  },
]

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <section className="py-16 sm:py-20 bg-slate-50 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-3">
            Investor <span className="text-[#1B3A5C]">Success</span>
          </h2>
          <p className="text-lg text-slate-600">
            Real results from real investors
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Quote icon */}
            <Quote className="absolute -top-4 -left-4 w-16 h-16 text-[#1B3A5C]/15" />

            {/* Testimonial card */}
            <div className="bg-white border border-slate-200 shadow-lg rounded-2xl p-8 md:p-12">
              <div className="grid md:grid-cols-3 gap-8 items-center">
                {/* Author info */}
                <div className="md:col-span-1 text-center md:text-left">
                  <div className="relative w-32 h-32 mx-auto md:mx-0 mb-4">
                    <div className="w-32 h-32 rounded-full bg-[#1B3A5C] flex items-center justify-center text-white text-3xl font-bold">
                      {testimonials[currentIndex].name.split(' ').map(n => n[0]).join('')}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {testimonials[currentIndex].name}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {testimonials[currentIndex].role}
                  </p>
                  <p className="text-sm text-slate-500">
                    {testimonials[currentIndex].location}
                  </p>

                  {/* Rating */}
                  <div className="flex justify-center md:justify-start gap-1 mt-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${
                          i < testimonials[currentIndex].rating
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Testimonial content */}
                <div className="md:col-span-2 space-y-4">
                  <p className="text-lg text-slate-700 leading-relaxed italic">
                    "{testimonials[currentIndex].text}"
                  </p>

                  {/* Investment stats */}
                  <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-sm font-semibold text-slate-900">
                        {testimonials[currentIndex].investment}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#1B3A5C] rounded-full" />
                      <span className="text-sm font-semibold text-slate-900">
                        {testimonials[currentIndex].returns}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-center gap-4 mt-8">
              <button
                onClick={prevTestimonial}
                className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>

              {/* Dots indicator */}
              <div className="flex items-center gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2 transition-all duration-300 rounded-full ${
                      index === currentIndex
                        ? 'w-8 bg-[#1B3A5C]'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={nextTestimonial}
                className="p-3 rounded-full bg-white shadow-lg hover:shadow-xl transform hover:scale-110 transition-all"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
