import { notFound } from 'next/navigation'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { PropertyImageGallery } from '@/components/PropertyImageGallery'
import { PropertyDescription } from '@/components/property/PropertyDescription'
import { MapPin, Bed, Bath, Maximize, TrendingUp, DollarSign, Shield, Building2, CreditCard, FileText, Download, Calendar, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

async function getSharedProperty(token: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/properties/shared/${token}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data
  } catch {
    return null
  }
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function SharedPropertyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const property = await getSharedProperty(token)

  if (!property) {
    notFound()
  }

  const hasInvestmentData = property.investmentData && (
    property.investmentData.expectedROI ||
    property.investmentData.rentalYield ||
    property.investmentData.capitalGrowth ||
    property.investmentData.paymentPlan ||
    property.investmentData.paymentPlanDetails
  )

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="PropGroup" width={32} height={32} className="rounded" />
            <span className="font-bold text-[#1B4965]">PropGroup</span>
          </Link>
          <span className="text-xs text-stone-400 bg-stone-100 px-3 py-1 rounded-full">Shared Property</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/properties" className="inline-flex items-center gap-1 text-sm text-[#1B4965] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Browse all properties
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <PropertyImageGallery images={property.images || []} title={property.title} />

            {/* Title & Location */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-900">{property.title}</h1>
              <div className="flex items-center gap-2 mt-2 text-stone-600">
                <MapPin className="w-4 h-4 text-[#C97B4B]" />
                <span>
                  {[property.district, property.city, property.country].filter(Boolean).join(', ')}
                </span>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <DollarSign className="w-5 h-5 text-[#C97B4B] mx-auto mb-1" />
                <div className="text-xl font-bold text-stone-900">
                  {formatPrice(property.price, property.currency)}
                </div>
                <div className="text-xs text-stone-500">Price</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <Bed className="w-5 h-5 text-[#1B4965] mx-auto mb-1" />
                <div className="text-xl font-bold text-stone-900">{property.bedrooms}</div>
                <div className="text-xs text-stone-500">Bedrooms</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <Bath className="w-5 h-5 text-[#1B4965] mx-auto mb-1" />
                <div className="text-xl font-bold text-stone-900">{property.bathrooms}</div>
                <div className="text-xs text-stone-500">Bathrooms</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <Maximize className="w-5 h-5 text-[#1B4965] mx-auto mb-1" />
                <div className="text-xl font-bold text-stone-900">{property.area}</div>
                <div className="text-xs text-stone-500">sqm</div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl p-6 border border-stone-200">
              <h2 className="text-lg font-semibold text-stone-900 mb-4">Description</h2>
              <PropertyDescription description={property.description} />
            </div>

            {/* Investment Data */}
            {hasInvestmentData && (
              <div className="bg-white rounded-xl p-6 border border-stone-200">
                <h2 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#1B4965]" /> Investment Overview
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {property.investmentData.rentalYield > 0 && (
                    <div className="bg-stone-50 rounded-lg p-3">
                      <div className="text-xs text-stone-500 mb-1">Rental Yield</div>
                      <div className="text-lg font-bold text-[#1B4965]">{property.investmentData.rentalYield}%</div>
                    </div>
                  )}
                  {property.investmentData.capitalGrowth > 0 && (
                    <div className="bg-stone-50 rounded-lg p-3">
                      <div className="text-xs text-stone-500 mb-1">Capital Growth</div>
                      <div className="text-lg font-bold text-[#1B4965]">{property.investmentData.capitalGrowth}%</div>
                    </div>
                  )}
                  {property.investmentData.expectedROI > 0 && (
                    <div className="bg-stone-50 rounded-lg p-3">
                      <div className="text-xs text-stone-500 mb-1">Expected ROI</div>
                      <div className="text-lg font-bold text-[#1B4965]">{property.investmentData.expectedROI}%</div>
                    </div>
                  )}
                  {property.investmentData.averageRentPerMonth > 0 && (
                    <div className="bg-stone-50 rounded-lg p-3">
                      <div className="text-xs text-stone-500 mb-1">Avg Rent/mo</div>
                      <div className="text-lg font-bold text-stone-900">
                        ${property.investmentData.averageRentPerMonth.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Plan */}
                {(property.investmentData.paymentPlan || property.investmentData.paymentPlanDetails) && (
                  <div className="mt-4 p-4 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-5 h-5 text-[#1B4965]" />
                      <h3 className="font-semibold text-stone-900">Payment Plan</h3>
                    </div>
                    <p className="text-sm text-stone-700 mb-3">
                      {property.investmentData.paymentPlanDetails?.summary || property.investmentData.paymentPlan}
                    </p>
                    {property.investmentData.paymentPlanDetails?.milestones?.length > 0 && (
                      <>
                        <div className="flex rounded-full overflow-hidden h-3 mb-3">
                          {property.investmentData.paymentPlanDetails.milestones.map((m: any, i: number) => {
                            const colors = ['bg-[#1B4965]', 'bg-[#2B6985]', 'bg-[#C97B4B]', 'bg-emerald-500', 'bg-amber-500']
                            return (
                              <div key={i} className={`${colors[i % colors.length]}`} style={{ width: `${m.percentage}%` }} title={`${m.label}: ${m.percentage}%`} />
                            )
                          })}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {property.investmentData.paymentPlanDetails.milestones.map((m: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg p-3 border border-stone-100">
                              <div className="text-stone-500 text-xs mb-1">{m.label}</div>
                              <div className="font-semibold text-[#1B4965] text-lg">{m.percentage}%</div>
                              {m.description && <div className="text-stone-500 text-xs mt-1">{m.description}</div>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Property Features */}
            {property.highlightedFeatures?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-stone-200">
                <h2 className="text-lg font-semibold text-stone-900 mb-4">Highlights</h2>
                <div className="flex flex-wrap gap-2">
                  {property.highlightedFeatures.map((feature: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-[#1B4965]/10 text-[#1B4965] rounded-full text-sm font-medium">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property Details Card */}
            <div className="bg-white rounded-xl p-6 border border-stone-200 sticky top-20">
              <div className="text-2xl font-bold text-[#1B4965] mb-4">
                {formatPrice(property.price, property.currency)}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Type</span>
                  <span className="font-medium text-stone-900 capitalize">{property.propertyType?.toLowerCase().replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Status</span>
                  <span className="font-medium text-stone-900 capitalize">{property.status?.toLowerCase().replace('_', ' ')}</span>
                </div>
                {property.furnishingStatus && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Furnishing</span>
                    <span className="font-medium text-stone-900 capitalize">{property.furnishingStatus.toLowerCase().replace('_', ' ')}</span>
                  </div>
                )}
                {property.floor && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Floor</span>
                    <span className="font-medium text-stone-900">{property.floor} of {property.floors}</span>
                  </div>
                )}
                {property.parkingSpaces > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Parking</span>
                    <span className="font-medium text-stone-900">{property.parkingSpaces} space{property.parkingSpaces > 1 ? 's' : ''}</span>
                  </div>
                )}
                {property.isGoldenVisaEligible && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-amber-700">Golden Visa Eligible</span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="mt-6 space-y-3">
                <Link
                  href="/contact"
                  className="block w-full py-3 px-4 bg-[#1B4965] text-white font-semibold rounded-xl text-center hover:bg-[#2B6985] transition-colors"
                >
                  Request Information
                </Link>
                <Link
                  href="/get-started"
                  className="block w-full py-3 px-4 bg-[#C97B4B] text-white font-semibold rounded-xl text-center hover:bg-[#b86a3e] transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Developer Info */}
            {property.developer && (
              <div className="bg-white rounded-xl p-6 border border-stone-200">
                <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-stone-400" /> Developer
                </h3>
                <div className="flex items-center gap-3">
                  {property.developer.logo && (
                    <img
                      src={normalizeFileUrl(property.developer.logo)}
                      alt={property.developer.name}
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200"
                    />
                  )}
                  <div>
                    <p className="font-medium text-stone-900">{property.developer.name}</p>
                    <p className="text-xs text-stone-500">{property.developer.country}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            {property.documents?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-stone-200">
                <h3 className="text-sm font-semibold text-stone-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-stone-400" /> Documents
                </h3>
                <div className="space-y-2">
                  {property.documents.map((doc: any) => (
                    <a
                      key={doc.id}
                      href={normalizeFileUrl(doc.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-stone-50 transition-colors group border border-stone-100"
                    >
                      <div className="w-9 h-9 bg-[#1B4965]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-[#1B4965]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{doc.title}</p>
                        <p className="text-xs text-stone-400">
                          {doc.type?.replace('_', ' ')}
                          {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-stone-400 group-hover:text-[#1B4965] transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-stone-500">
          Shared via <Link href="/" className="text-[#1B4965] font-medium hover:underline">PropGroup</Link>
        </div>
      </footer>
    </div>
  )
}
