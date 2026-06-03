import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  MapPin,
  Bed,
  Bath,
  Square,
  Building2,
  ChevronRight,
  Tag,
  Zap,
  Droplets,
  Sun,
  Shield,
  Users,
  Waves,
  Dumbbell,
  TreePine,
  FileText,
  Download,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { InquiryFormModal } from '@/components/listing/InquiryFormModal'
import { ListingGallery } from '@/components/listing/ListingGallery'
import type { Listing } from '@/types'
import {
  ListingIntent,
  UnitKind,
  BuildingKind,
  Currency,
  PropertyStatus,
  UnitLifecycle,
} from '@/types'

export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

async function fetchListing(slug: string): Promise<Listing | null> {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  try {
    const res = await fetch(`${apiUrl}/api/listings/slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.data ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const listing = await fetchListing(slug)
  if (!listing) return { title: 'Listing Not Found' }
  const title = listing.headline ?? listing.building?.title ?? 'Listing'
  return {
    title: `${title} | PropGroup Lebanon`,
    description: listing.description ?? listing.building?.shortDescription ?? undefined,
  }
}

const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  [UnitKind.APARTMENT]: 'Apartment',
  [UnitKind.SHOP]: 'Shop',
  [UnitKind.OFFICE]: 'Office',
  [UnitKind.STUDIO]: 'Studio',
  [UnitKind.PENTHOUSE]: 'Penthouse',
  [UnitKind.DUPLEX]: 'Duplex',
  [UnitKind.VILLA]: 'Villa',
  [UnitKind.LAND_PARCEL]: 'Land Parcel',
  [UnitKind.STORAGE]: 'Storage',
  [UnitKind.PARKING]: 'Parking',
}

const BUILDING_KIND_LABELS: Record<BuildingKind, string> = {
  [BuildingKind.STANDALONE]: 'Building',
  [BuildingKind.PROJECT]: 'Development Project',
  [BuildingKind.COMMUNITY]: 'Community',
  [BuildingKind.MIXED_USE]: 'Mixed-Use Development',
}

const STATUS_LABELS: Record<PropertyStatus, string> = {
  [PropertyStatus.OFF_PLAN]: 'Off Plan',
  [PropertyStatus.NEW_BUILD]: 'New Build',
  [PropertyStatus.RESALE]: 'Resale',
}

const LIFECYCLE_LABELS: Record<UnitLifecycle, { label: string; color: string }> = {
  [UnitLifecycle.DRAFT]: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
  [UnitLifecycle.FOR_SALE]: { label: 'For Sale', color: 'bg-emerald-100 text-emerald-700' },
  [UnitLifecycle.RESERVED]: { label: 'Reserved', color: 'bg-amber-100 text-amber-700' },
  [UnitLifecycle.SOLD]: { label: 'Sold', color: 'bg-red-100 text-red-700' },
  [UnitLifecycle.OWNER_OCCUPIED]: { label: 'Owner Occupied', color: 'bg-blue-100 text-blue-700' },
  [UnitLifecycle.FOR_RENT]: { label: 'For Rent', color: 'bg-blue-100 text-blue-700' },
  [UnitLifecycle.RENTED]: { label: 'Rented', color: 'bg-slate-100 text-slate-600' },
  [UnitLifecycle.VACANT]: { label: 'Vacant', color: 'bg-slate-100 text-slate-600' },
  [UnitLifecycle.OFF_MARKET]: { label: 'Off Market', color: 'bg-slate-100 text-slate-600' },
}

function formatPrice(amount: number, currency: Currency): string {
  if (currency === Currency.LBP) {
    if (amount >= 1_000_000_000) return `LBP ${(amount / 1_000_000_000).toFixed(2)}B`
    return `LBP ${(amount / 1_000_000).toFixed(1)}M`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { slug } = await params
  const listing = await fetchListing(slug)

  if (!listing) notFound()

  const { building, unit } = listing

  const images =
    (unit?.images?.length ? unit.images : null) ??
    (building?.images?.length ? building.images : null) ??
    []

  const title = listing.headline ?? building?.title ?? 'Listing'

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-6">
          <Link href="/listings" className="hover:text-slate-800 transition-colors">
            Listings
          </Link>
          {building && listing.subjectType === 'UNIT' && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-700">{building.title}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-900 font-medium line-clamp-1">{title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image gallery (click any photo to open the full-screen viewer) */}
            <ListingGallery images={images} title={title} />

            {/* Title & badges */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                  {building && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-slate-500 text-sm">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {[building.city, building.caza, building.mohafazat]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      listing.intent === ListingIntent.FOR_SALE
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {listing.intent === ListingIntent.FOR_SALE ? 'For Sale' : 'For Rent'}
                  </span>
                  {building && (
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                      {STATUS_LABELS[building.status]}
                    </span>
                  )}
                  {unit && (
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        LIFECYCLE_LABELS[unit.lifecycle]?.color ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {LIFECYCLE_LABELS[unit.lifecycle]?.label ?? unit.lifecycle}
                    </span>
                  )}
                </div>
              </div>

              {/* Key specs */}
              {listing.subjectType === 'UNIT' && unit && (
                <div className="flex flex-wrap gap-4 py-3 border-t border-slate-100">
                  {unit.bedrooms != null && (
                    <div className="flex items-center gap-2">
                      <Bed className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700 font-medium">
                        {unit.bedrooms} Bedroom{unit.bedrooms !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {unit.bathrooms != null && (
                    <div className="flex items-center gap-2">
                      <Bath className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700 font-medium">
                        {unit.bathrooms} Bathroom{unit.bathrooms !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {unit.areaSqm && (
                    <div className="flex items-center gap-2">
                      <Square className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700 font-medium">{unit.areaSqm} m²</span>
                    </div>
                  )}
                  {unit.floor != null && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700 font-medium">Floor {unit.floor}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700 font-medium">
                      {UNIT_KIND_LABELS[unit.kind]}
                    </span>
                  </div>
                </div>
              )}

              {listing.subjectType === 'BUILDING' && building && (
                <div className="flex flex-wrap gap-4 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700 font-medium">
                      {BUILDING_KIND_LABELS[building.kind]}
                    </span>
                  </div>
                  {building._count?.units != null && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700 font-medium">
                        {building._count.units} Unit{building._count.units !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {(listing.description || building?.description) && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">About this property</h2>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                  {listing.description ?? building?.description}
                </p>
              </div>
            )}

            {/* Highlights */}
            {listing.highlights?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Highlights</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {listing.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Unit features */}
            {unit?.features && unit.features.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Features</h2>
                <ul className="grid grid-cols-2 gap-2">
                  {unit.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Building amenities */}
            {listing.subjectType === 'BUILDING' && building && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Building Amenities</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {building.hasPool && <AmenityChip icon={<Waves className="w-4 h-4" />} label="Pool" />}
                  {building.hasGym && <AmenityChip icon={<Dumbbell className="w-4 h-4" />} label="Gym" />}
                  {building.hasGenerator && <AmenityChip icon={<Zap className="w-4 h-4" />} label="Generator" />}
                  {building.hasSolarPower && <AmenityChip icon={<Sun className="w-4 h-4" />} label="Solar Power" />}
                  {building.hasElevator && <AmenityChip icon={<Building2 className="w-4 h-4" />} label="Elevator" />}
                  {building.hasSecurity && <AmenityChip icon={<Shield className="w-4 h-4" />} label="Security" />}
                  {building.hasConcierge && <AmenityChip icon={<Users className="w-4 h-4" />} label="Concierge" />}
                  {building.hasGarden && <AmenityChip icon={<TreePine className="w-4 h-4" />} label="Garden" />}
                  {building.hasRooftop && <AmenityChip icon={<Sun className="w-4 h-4" />} label="Rooftop" />}
                  {building.amenities?.map((a) => (
                    <AmenityChip key={a.id} label={a.name} />
                  ))}
                </div>
              </div>
            )}

            {/* Unit breakdown for PROJECT buildings */}
            {listing.subjectType === 'BUILDING' &&
              building?.kind === BuildingKind.PROJECT &&
              building.units &&
              building.units.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Available Units</h2>
                  {/* Group by UnitKind */}
                  {Object.entries(
                    building.units.reduce<Record<string, typeof building.units>>(
                      (acc, u) => ({ ...acc, [u.kind]: [...(acc[u.kind] ?? []), u] }),
                      {}
                    )
                  ).map(([kind, units]) => (
                    <div key={kind} className="mb-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        {UNIT_KIND_LABELS[kind as UnitKind]} ({units.length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {units.slice(0, 4).map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm"
                          >
                            <span className="text-slate-700 font-medium">
                              {u.unitNumber ?? u.name ?? `Unit ${u.id.slice(-4)}`}
                            </span>
                            <div className="flex items-center gap-3 text-slate-500">
                              {u.bedrooms != null && (
                                <span className="flex items-center gap-0.5">
                                  <Bed className="w-3 h-3" /> {u.bedrooms}
                                </span>
                              )}
                              {u.areaSqm && <span>{u.areaSqm} m²</span>}
                              {u.askingPrice && (
                                <span className="font-semibold text-slate-800">
                                  {formatPrice(u.askingPrice, u.askingCurrency ?? Currency.USD)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {units.length > 4 && (
                          <p className="text-sm text-slate-400 col-span-full">
                            +{units.length - 4} more units
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {/* Map */}
            {building?.latitude && building?.longitude && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Location</h2>
                <div className="rounded-xl overflow-hidden aspect-video bg-slate-100">
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/place?key=&q=${building.latitude},${building.longitude}&zoom=15`}
                    className="w-full h-full border-0"
                    loading="lazy"
                    title="Property location"
                  />
                </div>
                {building.address && (
                  <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {building.address}
                  </p>
                )}
              </div>
            )}

            {/* Public documents (floor plans, brochures, certificates, …) */}
            {(() => {
              type ListingDoc = {
                id: string
                title: string
                description?: string | null
                fileUrl: string
                fileSize?: number | null
                mimeType?: string | null
                type: string
                unitId?: string | null
              }
              const buildingDocs = (building as { documents?: ListingDoc[] } | null | undefined)?.documents
              const unitBuildingDocs = (unit as { building?: { documents?: ListingDoc[] } } | null | undefined)?.building?.documents
              const allDocs: ListingDoc[] = buildingDocs ?? unitBuildingDocs ?? []
              // Show docs scoped to this listing: building-level docs (unitId null) +
              // docs explicitly tied to this listing's unit.
              const docs = allDocs.filter(
                (d) => !d.unitId || (unit?.id && d.unitId === unit.id)
              )
              if (docs.length === 0) return null

              const TYPE_LABELS: Record<string, string> = {
                FLOOR_PLAN: 'Floor Plan',
                BROCHURE: 'Brochure',
                CONTRACT: 'Contract',
                LEGAL_DOCUMENT: 'Legal Document',
                CERTIFICATE: 'Certificate',
                OTHER: 'Document',
              }
              const formatSize = (bytes?: number | null) => {
                if (!bytes) return ''
                if (bytes < 1024) return `${bytes} B`
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
              }

              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    Documents
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {docs.map((d) => (
                      <a
                        key={d.id}
                        href={normalizeFileUrl(d.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-white flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{d.title}</p>
                          <p className="text-xs text-slate-500">
                            {TYPE_LABELS[d.type] ?? d.type.replace(/_/g, ' ')}
                            {d.fileSize ? ` · ${formatSize(d.fileSize)}` : ''}
                          </p>
                        </div>
                        <Download className="w-4 h-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Price card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-6">
              <div className="mb-4">
                <p className="text-3xl font-bold text-slate-900">
                  {formatPrice(listing.price, listing.currency)}
                  {listing.intent === ListingIntent.FOR_RENT && listing.rentPeriod && (
                    <span className="text-base font-normal text-slate-500 ml-1">
                      /{listing.rentPeriod.toLowerCase()}
                    </span>
                  )}
                </p>
                {listing.currency === Currency.USD &&
                  listing.subjectType === 'UNIT' &&
                  unit?.areaSqm &&
                  unit.areaSqm > 0 && (
                    <p className="text-sm text-slate-400 mt-0.5">
                      {formatPrice(
                        Math.round(listing.price / unit.areaSqm),
                        listing.currency
                      )}{' '}
                      / m²
                    </p>
                  )}
              </div>

              {/* Unit options */}
              {unit?.options && unit.options.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Available Options</p>
                  {unit.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg"
                    >
                      <span className="text-sm text-slate-700">{opt.name}</span>
                      {opt.askingPrice && (
                        <span className="text-sm font-semibold text-slate-900">
                          {formatPrice(opt.askingPrice, opt.askingCurrency ?? Currency.USD)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <InquiryFormModal
                listingId={listing.id}
                listingTitle={title}
                buildingId={building?.id}
              />
            </div>

            {/* Agent card */}
            {building?.agent && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Listed by</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-slate-600">
                      {building.agent.firstName?.charAt(0) ??
                        building.agent.email?.charAt(0)?.toUpperCase() ??
                        'A'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {building.agent.firstName && building.agent.lastName
                        ? `${building.agent.firstName} ${building.agent.lastName}`
                        : building.agent.email}
                    </p>
                    {building.agent.agentCompany && (
                      <p className="text-xs text-slate-500">{building.agent.agentCompany}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Building info (for unit listings) */}
            {listing.subjectType === 'UNIT' && building && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Building</p>
                <p className="text-sm font-medium text-slate-900">{building.title}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {building.hasGenerator && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Generator</span>}
                  {building.hasElevator && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Elevator</span>}
                  {building.hasPool && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Pool</span>}
                  {building.hasGym && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Gym</span>}
                  {building.hasSecurity && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">Security</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AmenityChip({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-700">
      {icon && <span className="text-slate-500">{icon}</span>}
      {label}
    </div>
  )
}
