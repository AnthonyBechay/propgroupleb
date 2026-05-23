import { Suspense } from 'react'
import { HeroSectionNew } from '@/components/home/HeroSectionNew'
import { FeaturedProjects } from '@/components/home/FeaturedProjects'
import { WhyPropGroup } from '@/components/home/WhyPropGroup'
import { CTASectionSimple } from '@/components/home/CTASectionSimple'

export const revalidate = 60

export default async function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden w-full">
      <HeroSectionNew />
      <Suspense fallback={null}>
        <FeaturedProjects />
      </Suspense>
      <WhyPropGroup />
      <CTASectionSimple />
    </main>
  )
}
