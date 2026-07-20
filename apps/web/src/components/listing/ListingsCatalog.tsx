import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Globe, ArrowUpRight } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ListingsFilterBar } from '@/components/listing/ListingsFilterBar'
import { ListingCard } from '@/components/listing/ListingCard'
import type { Listing } from '@/types'

type SearchParams = Record<string, string | string[] | undefined>

async function fetchListings(params: SearchParams) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

  const sp = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) sp.set(key, Array.isArray(val) ? val[0] : val)
  }
  if (!sp.has('limit')) sp.set('limit', '24')
  if (!sp.has('status')) sp.set('status', 'ACTIVE')

  try {
    const res = await fetch(`${apiUrl}/api/listings?${sp.toString()}`, { next: { revalidate: 20 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      listings: (data.data ?? []) as Listing[],
      total: data.pagination?.total ?? 0,
      pages: data.pagination?.pages ?? 1,
    }
  } catch {
    return { listings: [] as Listing[], total: 0, pages: 1 }
  }
}

interface ListingsCatalogProps {
  searchParams: SearchParams
  /** Heading shown above the filter bar (also the page H1). */
  heading?: string
  /** Base path for pagination links — '/' for the homepage, '/listings' elsewhere. */
  basePath?: string
}

/**
 * The full property catalog: heading + filter bar + responsive card grid +
 * pagination. Shared between the homepage (`/`) and any other catalog mount so
 * the listing experience stays in one place.
 */
export async function ListingsCatalog({
  searchParams,
  heading = 'Properties for Sale & Rent in Lebanon',
  basePath = '/',
}: ListingsCatalogProps) {
  const { listings, total, pages } = await fetchListings(searchParams)
  const currentPage = parseInt(String(searchParams.page ?? '1'), 10)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Landing hero — greyish-blue band with the title centered */}
      <div className="bg-gradient-to-b from-slate-700 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            {heading}
          </h1>
          <p className="mt-4 text-slate-300 text-base sm:text-lg">
            {total > 0
              ? `Browse ${total.toLocaleString()} live listing${total !== 1 ? 's' : ''} across Lebanon — invest smart.`
              : 'Explore curated listings across Lebanon — invest smart.'}
          </p>

          {/* Cross-sell: foreign investment via the group's Georgia site */}
          <a
            href="https://propgrp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-400/50 transition-colors hover:bg-emerald-400"
          >
            <Globe className="h-4 w-4" />
            <span>Looking to invest abroad? Georgia at propgrp.com</span>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>

      {/* Filter bar overlaps the hero for a landing feel; listings show directly below */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 space-y-6 pb-6">
        {/* Filters */}
        <Suspense fallback={<div className="h-24 bg-white rounded-xl border border-slate-200 shadow-lg animate-pulse" />}>
          <ListingsFilterBar />
        </Suspense>

        {/* Results */}
        {listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
            <p className="text-slate-500 text-lg font-medium">No listings found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing, idx) => (
              <ListingCard key={listing.id} listing={listing} priority={idx < 4} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 py-4">
            {currentPage > 1 && (
              <PaginationLink
                href={buildPageHref(basePath, searchParams, currentPage - 1)}
                label="Previous"
                icon={<ChevronLeft className="w-4 h-4" />}
              />
            )}

            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === pages)
              .reduce<(number | 'ellipsis-start' | 'ellipsis-end')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push(idx === 1 ? 'ellipsis-start' : 'ellipsis-end')
                }
                acc.push(p)
                return acc
              }, [])
              .map((p) =>
                typeof p === 'string' ? (
                  <span key={p} className="px-2 text-slate-400 text-sm">…</span>
                ) : (
                  <PaginationLink
                    key={p}
                    href={buildPageHref(basePath, searchParams, p)}
                    label={String(p)}
                    active={p === currentPage}
                  />
                )
              )}

            {currentPage < pages && (
              <PaginationLink
                href={buildPageHref(basePath, searchParams, currentPage + 1)}
                label="Next"
                icon={<ChevronRight className="w-4 h-4" />}
                iconRight
              />
            )}
          </nav>
        )}

      </div>
    </div>
  )
}

function buildPageHref(basePath: string, params: SearchParams, page: number): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && k !== 'page') sp.set(k, Array.isArray(v) ? v[0] : v)
  }
  sp.set('page', String(page))
  return `${basePath}?${sp.toString()}`
}

function PaginationLink({
  href,
  label,
  active,
  icon,
  iconRight,
}: {
  href: string
  label: string
  active?: boolean
  icon?: React.ReactNode
  iconRight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
      }`}
    >
      {icon && !iconRight && icon}
      {label}
      {icon && iconRight && icon}
    </Link>
  )
}
