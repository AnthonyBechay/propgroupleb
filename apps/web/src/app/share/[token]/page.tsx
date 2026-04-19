import { notFound } from 'next/navigation'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { PropertyImageGallery } from '@/components/PropertyImageGallery'
import { PropertyDescription } from '@/components/property/PropertyDescription'
import { MapPin, Bed, Bath, Maximize, TrendingUp, DollarSign, Shield, Building2, CreditCard, FileText, Download, Calendar, ArrowLeft, Package } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

const API_BASE_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL)

type ShareInfo = {
  scope: 'PROPERTY' | 'UNIT' | 'UNIT_OPTION'
  unitId: string | null
  unitOptionId: string | null
}

async function getSharedResource(token: string): Promise<{ property: any; share: ShareInfo } | null> {
  try {
    // New scoped share endpoint — supports PROPERTY / UNIT / UNIT_OPTION scopes
    // and falls back to legacy Property.shareToken internally.
    const res = await fetch(`${API_BASE_URL}/api/share/${token}`, { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const data = json.data ?? json
      if (data?.property) return data
    }
    // Ultimate fallback to legacy endpoint (kept for old links that may hit this page)
    const legacy = await fetch(`${API_BASE_URL}/api/properties/shared/${token}`, { cache: 'no-store' })
    if (!legacy.ok) return null
    const legacyJson = await legacy.json()
    return {
      property: legacyJson.data,
      share: { scope: 'PROPERTY', unitId: null, unitOptionId: null },
    }
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
  const resource = await getSharedResource(token)

  if (!resource) {
    notFound()
  }

  const { property, share } = resource

  // Narrow the data to the shared scope so viewers only see what was intended.
  const sharedUnit = share.unitId
    ? (property.units ?? []).find((u: any) => u.id === share.unitId) ?? null
    : null
  const sharedOption = share.unitOptionId && sharedUnit
    ? (sharedUnit.options ?? []).find((o: any) => o.id === share.unitOptionId) ?? null
    : null

  // Scope label for the banner
  const scopeLabel =
    share.scope === 'UNIT_OPTION' && sharedOption && sharedUnit
      ? `Finish Option · ${sharedUnit.name}${sharedUnit.unitNumber ? ` #${sharedUnit.unitNumber}` : ''} · ${sharedOption.name}`
      : share.scope === 'UNIT' && sharedUnit
        ? `Unit · ${sharedUnit.name}${sharedUnit.unitNumber ? ` #${sharedUnit.unitNumber}` : ''}`
        : 'Full Project'

  const hasInvestmentData = property.investmentData && (
    property.investmentData.expectedROI ||
    property.investmentData.rentalYield ||
    property.investmentData.capitalGrowth ||
    property.investmentData.paymentPlan ||
    property.investmentData.paymentPlanDetails
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="PropGroup" width={32} height={32} className="rounded" />
            <span className="font-bold text-[#1B3A5C]">PropGroup</span>
          </Link>
          <span className="text-xs font-medium text-[#1B3A5C] bg-[#E0EDF7] border border-[#1B3A5C]/20 px-3 py-1 rounded-full">
            Shared · {scopeLabel}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/properties" className="inline-flex items-center gap-1 text-sm text-[#1B3A5C] hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Browse all projects
        </Link>

        {/* Scope banner — surfaces exactly what the recipient is looking at */}
        {(share.scope === 'UNIT' || share.scope === 'UNIT_OPTION') && sharedUnit && (
          <div className="mb-6 rounded-xl border border-[#C49A2E]/40 bg-gradient-to-r from-[#FDF8EF] to-white p-4 flex items-start gap-3">
            <Package className="w-5 h-5 text-[#C49A2E] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#C49A2E] mb-0.5">
                {share.scope === 'UNIT_OPTION' ? 'Shared Finish Option' : 'Shared Unit'}
              </p>
              <p className="text-sm text-slate-700">
                You're viewing a scoped share for{' '}
                <span className="font-semibold text-[#1B3A5C]">{sharedUnit.name}</span>
                {sharedUnit.unitNumber && <> (#{sharedUnit.unitNumber})</>}
                {sharedOption && <> — finish <span className="font-semibold text-[#1B3A5C]">{sharedOption.name}</span></>}
                . Only the relevant details and documents are shown below.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <PropertyImageGallery images={property.images || []} title={property.title} />

            {/* Title & Location */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{property.title}</h1>
              <div className="flex items-center gap-2 mt-2 text-slate-600">
                <MapPin className="w-4 h-4 text-[#C49A2E]" />
                <span>
                  {[property.district, property.city, property.country].filter(Boolean).join(', ')}
                </span>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                <DollarSign className="w-5 h-5 text-[#C49A2E] mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-900">
                  {formatPrice(property.price, property.currency)}
                </div>
                <div className="text-xs text-slate-500">Price</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                <Bed className="w-5 h-5 text-[#1B3A5C] mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-900">{property.bedrooms}</div>
                <div className="text-xs text-slate-500">Bedrooms</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                <Bath className="w-5 h-5 text-[#1B3A5C] mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-900">{property.bathrooms}</div>
                <div className="text-xs text-slate-500">Bathrooms</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200 text-center">
                <Maximize className="w-5 h-5 text-[#1B3A5C] mx-auto mb-1" />
                <div className="text-xl font-bold text-slate-900">{property.area}</div>
                <div className="text-xs text-slate-500">sqm</div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Description</h2>
              <PropertyDescription description={property.description} />
            </div>

            {/* Scoped Unit / Option details — only when the share is narrower than the whole project */}
            {sharedUnit && (
              <div className="bg-white rounded-xl p-6 border-2 border-[#C49A2E]/40">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#1B3A5C]" />
                  {sharedOption ? `${sharedUnit.name} — ${sharedOption.name}` : sharedUnit.name}
                  {sharedUnit.unitNumber && (
                    <span className="text-xs font-mono bg-[#E0EDF7] text-[#1B3A5C] px-2 py-0.5 rounded">
                      #{sharedUnit.unitNumber}
                    </span>
                  )}
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Bed className="w-4 h-4 text-[#1B3A5C] mx-auto mb-1" />
                    <div className="text-lg font-bold text-slate-900">{sharedUnit.bedrooms}</div>
                    <div className="text-xs text-slate-500">Bedrooms</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Bath className="w-4 h-4 text-[#1B3A5C] mx-auto mb-1" />
                    <div className="text-lg font-bold text-slate-900">{sharedUnit.bathrooms}</div>
                    <div className="text-xs text-slate-500">Bathrooms</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <Maximize className="w-4 h-4 text-[#1B3A5C] mx-auto mb-1" />
                    <div className="text-lg font-bold text-slate-900">{sharedUnit.area}</div>
                    <div className="text-xs text-slate-500">sqm</div>
                  </div>
                  {sharedUnit.floor != null && (
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <Building2 className="w-4 h-4 text-[#1B3A5C] mx-auto mb-1" />
                      <div className="text-lg font-bold text-slate-900">{sharedUnit.floor}</div>
                      <div className="text-xs text-slate-500">Floor</div>
                    </div>
                  )}
                </div>

                {sharedOption ? (
                  /* Single-option view: price + plan for just this finish */
                  <div className="bg-gradient-to-br from-[#FDF8EF] to-white border border-[#C49A2E]/30 rounded-lg p-4">
                    <div className="flex justify-between items-start flex-wrap gap-3 mb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[#C49A2E] mb-0.5">Selected Finish</div>
                        <div className="text-xl font-bold text-[#1B3A5C]">{sharedOption.name}</div>
                        {sharedOption.description && (
                          <p className="text-sm text-slate-600 mt-1">{sharedOption.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase">Total</div>
                        <div className="text-2xl font-black text-[#1B3A5C]">
                          {formatPrice(sharedOption.pricePerSqm * sharedUnit.area, sharedOption.currency || property.currency)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatPrice(sharedOption.pricePerSqm, sharedOption.currency || property.currency)}/m²
                        </div>
                      </div>
                    </div>
                    {sharedOption.paymentPlanDetails?.milestones?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#C49A2E]/20">
                        <div className="text-xs font-bold uppercase tracking-wider text-[#1B3A5C] mb-2">Payment Plan</div>
                        <div className="flex rounded-full overflow-hidden h-2 mb-2">
                          {sharedOption.paymentPlanDetails.milestones.map((m: any, i: number) => {
                            const colors = ['bg-[#1B3A5C]', 'bg-[#C49A2E]', 'bg-emerald-500', 'bg-amber-500']
                            return <div key={i} className={colors[i % colors.length]} style={{ width: `${m.percentage}%` }} />
                          })}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {sharedOption.paymentPlanDetails.milestones.map((m: any, i: number) => (
                            <div key={i} className="bg-white rounded p-2 border border-slate-100 flex justify-between text-sm">
                              <span className="text-slate-600">{m.label}</span>
                              <span className="font-semibold text-[#1B3A5C]">{m.percentage}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Unit-level view: list all finish options available */
                  sharedUnit.options?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Available Finish Options</div>
                      {sharedUnit.options.map((opt: any) => (
                        <div key={opt.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div>
                            <div className="font-semibold text-slate-900">{opt.name}</div>
                            {opt.description && <div className="text-xs text-slate-500 mt-0.5">{opt.description}</div>}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[#1B3A5C]">
                              {formatPrice(opt.pricePerSqm * sharedUnit.area, opt.currency || property.currency)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatPrice(opt.pricePerSqm, opt.currency || property.currency)}/m²
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Investment Data */}
            {hasInvestmentData && (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#1B3A5C]" /> Investment Overview
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  {property.investmentData.rentalYield > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Rental Yield</div>
                      <div className="text-lg font-bold text-[#1B3A5C]">{property.investmentData.rentalYield}%</div>
                    </div>
                  )}
                  {property.investmentData.capitalGrowth > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Capital Growth</div>
                      <div className="text-lg font-bold text-[#1B3A5C]">{property.investmentData.capitalGrowth}%</div>
                    </div>
                  )}
                  {property.investmentData.expectedROI > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Expected ROI</div>
                      <div className="text-lg font-bold text-[#1B3A5C]">{property.investmentData.expectedROI}%</div>
                    </div>
                  )}
                  {property.investmentData.averageRentPerMonth > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Avg Rent/mo</div>
                      <div className="text-lg font-bold text-slate-900">
                        ${property.investmentData.averageRentPerMonth.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Plan */}
                {(property.investmentData.paymentPlan || property.investmentData.paymentPlanDetails) && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-5 h-5 text-[#1B3A5C]" />
                      <h3 className="font-semibold text-slate-900">Payment Plan</h3>
                    </div>
                    <p className="text-sm text-slate-700 mb-3">
                      {property.investmentData.paymentPlanDetails?.summary || property.investmentData.paymentPlan}
                    </p>
                    {property.investmentData.paymentPlanDetails?.milestones?.length > 0 && (
                      <>
                        <div className="flex rounded-full overflow-hidden h-3 mb-3">
                          {property.investmentData.paymentPlanDetails.milestones.map((m: any, i: number) => {
                            const colors = ['bg-[#1B3A5C]', 'bg-[#24507D]', 'bg-[#C49A2E]', 'bg-emerald-500', 'bg-amber-500']
                            return (
                              <div key={i} className={`${colors[i % colors.length]}`} style={{ width: `${m.percentage}%` }} title={`${m.label}: ${m.percentage}%`} />
                            )
                          })}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {property.investmentData.paymentPlanDetails.milestones.map((m: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg p-3 border border-slate-100">
                              <div className="text-slate-500 text-xs mb-1">{m.label}</div>
                              <div className="font-semibold text-[#1B3A5C] text-lg">{m.percentage}%</div>
                              {m.description && <div className="text-slate-500 text-xs mt-1">{m.description}</div>}
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
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Highlights</h2>
                <div className="flex flex-wrap gap-2">
                  {property.highlightedFeatures.map((feature: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-[#1B3A5C]/10 text-[#1B3A5C] rounded-full text-sm font-medium">
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
            <div className="bg-white rounded-xl p-6 border border-slate-200 sticky top-20">
              <div className="text-2xl font-bold text-[#1B3A5C] mb-4">
                {formatPrice(property.price, property.currency)}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-medium text-slate-900 capitalize">{property.propertyType?.toLowerCase().replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="font-medium text-slate-900 capitalize">{property.status?.toLowerCase().replace('_', ' ')}</span>
                </div>
                {property.furnishingStatus && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Furnishing</span>
                    <span className="font-medium text-slate-900 capitalize">{property.furnishingStatus.toLowerCase().replace('_', ' ')}</span>
                  </div>
                )}
                {property.floor && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Floor</span>
                    <span className="font-medium text-slate-900">{property.floor} of {property.floors}</span>
                  </div>
                )}
                {property.parkingSpaces > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parking</span>
                    <span className="font-medium text-slate-900">{property.parkingSpaces} space{property.parkingSpaces > 1 ? 's' : ''}</span>
                  </div>
                )}
                {property.isGoldenVisaEligible && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Shield className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-amber-700">Golden Visa Eligible</span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="mt-6 space-y-3">
                <Link
                  href="/contact"
                  className="block w-full py-3 px-4 bg-[#1B3A5C] text-white font-semibold rounded-xl text-center hover:bg-[#24507D] transition-colors"
                >
                  Request Information
                </Link>
                <Link
                  href="/get-started"
                  className="block w-full py-3 px-4 bg-[#C49A2E] text-white font-semibold rounded-xl text-center hover:bg-[#b86a3e] transition-colors"
                >
                  Get Started
                </Link>
              </div>
            </div>

            {/* Developer Info */}
            {property.developer && (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" /> Developer
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
                    <p className="font-medium text-slate-900">{property.developer.name}</p>
                    <p className="text-xs text-slate-500">{property.developer.country}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            {property.documents?.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" /> Documents
                </h3>
                <div className="space-y-2">
                  {property.documents.map((doc: any) => (
                    <a
                      key={doc.id}
                      href={normalizeFileUrl(doc.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group border border-slate-100"
                    >
                      <div className="w-9 h-9 bg-[#1B3A5C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-[#1B3A5C]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                        <p className="text-xs text-slate-400">
                          {doc.type?.replace('_', ' ')}
                          {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-slate-400 group-hover:text-[#1B3A5C] transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-slate-500">
          Shared via <Link href="/" className="text-[#1B3A5C] font-medium hover:underline">PropGroup</Link>
        </div>
      </footer>
    </div>
  )
}
