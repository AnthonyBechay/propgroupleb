'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, Clock, Eye, FileText, Globe, Heart, Inbox, Layers, ListChecks,
  MapPin, MessageSquare, Users,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { EmptyState, FormSection, PageHeader, StatCard } from '@/components/admin/ui/layout'
import { SegmentedControl } from '@/components/admin/ui/form'
import { countryFlag, siteFor } from '@/lib/market'
import { cn } from '@/lib/utils'

type Market = 'all' | 'LEBANON' | 'INTERNATIONAL'

interface MarketRow {
  market: 'LEBANON' | 'INTERNATIONAL'
  site: string
  buildings: number
  units: number
  activeListings: number
  inquiries: number
  views: number
}

interface DashboardData {
  market: string
  overview: {
    totalUsers: number
    totalBuildings: number
    totalUnits: number
    activeListings: number
    totalViews: number
    totalInquiries: number
    totalFavorites: number
    totalContactMessages: number
    totalDocuments: number
    unattributedInquiries: number
    unattributedContacts: number
  }
  trends: {
    newUsersThisWeek: number
    newInquiriesThisWeek: number
    newBuildingsThisWeek: number
  }
  recent: {
    users: Array<{ id: string; email: string; firstName?: string; lastName?: string; createdAt: string }>
    inquiries: Array<{ id: string; name: string; email: string; buildingTitle?: string; status: string; createdAt: string; building?: { id: string; title: string; country?: string } }>
    buildings: Array<{ id: string; title: string; city?: string; country?: string; status: string; createdAt: string }>
    contacts: Array<{ id: string; name: string; email: string; subject?: string; site?: string | null; createdAt: string }>
  }
  byMarket: MarketRow[]
  statistics: {
    buildingsByCity: Array<{ city: string | null; country: string; count: number }>
    inquiriesByStatus: Array<{ status: string; _count: { status: number } }>
    buildingsByStatus: Array<{ status: string; _count: { status: number } }>
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-amber-100 text-amber-700',
  RESPONDED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-slate-100 text-slate-600',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  OFF_PLAN: 'bg-violet-100 text-violet-700',
  NEW_BUILD: 'bg-sky-100 text-sky-700',
  RESALE: 'bg-slate-100 text-slate-600',
}

const MARKET_LABEL: Record<Market, string> = {
  all: 'Both websites',
  LEBANON: 'propgrouplb.com',
  INTERNATIONAL: 'propgrp.com',
}

/**
 * The back office's front page, for a business that now runs two websites.
 *
 * Every number here used to be a single blended count. "83 buildings" was
 * Lebanon and Georgia added together with no split and no way to ask for one;
 * "Buildings by City" ranked Beirut against Batumi in one bar chart as a
 * percentage of a total spanning two countries; and a Georgian property with no
 * city printed the literal fallback "Lebanon" under its name.
 *
 * The market switch now runs the whole page, and the split is shown even when
 * nothing is narrowed — because "how are the two sites doing?" is the question
 * this page exists to answer.
 */
export function AdminDashboardClient() {
  const [market, setMarket] = useState<Market>('all')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async (scope: Market) => {
    setLoading(true)
    setError(false)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const qs = scope === 'all' ? '' : `?market=${scope}`
      const res = await fetch(`${apiUrl}/api/admin/stats${qs}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('stats')
      const body = await res.json()
      setData(body.data ?? body)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(market) }, [market, load])

  const scoped = market !== 'all'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          scoped
            ? <>Showing {MARKET_LABEL[market]} only.</>
            : <>Both websites together. Narrow to one to see it on its own.</>
        }
        actions={
          <SegmentedControl
            value={market}
            onChange={setMarket}
            options={[
              { value: 'all', label: 'Both' },
              { value: 'LEBANON', label: '🇱🇧 Lebanon' },
              { value: 'INTERNATIONAL', label: '🌍 International' },
            ]}
          />
        }
      />

      {error && (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="Could not load the dashboard"
          description="The API did not respond. Refresh to try again."
        />
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[4.5rem] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {data && (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-50')}>
          {/* Headline numbers — everything here respects the market switch */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
            <StatCard
              icon={<Building2 className="h-4 w-4" />}
              label="Properties"
              value={data.overview.totalBuildings.toLocaleString()}
              href="/admin/buildings"
              hint={data.trends.newBuildingsThisWeek > 0 ? `+${data.trends.newBuildingsThisWeek} this week` : undefined}
            />
            <StatCard
              icon={<Layers className="h-4 w-4" />}
              label="Units"
              value={data.overview.totalUnits.toLocaleString()}
            />
            <StatCard
              icon={<ListChecks className="h-4 w-4" />}
              label="Live listings"
              value={data.overview.activeListings.toLocaleString()}
              accent="text-emerald-600"
              href="/admin/listings"
            />
            <StatCard
              icon={<Eye className="h-4 w-4" />}
              label="Views"
              value={data.overview.totalViews.toLocaleString()}
            />
            <StatCard
              icon={<MessageSquare className="h-4 w-4" />}
              label="Inquiries"
              value={data.overview.totalInquiries.toLocaleString()}
              href="/admin/inquiries"
              hint={data.trends.newInquiriesThisWeek > 0 ? `+${data.trends.newInquiriesThisWeek} this week` : undefined}
            />
            <StatCard
              icon={<Inbox className="h-4 w-4" />}
              label="Messages"
              value={data.overview.totalContactMessages.toLocaleString()}
              href="/admin/contacts"
            />
          </div>

          {/* Things with no market of their own, said plainly rather than
              folded into the numbers above as if they had one. */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Accounts"
              value={data.overview.totalUsers.toLocaleString()}
              href="/admin/users"
              hint={
                <>
                  Platform-wide — an account isn&rsquo;t tied to a site
                  {data.trends.newUsersThisWeek > 0 && ` · +${data.trends.newUsersThisWeek} this week`}
                </>
              }
            />
            <StatCard
              icon={<Heart className="h-4 w-4" />}
              label="Saved properties"
              value={data.overview.totalFavorites.toLocaleString()}
            />
            <StatCard
              icon={<FileText className="h-4 w-4" />}
              label="Documents"
              value={data.overview.totalDocuments.toLocaleString()}
              href="/admin/documents"
            />
          </div>

          {/* Enquiries and messages that belong to neither site. Counted rather
              than dropped — under a market filter they'd otherwise vanish. */}
          {scoped && (data.overview.unattributedInquiries > 0 || data.overview.unattributedContacts > 0) && (
            <p className="text-xs leading-relaxed text-slate-400">
              Not counted above:{' '}
              {data.overview.unattributedInquiries > 0 && (
                <>{data.overview.unattributedInquiries} enquir{data.overview.unattributedInquiries === 1 ? 'y' : 'ies'} with no property attached</>
              )}
              {data.overview.unattributedInquiries > 0 && data.overview.unattributedContacts > 0 && ', and '}
              {data.overview.unattributedContacts > 0 && (
                <>{data.overview.unattributedContacts} message{data.overview.unattributedContacts === 1 ? '' : 's'} received before we started recording which site they came from</>
              )}
              . Neither belongs to a single website.
            </p>
          )}

          {/* The two sites, side by side */}
          <FormSection
            title="The two websites"
            description="How the catalogue splits between them."
            icon={<Globe className="h-4 w-4" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-4">Website</th>
                    <th className="px-3 py-2 text-right">Properties</th>
                    <th className="px-3 py-2 text-right">Units</th>
                    <th className="px-3 py-2 text-right">Live listings</th>
                    <th className="px-3 py-2 text-right">Views</th>
                    <th className="py-2 pl-3 text-right">Inquiries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byMarket.map((row) => (
                    <tr
                      key={row.market}
                      className={cn(
                        'transition-colors',
                        market === row.market && 'bg-slate-50',
                      )}
                    >
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => setMarket(market === row.market ? 'all' : row.market)}
                          className="flex items-center gap-2 text-left font-medium text-slate-900 hover:underline"
                        >
                          <span>{row.market === 'LEBANON' ? '🇱🇧' : '🌍'}</span>
                          {row.site}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{row.buildings.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{row.units.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium text-emerald-700">{row.activeListings.toLocaleString()}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{row.views.toLocaleString()}</td>
                      <td className="py-3 pl-3 text-right tabular-nums text-slate-700">{row.inquiries.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              A property appears on a site by its country — International is everything that isn&rsquo;t Lebanon.
            </p>
          </FormSection>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <FormSection title="Where the stock is" icon={<MapPin className="h-4 w-4" />}>
              <CityBreakdown rows={data.statistics.buildingsByCity} />
            </FormSection>

            <FormSection title="Build status" icon={<Building2 className="h-4 w-4" />}>
              <StatusList
                rows={data.statistics.buildingsByStatus.map((r) => ({ key: r.status, count: r._count.status }))}
                empty="No properties yet"
              />
            </FormSection>

            <FormSection title="Inquiry status" icon={<MessageSquare className="h-4 w-4" />}>
              <StatusList
                rows={data.statistics.inquiriesByStatus.map((r) => ({ key: r.status, count: r._count.status }))}
                empty="No inquiries yet"
              />
            </FormSection>
          </div>

          {/* Activity */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <FeedCard title="Recent inquiries" icon={<MessageSquare className="h-4 w-4" />} href="/admin/inquiries">
              {data.recent.inquiries.length === 0 ? (
                <FeedEmpty>No inquiries{scoped ? ' for this website' : ''} yet</FeedEmpty>
              ) : data.recent.inquiries.map((inq) => (
                <FeedRow
                  key={inq.id}
                  title={inq.name || inq.email}
                  subtitle={
                    <>
                      {inq.building?.country && <span className="mr-1">{countryFlag(inq.building.country)}</span>}
                      {inq.buildingTitle || inq.building?.title || 'General inquiry'}
                    </>
                  }
                  badge={inq.status}
                  when={inq.createdAt}
                />
              ))}
            </FeedCard>

            <FeedCard title="Recently added" icon={<Building2 className="h-4 w-4" />} href="/admin/buildings">
              {data.recent.buildings.length === 0 ? (
                <FeedEmpty>Nothing added{scoped ? ' to this website' : ''} yet</FeedEmpty>
              ) : data.recent.buildings.map((b) => (
                <FeedRow
                  key={b.id}
                  href={`/admin/buildings/${b.id}`}
                  title={b.title}
                  subtitle={
                    <>
                      {countryFlag(b.country)}{' '}
                      {/* Was `b.city ?? 'Lebanon'` — which labelled a Georgian
                          property with no city as Lebanese. */}
                      {b.city || siteFor(b.country)}
                    </>
                  }
                  badge={b.status}
                  when={b.createdAt}
                />
              ))}
            </FeedCard>

            <FeedCard title="New accounts (7 days)" icon={<Users className="h-4 w-4" />} href="/admin/users">
              {data.recent.users.length === 0 ? (
                <FeedEmpty>No new accounts this week</FeedEmpty>
              ) : data.recent.users.map((u) => (
                <FeedRow
                  key={u.id}
                  title={u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                  subtitle={u.firstName ? u.email : undefined}
                  when={u.createdAt}
                />
              ))}
            </FeedCard>

            <FeedCard title="Recent messages" icon={<Inbox className="h-4 w-4" />} href="/admin/contacts">
              {data.recent.contacts.length === 0 ? (
                <FeedEmpty>No messages{scoped ? ' from this website' : ''} yet</FeedEmpty>
              ) : data.recent.contacts.map((msg) => (
                <FeedRow
                  key={msg.id}
                  title={msg.name}
                  subtitle={
                    <>
                      {msg.site && <span className="mr-1">{msg.site === 'LEBANON' ? '🇱🇧' : '🌍'}</span>}
                      {msg.subject || msg.email}
                    </>
                  }
                  when={msg.createdAt}
                />
              ))}
            </FeedCard>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Cities, grouped under the website they belong to.
 *
 * Ranking Beirut against Batumi in one list and calling each a percentage of a
 * shared total answered no question anybody has. Each market is its own list,
 * with its own denominator.
 */
function CityBreakdown({ rows }: { rows: Array<{ city: string | null; country: string; count: number }> }) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">No properties yet</p>

  const groups = new Map<'LEBANON' | 'INTERNATIONAL', Array<{ city: string; count: number }>>()
  for (const r of rows) {
    const bucket = (r.country ?? 'LEBANON') === 'LEBANON' ? 'LEBANON' : 'INTERNATIONAL'
    const list = groups.get(bucket) ?? []
    list.push({ city: r.city ?? 'Unknown', count: r.count })
    groups.set(bucket, list)
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([bucket, list]) => {
        const sorted = [...list].sort((a, b) => b.count - a.count).slice(0, 6)
        const total = list.reduce((s, r) => s + r.count, 0) || 1
        return (
          <div key={bucket}>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {bucket === 'LEBANON' ? '🇱🇧 propgrouplb.com' : '🌍 propgrp.com'}
            </p>
            <div className="space-y-2">
              {sorted.map((r) => (
                <div key={r.city} className="flex items-center gap-3">
                  <span className="w-24 truncate text-xs font-medium text-slate-600">{r.city}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-800" style={{ width: `${(r.count / total) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-semibold tabular-nums text-slate-700">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusList({ rows, empty }: { rows: Array<{ key: string; count: number }>; empty: string }) {
  if (rows.length === 0) return <p className="text-xs text-slate-400">{empty}</p>
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3">
          <span className={cn('rounded px-2 py-0.5 text-xs font-medium', statusColors[r.key] ?? 'bg-slate-100 text-slate-600')}>
            {r.key?.replace(/_/g, ' ')}
          </span>
          <span className="text-sm font-semibold tabular-nums text-slate-700">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

function FeedCard({
  title, icon, href, children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-slate-400">{icon}</span>
          {title}
        </h3>
        <Link href={href} className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900">
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  )
}

function FeedEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-slate-400">{children}</p>
}

function FeedRow({
  title, subtitle, badge, when, href,
}: {
  title: string
  subtitle?: React.ReactNode
  badge?: string
  when: string
  href?: string
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && (
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', statusColors[badge] ?? 'bg-slate-100 text-slate-600')}>
            {badge.replace(/_/g, ' ')}
          </span>
        )}
        <span className="flex items-center gap-0.5 whitespace-nowrap text-[10px] text-slate-400">
          <Clock className="h-2.5 w-2.5" />{timeAgo(when)}
        </span>
      </div>
    </div>
  )
  const cls = 'block px-5 py-3.5 transition-colors hover:bg-slate-50'
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
