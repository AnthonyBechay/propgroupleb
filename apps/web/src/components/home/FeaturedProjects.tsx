import { getFeaturedProperties } from '@/lib/data'
import { PropertyCard } from '@/components/PropertyCard'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export async function FeaturedProjects() {
  let properties: any[] = []
  try {
    properties = await getFeaturedProperties(6)
  } catch {
    return null
  }

  if (!properties || properties.length === 0) {
    return null
  }

  return (
    <section className="py-16 sm:py-20 bg-slate-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
            Featured <span className="text-[#1B3A5C]">Projects</span>
          </h2>
          <p className="text-lg text-slate-600">
            Hand-picked investment opportunities in Georgia
          </p>
        </div>

        {/* Property Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {properties.slice(0, 6).map((property: any, index: number) => (
            <PropertyCard
              key={property.id}
              id={property.id}
              title={property.title}
              description={property.description || ''}
              price={property.price}
              currency={property.currency || 'USD'}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              area={property.area}
              country={property.country}
              status={property.status}
              images={property.images || []}
              isGoldenVisaEligible={property.isGoldenVisaEligible}
              investmentData={property.investmentData ? {
                expectedROI: property.investmentData.expectedROI,
                rentalYield: property.investmentData.rentalYield,
                capitalGrowth: property.investmentData.capitalGrowth,
              } : undefined}
              // First row (3 cards on desktop, 2 on tablet, 1 on mobile)
              // is above the fold — preload those hero images instead
              // of lazy-loading after viewport intersection. Cuts ~200ms
              // off LCP on the home page.
              priority={index < 3}
            />
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-10">
          <Link href="/properties">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold bg-[#1B3A5C] hover:bg-[#24507D] text-white rounded-xl shadow-lg transition-all"
            >
              <span className="flex items-center gap-2">
                View All Projects
                <ArrowRight className="w-5 h-5" />
              </span>
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
