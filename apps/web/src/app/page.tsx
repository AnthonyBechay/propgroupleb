import { Suspense } from 'react'
import { HeroSectionNew } from '@/components/home/HeroSectionNew'
import { FeaturesSectionSimple } from '@/components/home/FeaturesSectionSimple'
import { FeaturedProjects } from '@/components/home/FeaturedProjects'
import { TestimonialsSection } from '@/components/home/TestimonialsSection'
import { CTASectionSimple } from '@/components/home/CTASectionSimple'

export const dynamic = 'force-dynamic'

export default async function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden w-full">
      {/* Hero Section with AI Search */}
      <HeroSectionNew />

      {/* Features Section */}
      <FeaturesSectionSimple />

      {/* Featured Projects */}
      <Suspense fallback={null}>
        <FeaturedProjects />
      </Suspense>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* CTA Section */}
      <CTASectionSimple />
    </main>
  )
}
