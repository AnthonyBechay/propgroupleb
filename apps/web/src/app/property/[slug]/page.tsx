import { notFound } from 'next/navigation'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { RoiCalculator } from '@/components/RoiCalculator'
import { PropertyImageGallery } from '@/components/PropertyImageGallery'
import { PropertyDescription } from '@/components/property/PropertyDescription'
import { PropertySidebar } from '@/components/property/PropertySidebar'
import { MapPin, Bed, Bath, Maximize, TrendingUp, DollarSign, Shield, Building2, CreditCard } from 'lucide-react'

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

/**
 * Returns true if the investment data has at least one meaningful value
 * (non-null, non-zero for numeric fields, or non-empty for strings).
 */
function hasInvestmentData(investmentData: any): boolean {
  if (!investmentData) return false
  const { rentalYield, capitalGrowth, expectedROI, averageRentPerMonth, paymentPlan, downPaymentPercentage } = investmentData
  return (
    (rentalYield != null && rentalYield > 0) ||
    (capitalGrowth != null && capitalGrowth > 0) ||
    (expectedROI != null && expectedROI > 0) ||
    (averageRentPerMonth != null && averageRentPerMonth > 0) ||
    (typeof paymentPlan === 'string' && paymentPlan.length > 0) ||
    (downPaymentPercentage != null && downPaymentPercentage > 0)
  )
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
    'OFF_PLAN': 'bg-[#1B3A5C] text-white',
    'NEW_BUILD': 'bg-emerald-600 text-white',
    'RESALE': 'bg-slate-600 text-white',
  }

  const showInvestmentSection = hasInvestmentData(property.investmentData)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb + Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <MapPin className="w-4 h-4" />
            <span className="capitalize">{property.country?.toLowerCase()}</span>
            {property.city && (
              <>
                <span>/</span>
                <span>{property.city}</span>
              </>
            )}
            <span>·</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[property.status] || 'bg-slate-100 text-slate-700'}`}>
              {statusLabel}
            </span>
            {property.isGoldenVisaEligible && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#C49A2E] text-white">
                Golden Visa
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            {property.title}
          </h1>
          <PropertyDescription description={property.description || ''} />
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
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Property Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Bed className="w-6 h-6 text-[#1B3A5C] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {property.bedrooms}
                  </div>
                  <div className="text-sm text-slate-500">Bedrooms</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Bath className="w-6 h-6 text-[#1B3A5C] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {property.bathrooms}
                  </div>
                  <div className="text-sm text-slate-500">Bathrooms</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <Maximize className="w-6 h-6 text-[#1B3A5C] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {property.area}
                  </div>
                  <div className="text-sm text-slate-500">m²</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-[#1B3A5C] mx-auto mb-2" />
                  <div className="text-2xl font-bold text-slate-900 mb-1">
                    {property.currency}
                  </div>
                  <div className="text-sm text-slate-500">Currency</div>
                </div>
              </div>

              {/* Additional Details */}
              {(property.furnishingStatus || property.ownershipType || property.floors) && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {property.furnishingStatus && (
                      <div>
                        <span className="text-slate-500">Furnishing:</span>{' '}
                        <span className="font-medium text-slate-800 capitalize">
                          {property.furnishingStatus.toLowerCase().replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    {property.ownershipType && (
                      <div>
                        <span className="text-slate-500">Ownership:</span>{' '}
                        <span className="font-medium text-slate-800 capitalize">
                          {property.ownershipType.toLowerCase()}
                        </span>
                      </div>
                    )}
                    {property.floors && (
                      <div>
                        <span className="text-slate-500">Floors:</span>{' '}
                        <span className="font-medium text-slate-800">{property.floors}</span>
                      </div>
                    )}
                    {property.parkingSpaces && (
                      <div>
                        <span className="text-slate-500">Parking:</span>{' '}
                        <span className="font-medium text-slate-800">{property.parkingSpaces} spaces</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Investment Dashboard - only show if there is meaningful data */}
            {showInvestmentSection && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Investment Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {property.investmentData.rentalYield != null && property.investmentData.rentalYield > 0 && (
                    <div className="text-center p-5 bg-emerald-50 rounded-xl border border-emerald-100">
                      <TrendingUp className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-emerald-700 mb-1">
                        {property.investmentData.rentalYield.toFixed(1)}%
                      </div>
                      <div className="text-sm text-emerald-600">Rental Yield</div>
                    </div>
                  )}
                  {property.investmentData.capitalGrowth != null && property.investmentData.capitalGrowth > 0 && (
                    <div className="text-center p-5 bg-[#E0EDF7] rounded-xl border border-[#BBD9E8]">
                      <DollarSign className="w-7 h-7 text-[#1B3A5C] mx-auto mb-2" />
                      <div className="text-2xl font-bold text-[#1B3A5C] mb-1">
                        {property.investmentData.capitalGrowth.toFixed(1)}%
                      </div>
                      <div className="text-sm text-[#24507D]">Capital Growth YoY</div>
                    </div>
                  )}
                  <div className="text-center p-5 bg-[#FBF0E7] rounded-xl border border-[#E9C09A]">
                    <Shield className="w-7 h-7 text-[#C49A2E] mx-auto mb-2" />
                    <div className="text-2xl font-bold text-[#C49A2E] mb-1">
                      {property.isGoldenVisaEligible ? 'Eligible' : 'No'}
                    </div>
                    <div className="text-sm text-[#A98327]">Golden Visa</div>
                  </div>
                </div>

                {/* Payment Plan Card */}
                {(property.investmentData.paymentPlan || property.investmentData.paymentPlanDetails) && (
                  <div className="mt-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-5 h-5 text-[#1B3A5C]" />
                      <h3 className="font-semibold text-slate-900">Payment Plan</h3>
                    </div>

                    {/* Summary text */}
                    {(property.investmentData.paymentPlanDetails?.summary || property.investmentData.paymentPlan) && (
                      <p className="text-sm text-slate-700 mb-3">
                        {property.investmentData.paymentPlanDetails?.summary || property.investmentData.paymentPlan}
                      </p>
                    )}

                    {/* Structured milestones visualization */}
                    {property.investmentData.paymentPlanDetails?.milestones?.length > 0 && (
                      <div className="mb-3">
                        {/* Progress bar */}
                        <div className="flex rounded-full overflow-hidden h-3 mb-3">
                          {property.investmentData.paymentPlanDetails.milestones.map((milestone: any, i: number) => {
                            const colors = ['bg-[#1B3A5C]', 'bg-[#24507D]', 'bg-[#C49A2E]', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-400']
                            return (
                              <div
                                key={i}
                                className={`${colors[i % colors.length]} transition-all`}
                                style={{ width: `${milestone.percentage}%` }}
                                title={`${milestone.label}: ${milestone.percentage}%`}
                              />
                            )
                          })}
                        </div>

                        {/* Milestone details */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {property.investmentData.paymentPlanDetails.milestones.map((milestone: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg p-3 border border-slate-100">
                              <div className="text-slate-500 text-xs mb-1">{milestone.label}</div>
                              <div className="font-semibold text-[#1B3A5C] text-lg">{milestone.percentage}%</div>
                              {milestone.description && (
                                <div className="text-slate-500 text-xs mt-1">{milestone.description}</div>
                              )}
                              {milestone.dueDate && (
                                <div className="text-slate-400 text-xs mt-0.5">
                                  {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback: simple down payment / completion / installments cards */}
                    {!property.investmentData.paymentPlanDetails && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {property.investmentData.downPaymentPercentage != null && property.investmentData.downPaymentPercentage > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-slate-100">
                            <div className="text-slate-500 text-xs mb-1">Down Payment</div>
                            <div className="font-semibold text-[#1B3A5C]">
                              {property.investmentData.downPaymentPercentage}%
                            </div>
                          </div>
                        )}
                        {property.investmentData.completionDate && (
                          <div className="bg-white rounded-lg p-3 border border-slate-100">
                            <div className="text-slate-500 text-xs mb-1">Completion</div>
                            <div className="font-semibold text-[#1B3A5C]">
                              {new Date(property.investmentData.completionDate).toLocaleDateString('en-US', {
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Installment details for structured plans */}
                    {property.investmentData.paymentPlanDetails?.installmentFrequency && (
                      <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap gap-4 text-sm">
                        {property.investmentData.paymentPlanDetails.installmentFrequency && (
                          <div>
                            <span className="text-slate-500">Frequency:</span>{' '}
                            <span className="font-medium text-slate-800 capitalize">{property.investmentData.paymentPlanDetails.installmentFrequency}</span>
                          </div>
                        )}
                        {property.investmentData.paymentPlanDetails.totalInstallments && (
                          <div>
                            <span className="text-slate-500">Total Installments:</span>{' '}
                            <span className="font-medium text-slate-800">{property.investmentData.paymentPlanDetails.totalInstallments}</span>
                          </div>
                        )}
                        {property.investmentData.paymentPlanDetails.installmentAmount && (
                          <div>
                            <span className="text-slate-500">Per Installment:</span>{' '}
                            <span className="font-medium text-slate-800">${property.investmentData.paymentPlanDetails.installmentAmount.toLocaleString()}</span>
                          </div>
                        )}
                        {property.investmentData.paymentPlanDetails.postHandoverMonths && (
                          <div>
                            <span className="text-slate-500">Post-Handover:</span>{' '}
                            <span className="font-medium text-slate-800">{property.investmentData.paymentPlanDetails.postHandoverMonths} months</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completion date from main investment data */}
                    {property.investmentData.paymentPlanDetails && property.investmentData.completionDate && (
                      <div className="mt-3 pt-3 border-t border-slate-200 text-sm">
                        <span className="text-slate-500">Expected Completion:</span>{' '}
                        <span className="font-medium text-slate-800">
                          {new Date(property.investmentData.completionDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Extra investment details */}
                {(property.investmentData.expectedROI || property.investmentData.averageRentPerMonth) && (
                  <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {property.investmentData.expectedROI != null && property.investmentData.expectedROI > 0 && (
                      <div>
                        <span className="text-slate-500">Expected ROI:</span>{' '}
                        <span className="font-semibold text-slate-800">{property.investmentData.expectedROI}%</span>
                      </div>
                    )}
                    {property.investmentData.averageRentPerMonth != null && property.investmentData.averageRentPerMonth > 0 && (
                      <div>
                        <span className="text-slate-500">Avg Rent/mo:</span>{' '}
                        <span className="font-semibold text-slate-800">${property.investmentData.averageRentPerMonth.toLocaleString()}</span>
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

          {/* Sidebar - Client Component for interactivity */}
          <div>
            <PropertySidebar
              propertyId={property.id}
              title={property.title}
              price={property.price}
              currency={property.currency}
              area={property.area}
              expectedROI={property.investmentData?.expectedROI}
            />

            {/* Developer Info (server-rendered, no interactivity needed) */}
            {property.developer && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#1B3A5C]" />
                  Developer
                </h3>
                <div className="flex items-center gap-3">
                  {property.developer.logo && (
                    <img
                      src={normalizeFileUrl(property.developer.logo)}
                      alt={property.developer.name}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-slate-900">
                      {property.developer.name}
                    </div>
                    {property.developer.website && (
                      <a
                        href={property.developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#1B3A5C] hover:underline"
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
              <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
                <h3 className="text-base font-semibold text-slate-900 mb-3">Location Guide</h3>
                <div className="font-medium text-slate-800 mb-2">
                  {property.locationGuide.title}
                </div>
                <p className="text-sm text-slate-600 line-clamp-4 leading-relaxed">
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
