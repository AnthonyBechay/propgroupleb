import { notFound } from 'next/navigation'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { resolveGoogleMapsEmbedUrl } from '@/lib/utils/map-embed'
import { CollapsibleRoiCalculator } from '@/components/property/CollapsibleRoiCalculator'
import { PropertyImageGallery } from '@/components/PropertyImageGallery'
import { PropertyDescription } from '@/components/property/PropertyDescription'
import { PropertySidebar } from '@/components/property/PropertySidebar'
import {
  MapPin, Bed, Bath, Maximize, TrendingUp, DollarSign, Shield,
  Building2, CreditCard, FileText, Download, Map as MapIcon,
  Home, Calendar, Sparkles,
} from 'lucide-react'

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

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  BROCHURE: 'Brochure',
  CONTRACT: 'Contract',
  LEGAL_DOCUMENT: 'Legal Document',
  CERTIFICATE: 'Certificate',
  OTHER: 'Document',
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params
  const property = await getProperty(slug)

  if (!property) {
    notFound()
  }

  const estimatedRent = property.investmentData?.rentalYield
    ? (property.price * property.investmentData.rentalYield / 100) / 12
    : property.price * 0.005

  const statusLabel = property.status?.replace('_', ' ') || ''
  const statusColors: Record<string, string> = {
    OFF_PLAN: 'bg-[#1B3A5C] text-white',
    NEW_BUILD: 'bg-emerald-600 text-white',
    RESALE: 'bg-slate-600 text-white',
  }

  const showInvestmentSection = hasInvestmentData(property.investmentData)
  const mapEmbedUrl = await resolveGoogleMapsEmbedUrl(property.locationUrl)
  const publicDocuments: any[] = Array.isArray(property.documents) ? property.documents : []

  const locationBits = [property.district, property.city, property.country?.charAt(0) + property.country?.slice(1).toLowerCase()]
    .filter(Boolean)
    .join(', ')

  const formatPrice = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: property.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(v)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* ─── Header ───────────────────────────────────────── */}
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 mb-2">
            <MapPin className="w-4 h-4" />
            <span>{locationBits || 'Location'}</span>
            <span>·</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[property.status] || 'bg-slate-100 text-slate-700'}`}>
              {statusLabel}
            </span>
            {property.isGoldenVisaEligible && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#D97706] text-white">
                Golden Visa
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            {property.title}
          </h1>
          <div className="mt-2 text-2xl md:text-3xl font-bold text-[#1B3A5C]">
            {formatPrice(property.price)}
          </div>
        </header>

        {/* ─── Two-column layout ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Image Gallery */}
            <PropertyImageGallery
              images={property.images || []}
              title={property.title}
            />

            {/* Quick Facts Row */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E0EDF7] flex items-center justify-center">
                    <Bed className="w-5 h-5 text-[#1B3A5C]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Bedrooms</div>
                    <div className="text-lg font-semibold text-slate-900">{property.bedrooms}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E0EDF7] flex items-center justify-center">
                    <Bath className="w-5 h-5 text-[#1B3A5C]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Bathrooms</div>
                    <div className="text-lg font-semibold text-slate-900">{property.bathrooms}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E0EDF7] flex items-center justify-center">
                    <Maximize className="w-5 h-5 text-[#1B3A5C]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Area</div>
                    <div className="text-lg font-semibold text-slate-900">{property.area} m²</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E0EDF7] flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#1B3A5C]" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Type</div>
                    <div className="text-lg font-semibold text-slate-900 capitalize">
                      {property.propertyType?.toLowerCase() || 'Property'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary details (if any) */}
              {(property.furnishingStatus || property.ownershipType || property.floors || property.parkingSpaces) && (
                <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {property.furnishingStatus && (
                    <div>
                      <div className="text-slate-500 text-xs">Furnishing</div>
                      <div className="font-medium text-slate-800 capitalize">
                        {property.furnishingStatus.toLowerCase().replace('_', ' ')}
                      </div>
                    </div>
                  )}
                  {property.ownershipType && (
                    <div>
                      <div className="text-slate-500 text-xs">Ownership</div>
                      <div className="font-medium text-slate-800 capitalize">
                        {property.ownershipType.toLowerCase()}
                      </div>
                    </div>
                  )}
                  {property.floors && (
                    <div>
                      <div className="text-slate-500 text-xs">Floors</div>
                      <div className="font-medium text-slate-800">{property.floors}</div>
                    </div>
                  )}
                  {property.parkingSpaces != null && property.parkingSpaces > 0 && (
                    <div>
                      <div className="text-slate-500 text-xs">Parking</div>
                      <div className="font-medium text-slate-800">{property.parkingSpaces}</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">About this Property</h2>
                <PropertyDescription description={property.description} />
              </div>
            )}

            {/* Investment Overview (only if data exists) */}
            {showInvestmentSection && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#1B3A5C]" />
                  Investment Overview
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {property.investmentData.rentalYield != null && property.investmentData.rentalYield > 0 && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2 text-emerald-700">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs font-medium">Rental Yield</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {property.investmentData.rentalYield.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {property.investmentData.capitalGrowth != null && property.investmentData.capitalGrowth > 0 && (
                    <div className="p-4 bg-[#E0EDF7] rounded-xl border border-[#BBD9E8]">
                      <div className="flex items-center gap-2 mb-2 text-[#1B3A5C]">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-xs font-medium">Capital Growth</span>
                      </div>
                      <div className="text-2xl font-bold text-[#1B3A5C]">
                        {property.investmentData.capitalGrowth.toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {property.investmentData.expectedROI != null && property.investmentData.expectedROI > 0 && (
                    <div className="p-4 bg-[#FEF3C7] rounded-xl border border-[#F5CE6E]">
                      <div className="flex items-center gap-2 mb-2 text-[#D97706]">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs font-medium">Expected ROI</span>
                      </div>
                      <div className="text-2xl font-bold text-[#D97706]">
                        {property.investmentData.expectedROI.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Plan */}
                {(property.investmentData.paymentPlan || property.investmentData.paymentPlanDetails) && (
                  <div className="mt-5 p-5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-[#1B3A5C]" />
                      <h3 className="font-semibold text-slate-900 text-sm">Payment Plan</h3>
                    </div>

                    {(property.investmentData.paymentPlanDetails?.summary || property.investmentData.paymentPlan) && (
                      <p className="text-sm text-slate-700 mb-3">
                        {property.investmentData.paymentPlanDetails?.summary || property.investmentData.paymentPlan}
                      </p>
                    )}

                    {property.investmentData.paymentPlanDetails?.milestones?.length > 0 && (
                      <>
                        <div className="flex rounded-full overflow-hidden h-2 mb-3">
                          {property.investmentData.paymentPlanDetails.milestones.map((m: any, i: number) => {
                            const colors = ['bg-[#1B3A5C]', 'bg-[#24507D]', 'bg-[#D97706]', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-400']
                            return (
                              <div
                                key={i}
                                className={`${colors[i % colors.length]}`}
                                style={{ width: `${m.percentage}%` }}
                                title={`${m.label}: ${m.percentage}%`}
                              />
                            )
                          })}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {property.investmentData.paymentPlanDetails.milestones.map((m: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg p-2 border border-slate-100">
                              <div className="text-slate-500 text-xs">{m.label}</div>
                              <div className="font-semibold text-[#1B3A5C]">{m.percentage}%</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {property.investmentData.completionDate && (
                      <div className="mt-3 pt-3 border-t border-slate-200 text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500">Expected Completion:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(property.investmentData.completionDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Location Map */}
            {mapEmbedUrl && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-5 pb-3 flex items-center gap-2">
                  <MapIcon className="w-5 h-5 text-[#1B3A5C]" />
                  <h2 className="text-lg font-semibold text-slate-900">Location</h2>
                </div>
                {property.address && (
                  <p className="px-5 pb-3 text-sm text-slate-600">{property.address}</p>
                )}
                <div className="relative w-full aspect-[16/9] bg-slate-100">
                  <iframe
                    src={mapEmbedUrl}
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    title={`Map of ${property.title}`}
                  />
                </div>
                <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
                  <a
                    href={property.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#1B3A5C] hover:underline font-medium"
                  >
                    Open in Google Maps →
                  </a>
                </div>
              </div>
            )}

            {/* Documents */}
            {publicDocuments.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#1B3A5C]" />
                  Documents
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {publicDocuments.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:border-[#1B3A5C] hover:bg-slate-50 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#E0EDF7] flex items-center justify-center flex-shrink-0 group-hover:bg-[#1B3A5C] transition-colors">
                        <FileText className="w-5 h-5 text-[#1B3A5C] group-hover:text-white transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">{doc.title}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span>{DOCUMENT_TYPE_LABELS[doc.type] || 'Document'}</span>
                          {doc.fileSize && (
                            <>
                              <span>·</span>
                              <span>{formatFileSize(doc.fileSize)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-[#1B3A5C] flex-shrink-0 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ROI Calculator (collapsible) */}
            <CollapsibleRoiCalculator
              propertyPrice={property.price}
              estimatedRent={estimatedRent}
            />
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <PropertySidebar
              propertyId={property.id}
              title={property.title}
              price={property.price}
              currency={property.currency}
              area={property.area}
              expectedROI={property.investmentData?.expectedROI}
            />

            {/* Developer */}
            {property.developer && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
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
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {property.developer.name}
                    </div>
                    {property.developer.website && (
                      <a
                        href={property.developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1B3A5C] hover:underline"
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
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Location Guide</h3>
                <div className="font-medium text-slate-800 text-sm mb-1">
                  {property.locationGuide.title}
                </div>
                <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed">
                  {property.locationGuide.content}
                </p>
              </div>
            )}

            {/* Golden Visa badge */}
            {property.isGoldenVisaEligible && (
              <div className="bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border border-[#F5CE6E] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-[#D97706]" />
                  <h3 className="text-sm font-semibold text-[#92400E]">Golden Visa Eligible</h3>
                </div>
                <p className="text-xs text-[#92400E]/80">
                  This property qualifies for residency-by-investment programs.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
