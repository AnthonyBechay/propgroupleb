import { Suspense } from 'react'
import { HeroSectionNew } from '@/components/home/HeroSectionNew'
import { FeaturedProjects } from '@/components/home/FeaturedProjects'
import { WhyPropGroup } from '@/components/home/WhyPropGroup'
import { CTASectionSimple } from '@/components/home/CTASectionSimple'

// Revalidate every 60s instead of force-dynamic to avoid hitting the DB on
// every single homepage visit.  New/edited properties appear within a minute.
export const revalidate = 60

export default async function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden w-full">
      {/* Hero Section with AI Search */}
      <HeroSectionNew />

      {/* Featured Projects */}
      <Suspense fallback={null}>
        <FeaturedProjects />
      </Suspense>

      {/* Why PropGroup + Investor Success (combined) */}
      <WhyPropGroup />

      {/* CTA Section */}
      <CTASectionSimple />
    </main>
  )
}
