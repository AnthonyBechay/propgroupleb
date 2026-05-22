import { Suspense } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { ListingsFilterBar } from '@/components/listing/ListingsFilterBar'
import { ListingCard } from '@/components/listing/ListingCard'
import type { Listing } from '@/types'

export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata = {
  title: 'Properties for Sale & Rent in Lebanon',
  description:
    'Browse apartments, villas, offices, and commercial spaces for sale and rent across Lebanon. Filter by region, type, price, and bedrooms.',
  alternates: { canonical: `${SITE_URL}/listings` },
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function fetchListings(params: Record<string, string | string[] | undefined>) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')

  const sp = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) sp.set(key, Array.isArray(val) ? val[0] : val)
  }
  if (!sp.has('limit')) sp.set('limit', '24')
  if (!sp.has('status')) sp.set('status', 'ACTIVE')

  try {
    const res = await fetch(`${apiUrl}/api/listings?${sp.toString()}`, { next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      listings: (data.data ?? []) as Listing[],
      total: data.pagination?.total ?? 0,
      pages: data.pagination?.pages ?? 1,
    }
  } catch {
    return { listings: [], total: 0, pages: 1 }
  }
}

export default async function ListingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { listings, total, pages } = await fetchListings(params)
  const currentPage = parseInt(String(params.page ?? '1'), 10)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Properties for Sale &amp; Rent in Lebanon
          </h1>
          <p className="mt-2 text-slate-500">
            {total > 0
              ? `${total.toLocaleString()} listing${total !== 1 ? 's' : ''} available`
              : 'Explore our curated listings across Lebanon'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <Suspense fallback={<div className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />}>
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
                href={buildPageHref(params, currentPage - 1)}
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
                    href={buildPageHref(params, p)}
                    label={String(p)}
                    active={p === currentPage}
                  />
                )
              )}

            {currentPage < pages && (
              <PaginationLink
                href={buildPageHref(params, currentPage + 1)}
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

function buildPageHref(
  params: Record<string, string | string[] | undefined>,
  page: number
): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && k !== 'page') sp.set(k, Array.isArray(v) ? v[0] : v)
  }
  sp.set('page', String(page))
  return `/listings?${sp.toString()}`
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
