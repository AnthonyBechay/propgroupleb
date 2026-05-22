'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Bed, Bath, Square, Building2, Home } from 'lucide-react'
import { normalizeFileUrl } from '@/lib/utils/api-url'
import type { Listing } from '@/types'
import { ListingIntent, UnitKind, BuildingKind, Currency } from '@/types'

interface ListingCardProps {
  listing: Listing
  priority?: boolean
}

const UNIT_KIND_LABELS: Record<UnitKind, string> = {
  [UnitKind.APARTMENT]: 'Apartment',
  [UnitKind.SHOP]: 'Shop',
  [UnitKind.OFFICE]: 'Office',
  [UnitKind.STUDIO]: 'Studio',
  [UnitKind.PENTHOUSE]: 'Penthouse',
  [UnitKind.DUPLEX]: 'Duplex',
  [UnitKind.VILLA]: 'Villa',
  [UnitKind.LAND_PARCEL]: 'Land',
  [UnitKind.STORAGE]: 'Storage',
  [UnitKind.PARKING]: 'Parking',
}

const BUILDING_KIND_LABELS: Record<BuildingKind, string> = {
  [BuildingKind.STANDALONE]: 'Building',
  [BuildingKind.PROJECT]: 'Project',
  [BuildingKind.COMMUNITY]: 'Community',
  [BuildingKind.MIXED_USE]: 'Mixed Use',
}

function formatPrice(amount: number, currency: Currency): string {
  if (currency === Currency.LBP) {
    return `LBP ${(amount / 1_000_000).toFixed(1)}M`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ListingCard({ listing, priority = false }: ListingCardProps) {
  const { unit, building } = listing

  // Pick the best image source
  const images =
    (unit?.images?.length ? unit.images : null) ??
    (building?.images?.length ? building.images : null) ??
    []

  const firstImage = images.length > 0 ? normalizeFileUrl(images[0]) : null

  // Location
  const city = building?.city
  const caza = building?.caza
  const locationParts = [city, caza].filter(Boolean)
  const locationLabel = locationParts.join(', ') || building?.mohafazat || 'Lebanon'

  // Type label
  const typeLabel = unit
    ? UNIT_KIND_LABELS[unit.kind]
    : building
    ? BUILDING_KIND_LABELS[building.kind]
    : 'Property'

  // Headline
  const headline = listing.headline ?? building?.title ?? 'Listing'

  // Specs
  const bedrooms = unit?.bedrooms
  const bathrooms = unit?.bathrooms
  const area = unit?.areaSqm
  const unitCount = listing.subjectType === 'BUILDING' ? building?._count?.units : null

  const intentColor =
    listing.intent === ListingIntent.FOR_SALE
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-blue-100 text-blue-700'
  const intentLabel =
    listing.intent === ListingIntent.FOR_SALE ? 'For Sale' : 'For Rent'

  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {firstImage ? (
          <Image
            src={firstImage}
            alt={headline}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            quality={75}
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-12 h-12 text-slate-300" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Intent badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${intentColor}`}>
            {intentLabel}
          </span>
        </div>

        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/70 text-white backdrop-blur-sm">
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="text-base font-semibold text-slate-900 line-clamp-1 group-hover:text-slate-700 transition-colors">
          {headline}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-slate-500 text-sm">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{locationLabel}</span>
        </div>

        {/* Specs */}
        {(bedrooms !== undefined && bedrooms !== null) ||
        (bathrooms !== undefined && bathrooms !== null) ||
        area ? (
          <div className="flex items-center gap-3 text-slate-600 text-sm">
            {bedrooms !== undefined && bedrooms !== null && (
              <div className="flex items-center gap-1">
                <Bed className="w-3.5 h-3.5 text-slate-400" />
                <span>{bedrooms} bed{bedrooms !== 1 ? 's' : ''}</span>
              </div>
            )}
            {bathrooms !== undefined && bathrooms !== null && (
              <div className="flex items-center gap-1">
                <Bath className="w-3.5 h-3.5 text-slate-400" />
                <span>{bathrooms} bath{bathrooms !== 1 ? 's' : ''}</span>
              </div>
            )}
            {area && (
              <div className="flex items-center gap-1">
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>{area} m²</span>
              </div>
            )}
          </div>
        ) : unitCount !== undefined && unitCount !== null ? (
          <div className="flex items-center gap-1 text-slate-600 text-sm">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{unitCount} unit{unitCount !== 1 ? 's' : ''}</span>
          </div>
        ) : null}

        {/* Price */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xl font-bold text-slate-900">
            {formatPrice(listing.price, listing.currency)}
            {listing.intent === ListingIntent.FOR_RENT && listing.rentPeriod && (
              <span className="text-sm font-normal text-slate-500 ml-1">
                /{listing.rentPeriod.toLowerCase()}
              </span>
            )}
          </p>
          {listing.currency === Currency.USD && listing.price > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              {area && area > 0 ? `${formatPrice(Math.round(listing.price / area), Currency.USD)}/m²` : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
