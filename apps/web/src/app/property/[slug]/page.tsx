import { notFound } from 'next/navigation'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { RoiCalculator } from '@/components/RoiCalculator'
import { Button } from '@/components/ui/button'
import { MapPin, Building, Calendar, DollarSign, TrendingUp, Shield } from 'lucide-react'

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
  // Await params as it's now a Promise in Next.js 15
  const { slug } = await params;

  const property = await getProperty(slug)

  if (!property) {
    notFound()
  }

  // Calculate estimated monthly rent (simplified calculation)
  const estimatedRent = property.investmentData?.rentalYield
    ? (property.price * property.investmentData.rentalYield / 100) / 12
    : property.price * 0.005 // 6% annual yield as fallback

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Property Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <MapPin className="w-4 h-4" />
            <span className="capitalize">{property.country.toLowerCase()}</span>
            <span>•</span>
            <span className="capitalize">{property.status.toLowerCase().replace('_', ' ')}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {property.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            {property.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Property Images */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {property.images?.length > 0 ? (
                <div className="aspect-video bg-gray-200">
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-lg">No image available</span>
                </div>
              )}
            </div>

            {/* Property Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Property Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {property.bedrooms}
                  </div>
                  <div className="text-sm text-gray-600">Bedrooms</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {property.bathrooms}
                  </div>
                  <div className="text-sm text-gray-600">Bathrooms</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {property.area}
                  </div>
                  <div className="text-sm text-gray-600">Sq Ft</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    {property.currency}
                  </div>
                  <div className="text-sm text-gray-600">Currency</div>
                </div>
              </div>
            </div>

            {/* Investment Dashboard */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Investment Dashboard</h2>

              {property.investmentData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {property.investmentData.rentalYield?.toFixed(1) || 'N/A'}%
                    </div>
                    <div className="text-sm text-green-700">Rental Yield</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <DollarSign className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {property.investmentData.capitalGrowth?.toFixed(1) || 'N/A'}%
                    </div>
                    <div className="text-sm text-blue-700">Capital Growth YoY</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {property.isGoldenVisaEligible ? 'Yes' : 'No'}
                    </div>
                    <div className="text-sm text-purple-700">Golden Visa Eligible</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Investment data not available for this property.
                </div>
              )}
            </div>

            {/* ROI Calculator */}
            <RoiCalculator
              propertyPrice={property.price}
              estimatedRent={estimatedRent}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {property.currency} {property.price.toLocaleString()}
                </div>
                <div className="text-gray-600">
                  {property.currency} {(property.price / property.area).toFixed(0)} per sq ft
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Request Information
                </Button>
                <Button variant="outline" className="w-full">
                  Schedule Viewing
                </Button>
                <Button variant="outline" className="w-full">
                  Add to Favorites
                </Button>
              </div>
            </div>

            {/* Developer Info */}
            {property.developer && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Developer</h3>
                <div className="flex items-center space-x-3">
                  {property.developer.logo && (
                    <img
                      src={property.developer.logo}
                      alt={property.developer.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-gray-900">
                      {property.developer.name}
                    </div>
                    {property.developer.website && (
                      <a
                        href={property.developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
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
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Guide</h3>
                <div>
                  <div className="font-semibold text-gray-900 mb-2">
                    {property.locationGuide.title}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {property.locationGuide.content}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
