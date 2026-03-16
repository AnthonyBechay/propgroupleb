import { notFound } from 'next/navigation'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { RoiCalculator } from '@/components/RoiCalculator'
import { Button } from '@/components/ui/button'
import { PropertyImageGallery } from '@/components/PropertyImageGallery'
import { MapPin, Bed, Bath, Maximize, TrendingUp, DollarSign, Shield, Building2 } from 'lucide-react'

type PropertyPageProps = {
  params: Promise<{
    slug: string
  }>
}

async function getProperty(slug: string) {
  const baseUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)
  const res = await fetch(`${baseUrl}/api/properties/${slug}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Failed to fetch property: ${res.status}`)
  }

  const data = await res.json()
  return data.data || data.property || data
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const property = await getProperty(slug)

  if (!property) {
    notFound()
  }

  const estimatedRent = property.investmentData?.rentalYield
    ? (property.price * property.investmentData.rentalYield / 100) / 12
    : property.price * 0.005

  const statusLabel = property.status?.replace('_', ' ') || ''
  const statusColors: Record<string, string> = {
    'OFF_PLAN': 'bg-[#1B4965] text-white',
    'NEW_BUILD': 'bg-emerald-600 text-white',
    'RESALE': 'bg-stone-600 text-white',
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb + Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-stone-500 mb-3">
            <MapPin className="w-4 h-4" />
            <span className="capitalize">{property.country?.toLowerCase()}</span>
            {property.city && (
              <>
                <span>/</span>
                <span>{property.city}</span>
              </>
            )}
            <span>·</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[property.status] || 'bg-stone-100 text-stone-700'}`}>
              {statusLabel}
            </span>
            {property.isGoldenVisaEligible && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#C97B4B] text-white">
                Golden Visa
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3">
            {property.title}
          </h1>
          <p className="text-lg text-stone-600 max-w-3xl leading-relaxed">
            {property.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <PropertyImageGallery
              images={property.images || []}
              title={property.title}
            />

            {/* Property Details */}
            <div className="bg-white rounded-xl border border-stone-200 p-6">
              <h2 className="text-xl font-semibold text-stone-900 mb-6">Property Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-stone-50 rounded-lg">
                  <Bed className="w-6 h-6 text-[#1B4965] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-stone-900 mb-1">
                    {property.bedrooms}
                  </div>
                  <div className="text-sm text-stone-500">Bedrooms</div>
                </div>
                <div className="text-center p-4 bg-stone-50 rounded-lg">
                  <Bath className="w-6 h-6 text-[#1B4965] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-stone-900 mb-1">
                    {property.bathrooms}
                  </div>
                  <div className="text-sm text-stone-500">Bathrooms</div>
                </div>
                <div className="text-center p-4 bg-stone-50 rounded-lg">
                  <Maximize className="w-6 h-6 text-[#1B4965] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-stone-900 mb-1">
                    {property.area}
                  </div>
                  <div className="text-sm text-stone-500">m²</div>
                </div>
                <div className="text-center p-4 bg-stone-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-[#1B4965] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-stone-900 mb-1">
                    {property.currency}
                  </div>
                  <div className="text-sm text-stone-500">Currency</div>
                </div>
              </div>

              {/* Additional Details */}
              {(property.furnishingStatus || property.ownershipType || property.floors) && (
                <div className="mt-6 pt-6 border-t border-stone-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {property.furnishingStatus && (
                      <div>
                        <span className="text-stone-500">Furnishing:</span>{' '}
                        <span className="font-medium text-stone-800 capitalize">
                          {property.furnishingStatus.toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    {property.ownershipType && (
                      <div>
                        <span className="text-stone-500">Ownership:</span>{' '}
                        <span className="font-medium text-stone-800 capitalize">
                          {property.ownershipType.toLowerCase()}
                        </span>
                      </div>
                    )}
                    {property.floors && (
                      <div>
                        <span className="text-stone-500">Floors:</span>{' '}
                        <span className="font-medium text-stone-800">{property.floors}</span>
                      </div>
                    )}
                    {property.parkingSpaces && (
                      <div>
                        <span className="text-stone-500">Parking:</span>{' '}
                        <span className="font-medium text-stone-800">{property.parkingSpaces} spaces</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Investment Dashboard */}
            {property.investmentData && (
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h2 className="text-xl font-semibold text-stone-900 mb-6">Investment Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <TrendingUp className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-emerald-700 mb-1">
                      {property.investmentData.rentalYield?.toFixed(1) || 'N/A'}%
                    </div>
                    <div className="text-sm text-emerald-600">Rental Yield</div>
                  </div>
                  <div className="text-center p-5 bg-[#E8F1F5] rounded-xl border border-[#BBD9E8]">
                    <DollarSign className="w-7 h-7 text-[#1B4965] mx-auto mb-2" />
                    <div className="text-2xl font-bold text-[#1B4965] mb-1">
                      {property.investmentData.capitalGrowth?.toFixed(1) || 'N/A'}%
                    </div>
                    <div className="text-sm text-[#2B6985]">Capital Growth YoY</div>
                  </div>
                  <div className="text-center p-5 bg-[#FBF0E7] rounded-xl border border-[#E9C09A]">
                    <Shield className="w-7 h-7 text-[#C97B4B] mx-auto mb-2" />
                    <div className="text-2xl font-bold text-[#C97B4B] mb-1">
                      {property.isGoldenVisaEligible ? 'Eligible' : 'No'}
                    </div>
                    <div className="text-sm text-[#B86A3A]">Golden Visa</div>
                  </div>
                </div>

                {/* Extra investment details */}
                {(property.investmentData.expectedROI || property.investmentData.paymentPlan || property.investmentData.averageRentPerMonth) && (
                  <div className="mt-6 pt-6 border-t border-stone-200 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {property.investmentData.expectedROI && (
                      <div>
                        <span className="text-stone-500">Expected ROI:</span>{' '}
                        <span className="font-semibold text-stone-800">{property.investmentData.expectedROI}%</span>
                      </div>
                    )}
                    {property.investmentData.averageRentPerMonth && (
                      <div>
                        <span className="text-stone-500">Avg Rent/mo:</span>{' '}
                        <span className="font-semibold text-stone-800">${property.investmentData.averageRentPerMonth.toLocaleString()}</span>
                      </div>
                    )}
                    {property.investmentData.paymentPlan && (
                      <div>
                        <span className="text-stone-500">Payment Plan:</span>{' '}
                        <span className="font-semibold text-stone-800">{property.investmentData.paymentPlan}</span>
                      </div>
                    )}
                    {property.investmentData.downPaymentPercentage && (
                      <div>
                        <span className="text-stone-500">Down Payment:</span>{' '}
                        <span className="font-semibold text-stone-800">{property.investmentData.downPaymentPercentage}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ROI Calculator */}
            <RoiCalculator
              propertyPrice={property.price}
              estimatedRent={estimatedRent}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-xl border border-stone-200 p-6 sticky top-24">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-stone-900 mb-1">
                  {property.currency} {property.price?.toLocaleString()}
                </div>
                {property.area > 0 && (
                  <div className="text-sm text-stone-500">
                    {property.currency} {Math.round(property.price / property.area).toLocaleString()} / m²
                  </div>
                )}
                {property.investmentData?.expectedROI && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {property.investmentData.expectedROI}% ROI
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Button className="w-full bg-[#1B4965] hover:bg-[#2B6985] text-white">
                  Request Information
                </Button>
                <Button variant="outline" className="w-full border-[#1B4965] text-[#1B4965] hover:bg-[#E8F1F5]">
                  Schedule Viewing
                </Button>
                <Button variant="outline" className="w-full border-stone-300 text-stone-700 hover:bg-stone-50">
                  Add to Favorites
                </Button>
              </div>
            </div>

            {/* Developer Info */}
            {property.developer && (
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h3 className="text-base font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#1B4965]" />
                  Developer
                </h3>
                <div className="flex items-center gap-3">
                  {property.developer.logo && (
                    <img
                      src={property.developer.logo}
                      alt={property.developer.name}
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-stone-900">
                      {property.developer.name}
                    </div>
                    {property.developer.website && (
                      <a
                        href={property.developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#1B4965] hover:underline"
                      >
                        Visit Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Location Guide */}
            {property.locationGuide && (
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h3 className="text-base font-semibold text-stone-900 mb-3">Location Guide</h3>
                <div className="font-medium text-stone-800 mb-2">
                  {property.locationGuide.title}
                </div>
                <p className="text-sm text-stone-600 line-clamp-4 leading-relaxed">
                  {property.locationGuide.content}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
