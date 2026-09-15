'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Archive, Building2, CircleDollarSign, Edit, ExternalLink, Eye, Layers,
  MapPin, Plus, Search, Tag,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/admin/ui/ConfirmDialog'
import { SelectInput, TextInput } from '@/components/admin/ui/form'
import { EmptyState, PageHeader, StatCard } from '@/components/admin/ui/layout'
import { listingRef, refMatches } from '@/lib/reference'
import { countryFlag, inMarket, MARKET_OPTIONS, type MarketScope } from '@/lib/market'
import { typeLabel } from '@/lib/property-types'
import { cn } from '@/lib/utils'

const INTENT_COLORS: Record<string, string> = {
  FOR_SALE: 'bg-emerald-100 text-emerald-800',
  FOR_RENT: 'bg-sky-100 text-sky-800',
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-zinc-100 text-zinc-600' },
  ACTIVE: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' },
  UNDER_OFFER: { label: 'Under offer', cls: 'bg-amber-100 text-amber-700' },
  CLOSED: { label: 'Closed', cls: 'bg-red-100 text-red-700' },
  ARCHIVED: { label: 'Archived', cls: 'bg-zinc-200 text-zinc-500' },
}

const PERIOD_SHORT: Record<string, string> = { MONTHLY: 'mo', QUARTERLY: 'qtr', YEARLY: 'yr' }

function formatPrice(price: number, currency: string) {
  if (currency === 'LBP') return `${(price / 1_000_000).toFixed(1)}M LBP`
  return `$${Number(price).toLocaleString()}`
}

type SortKey = 'newest' | 'priceDesc' | 'priceAsc' | 'caza'
type GroupKey = 'none' | 'building' | 'caza'

export default function AdminListingsPage() {
  const searchParams = useSearchParams()
  const initialBuildingId = searchParams.get('buildingId') ?? 'all'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [intentFilter, setIntentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [buildingFilter, setBuildingFilter] = useState(initialBuildingId)
  const [cazaFilter, setCazaFilter] = useState('all')
  // Both websites are managed from here, so the list mixes their stock.
  const [market, setMarket] = useState<MarketScope>('all')
  const [groupBy, setGroupBy] = useState<GroupKey>('none')
  const [sort, setSort] = useState<SortKey>('newest')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [buildings, setBuildings] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null)
  const [archiving, setArchiving] = useState(false)

  // Load the building list once, for the filter.
  useEffect(() => {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    fetch(`${apiUrl}/api/buildings?limit=200&visibility=all&country=all`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setBuildings(d.data ?? []))
      .catch(() => { /* the filter just stays empty */ })
  }, [])

  useEffect(() => {
    setLoading(true)
    // The admin manages both markets, so it asks for both.
    const params: Record<string, string> = { limit: '200', country: 'all' }
    if (intentFilter !== 'all') params.intent = intentFilter
    if (statusFilter !== 'all') params.status = statusFilter

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiClient.getListings(params as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => setListings(res.data ?? []))
      .catch(() => toast({ title: 'Could not load listings', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [intentFilter, statusFilter])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cazaOf = (l: any) => l.building?.caza || '—'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectOf = (l: any) => l.building?.title || 'Unassigned'
  /** A listing sits in a market via whichever property it belongs to. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryOf = (l: any) => l.building?.country ?? l.unit?.building?.country ?? 'LEBANON'

  const cazas = useMemo(
    () => Array.from(new Set(listings.map(cazaOf).filter((c) => c !== '—'))).sort(),
    [listings],
  )

  const filtered = useMemo(() => listings.filter((l) => {
    if (!inMarket(countryOf(l), market)) return false
    if (buildingFilter !== 'all') {
      const id = l.building?.id ?? l.unit?.buildingId ?? null
      if (id !== buildingFilter) return false
    }
    if (cazaFilter !== 'all' && cazaOf(l) !== cazaFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    const title = l.building?.title ?? l.unit?.name ?? l.headline ?? ''
    // Match the code shown on the row, or the property code it sits under, so
    // searching PG-1042 finds every unit of that property.
    return title.toLowerCase().includes(q)
      || refMatches(listingRef(l), search)
      || refMatches(l.building?.ref ?? l.unit?.building?.ref, search)
  }), [listings, market, buildingFilter, cazaFilter, search])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    switch (sort) {
      case 'priceDesc': return (b.price ?? 0) - (a.price ?? 0)
      case 'priceAsc': return (a.price ?? 0) - (b.price ?? 0)
      case 'caza': return cazaOf(a).localeCompare(cazaOf(b)) || projectOf(a).localeCompare(projectOf(b))
      default:
        return new Date(b.publishedAt ?? b.createdAt ?? 0).getTime()
          - new Date(a.publishedAt ?? a.createdAt ?? 0).getTime()
    }
  }), [filtered, sort])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups: Array<{ key: string; items: any[] }> = useMemo(() => {
    if (groupBy === 'none') return [{ key: '', items: sorted }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any[]>()
    for (const l of sorted) {
      const key = groupBy === 'building' ? projectOf(l) : cazaOf(l)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, items }))
  }, [sorted, groupBy])

  const stats = useMemo(() => ({
    total: listings.length,
    active: listings.filter((l) => l.status === 'ACTIVE').length,
    draft: listings.filter((l) => l.status === 'DRAFT').length,
    // Only same-currency prices can be summed honestly, so USD is reported as USD.
    valueUsd: listings
      .filter((l) => l.status === 'ACTIVE' && l.currency === 'USD' && l.intent === 'FOR_SALE')
      .reduce((s, l) => s + Number(l.price ?? 0), 0),
  }), [listings])

  const filtersOn = market !== 'all' || buildingFilter !== 'all' || cazaFilter !== 'all'
    || intentFilter !== 'all' || statusFilter !== 'all' || !!search

  function clearFilters() {
    setMarket('all'); setBuildingFilter('all'); setCazaFilter('all')
    setIntentFilter('all'); setStatusFilter('all'); setSearch('')
  }

  async function archive() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      await apiClient.deleteListing(archiveTarget.id)
      setListings((prev) => prev.map((l) => (l.id === archiveTarget.id ? { ...l, status: 'ARCHIVED' } : l)))
      toast({ title: 'Listing archived', description: 'It is no longer on the website.' })
      setArchiveTarget(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast({ title: 'Could not archive it', description: e?.message, variant: 'destructive' })
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Listings"
        description="Everything currently priced and on the market, across both websites."
        actions={
          <Link
            href="/admin/listings/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" /> New listing
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={<Tag className="h-4 w-4" />} label="Listings" value={stats.total} />
        <StatCard icon={<Eye className="h-4 w-4" />} label="Live" value={stats.active} accent="text-emerald-600" />
        <StatCard icon={<Archive className="h-4 w-4" />} label="Drafts" value={stats.draft} hint="Not on the website" />
        <StatCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Live sale value"
          value={`$${stats.valueUsd.toLocaleString()}`}
          hint="USD sale listings only"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a reference or title…"
            className="pl-9"
          />
        </div>
        <SelectInput value={market} onChange={(e) => setMarket(e.target.value as MarketScope)} className="w-auto min-w-[9rem]">
          {MARKET_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </SelectInput>
        <SelectInput value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)} className="w-auto min-w-[11rem] max-w-[16rem]">
          <option value="all">Any property</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.title}{b.city ? ` — ${b.city}` : ''}</option>
          ))}
        </SelectInput>
        <SelectInput value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)} className="w-auto min-w-[8rem]">
          <option value="all">Sale &amp; rent</option>
          <option value="FOR_SALE">For sale</option>
          <option value="FOR_RENT">For rent</option>
        </SelectInput>
        <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[8.5rem]">
          <option value="all">Any status</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </SelectInput>
        {cazas.length > 0 && (
          <SelectInput value={cazaFilter} onChange={(e) => setCazaFilter(e.target.value)} className="w-auto min-w-[8.5rem]">
            <option value="all">Any caza</option>
            {cazas.map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectInput>
        )}
        <SelectInput value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto min-w-[9rem]">
          <option value="newest">Newest first</option>
          <option value="priceDesc">Price: high → low</option>
          <option value="priceAsc">Price: low → high</option>
          <option value="caza">Location A–Z</option>
        </SelectInput>
        <SelectInput value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupKey)} className="w-auto min-w-[9rem]">
          <option value="none">No grouping</option>
          <option value="building">Group by property</option>
          <option value="caza">Group by caza</option>
        </SelectInput>
      </div>

      {filtersOn && (
        <div className="-mt-2 flex items-center gap-2 text-xs text-slate-400">
          Showing {filtered.length} of {listings.length}
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-slate-500 underline transition-colors hover:text-slate-800"
          >
            Clear filters
          </button>
        </div>
      )}

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-10 w-10" />}
          title={listings.length === 0 ? 'No listings yet' : 'Nothing matches those filters'}
          description={
            listings.length === 0
              ? 'A listing is a property or unit with a price on it. Create one, or add it from a property’s Units & listings tab.'
              : 'Try a different search, or clear the filters.'
          }
          action={
            listings.length === 0 ? (
              <Link
                href="/admin/listings/new"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" /> New listing
              </Link>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key || 'all'}>
              {groupBy !== 'none' && (
                <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {groupBy === 'building' ? <Building2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                  {group.key}
                  <span className="font-normal normal-case text-slate-400">({group.items.length})</span>
                </h2>
              )}
              {/* Cards rather than a table: every column here is short, and a
                  seven-column table in a side-scroller is unusable on a phone. */}
              <ul className="space-y-2">
                {group.items.map((l) => {
                  const title = l.headline ?? l.unit?.name ?? l.building?.title ?? 'Untitled'
                  const location = l.building
                    ? [l.building.city, l.building.caza].filter(Boolean).join(', ')
                    : '—'
                  const subject = l.unit
                    ? [typeLabel(l.unit.kind), l.unit.bedrooms != null ? `${l.unit.bedrooms} bed` : null, l.unit.areaSqm ? `${l.unit.areaSqm} m²` : null]
                        .filter(Boolean).join(' · ')
                    : 'Whole property'
                  const status = STATUS_META[l.status] ?? { label: l.status, cls: 'bg-slate-100 text-slate-600' }

                  return (
                    <li
                      key={l.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:px-4"
                    >
                      <Link href={`/admin/listings/${l.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="shrink-0 text-[11px]" title={countryOf(l)}>{countryFlag(countryOf(l))}</span>
                          {listingRef(l) && (
                            <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                              {listingRef(l)}
                            </span>
                          )}
                          <span className="truncate text-sm font-medium text-slate-900">{title}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {subject}
                          {l.building?.title && l.unit ? ` · ${l.building.title}` : ''}
                          {location !== '—' ? ` · ${location}` : ''}
                        </p>
                      </Link>

                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', INTENT_COLORS[l.intent] ?? '')}>
                          {l.intent === 'FOR_SALE' ? 'Sale' : 'Rent'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatPrice(l.price, l.currency)}
                          {l.rentPeriod && (
                            <span className="ml-0.5 text-xs font-normal text-slate-400">
                              /{PERIOD_SHORT[l.rentPeriod] ?? 'mo'}
                            </span>
                          )}
                        </span>
                        {l.negotiable && (
                          <span className="text-[11px] font-medium text-emerald-600">negotiable</span>
                        )}
                        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', status.cls)}>
                          {status.label}
                        </span>

                        <div className="ml-auto flex items-center gap-0.5 sm:ml-0">
                          {l.slug && l.status === 'ACTIVE' && (
                            <a
                              href={`/listings/${l.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on the website"
                              aria-label="View on the website"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Link
                            href={`/admin/listings/${l.id}`}
                            title="Edit"
                            aria-label="Edit"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Link>
                          {l.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(l)}
                              title="Archive"
                              aria-label="Archive"
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        tone="danger"
        busy={archiving}
        title="Archive this listing?"
        description={
          archiveTarget
            ? `${archiveTarget.headline ?? archiveTarget.building?.title ?? 'This listing'} comes off the website.`
            : undefined
        }
        consequences={[
          'The property and its unit are untouched.',
          'Anyone holding a link to it will stop seeing it.',
          'You can create a new listing for the same unit at any time.',
        ]}
        confirmLabel="Archive"
        onConfirm={archive}
        onClose={() => !archiving && setArchiveTarget(null)}
      />

      {/* Grouping keeps the counts honest when a filter is on. */}
      {!loading && groupBy !== 'none' && filtered.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Layers className="h-3 w-3" /> {groups.length} group{groups.length === 1 ? '' : 's'} · {filtered.length} listings
        </p>
      )}
    </div>
  )
}
