import {
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  Heart,
  MessageSquare,
  Eye,
  MapPin,
} from 'lucide-react'
import Link from 'next/link'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { cookies } from 'next/headers'
import { BehaviorAnalytics } from './BehaviorAnalytics'

type Market = 'all' | 'LEBANON' | 'INTERNATIONAL'

/** Which website a record belongs to, via its property's country. */
function bucketOf(country?: string | null): 'LEBANON' | 'INTERNATIONAL' {
  return (country ?? 'LEBANON') === 'LEBANON' ? 'LEBANON' : 'INTERNATIONAL'
}

async function fetchAdminStats(market: Market) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Cookie'] = `token=${token}`

  const fetchJson = async (path: string) => {
    try {
      const res = await fetch(`${apiUrl}${path}`, { headers, cache: 'no-store' })
      if (!res.ok) return null
      return res.json()
    } catch { return null }
  }

  const [buildingsRes, listingsRes, inquiriesRes, usersRes] = await Promise.all([
    // `country=all` and `visibility=all` are stated rather than relied upon.
    // The market filter defaults to Lebanon for anyone it can't identify as an
    // admin, so a request that lost its cookie would silently report half the
    // catalogue as the whole of it — and look entirely plausible doing it.
    fetchJson('/api/buildings?limit=500&visibility=all&country=all'),
    fetchJson('/api/listings?limit=500&status=all&country=all'),
    fetchJson('/api/inquiries?limit=500'),
    fetchJson('/api/users?limit=500'),
  ])

  const allBuildings: any[] = buildingsRes?.data ?? []
  const allListings: any[] = listingsRes?.data ?? []
  const allInquiries: any[] = inquiriesRes?.data ?? []
  const users: any[] = usersRes?.data ?? []

  // A listing or an enquiry sits in a market through whichever property it
  // belongs to; a user sits in neither.
  const listingCountry = (l: any) => l.building?.country ?? l.unit?.building?.country ?? null
  const inquiryCountry = (i: any) => i.building?.country ?? null

  const inScope = (country: string | null | undefined) =>
    market === 'all' || bucketOf(country) === market

  const buildings = allBuildings.filter((b: any) => inScope(b.country))
  const listings = allListings.filter((l: any) => inScope(listingCountry(l)))
  // An enquiry with no property belongs to neither site, so a narrowed view
  // leaves it out rather than assigning it to one.
  const inquiries = market === 'all'
    ? allInquiries
    : allInquiries.filter((i: any) => i.building && inScope(inquiryCountry(i)))

  // --- Aggregates ---
  // Counted from the rows themselves, not from `pagination.total`, because the
  // total is unscoped and would contradict every other figure on the page the
  // moment a market is selected.
  const totalBuildings = buildings.length
  const totalListings = listings.length
  const totalInquiries = inquiries.length
  const totalUsers = usersRes?.pagination?.total ?? users.length
  const totalViews = buildings.reduce((sum: number, b: any) => sum + (b.views ?? 0), 0)
  const marketSplit = (['LEBANON', 'INTERNATIONAL'] as const).map((m) => ({
    market: m,
    site: m === 'LEBANON' ? 'propgrouplb.com' : 'propgrp.com',
    buildings: allBuildings.filter((b: any) => bucketOf(b.country) === m).length,
    listings: allListings.filter((l: any) => bucketOf(listingCountry(l)) === m).length,
    views: allBuildings
      .filter((b: any) => bucketOf(b.country) === m)
      .reduce((sum: number, b: any) => sum + (b.views ?? 0), 0),
  }))

  const forSale = listings.filter((l: any) => l.intent === 'FOR_SALE')
  const forRent = listings.filter((l: any) => l.intent === 'FOR_RENT')

  // By status
  const statusCounts: Record<string, number> = {}
  listings.forEach((l: any) => {
    statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1
  })

  // Where the stock is.
  //
  // This used to count `mohafazat` — a Lebanese governorate. Georgian buildings
  // have none, so every one of them fell out of the chart silently: the
  // "Buildings by Region" card showed Lebanon and quietly called it the
  // portfolio. Lebanon keeps its governorates, everything else is grouped by
  // city, and each is labelled with the site it belongs to.
  const regionCounts: Record<string, number> = {}
  buildings.forEach((b: any) => {
    const key = bucketOf(b.country) === 'LEBANON'
      ? (b.mohafazat || b.city || 'Unspecified')
      : (b.city || b.country || 'Unspecified')
    regionCounts[key] = (regionCounts[key] ?? 0) + 1
  })

  // Price stats from active listings
  const activePrices = listings
    .filter((l: any) => l.status === 'ACTIVE' && l.currency === 'USD' && l.price > 0)
    .map((l: any) => l.price as number)
  const priceRange = activePrices.length > 0 ? {
    min: Math.min(...activePrices),
    max: Math.max(...activePrices),
    avg: Math.round(activePrices.reduce((a: number, b: number) => a + b, 0) / activePrices.length),
  } : { min: 0, max: 0, avg: 0 }

  // Monthly inquiries (last 6 months)
  const now = new Date()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyInquiryCounts = []
  const userGrowthData = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`
    monthlyInquiryCounts.push({
      month: label,
      count: inquiries.filter((inq: any) => {
        const c = new Date(inq.createdAt)
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
      }).length,
    })
    userGrowthData.push({
      month: label,
      count: users.filter((u: any) => {
        const c = new Date(u.createdAt)
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
      }).length,
    })
  }

  const recentInquiries = inquiries.slice(0, 10)
  const recentUsers = users.slice(0, 10)

  return {
    totalBuildings, totalListings, totalInquiries, totalUsers, totalViews,
    forSaleCount: forSale.length, forRentCount: forRent.length,
    statusCounts, regionCounts, priceRange, marketSplit,
    monthlyInquiryCounts, userGrowthData,
    recentInquiries, recentUsers,
  }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const asked = (sp.market ?? '').toUpperCase()
  const market: Market = asked === 'LEBANON' || asked === 'INTERNATIONAL' ? asked : 'all'
  const stats = await fetchAdminStats(market)

  const maxInquiryCount = Math.max(...stats.monthlyInquiryCounts.map(m => m.count), 1)
  const maxUserCount = Math.max(...stats.userGrowthData.map(m => m.count), 1)

  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft', ACTIVE: 'Active', UNDER_OFFER: 'Under Offer',
    CLOSED: 'Closed', ARCHIVED: 'Archived',
  }
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-emerald-500', DRAFT: 'bg-slate-400', UNDER_OFFER: 'bg-amber-500',
    CLOSED: 'bg-red-400', ARCHIVED: 'bg-slate-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {market === 'all'
              ? 'Both websites together. Pick one to see it on its own.'
              : `${market === 'LEBANON' ? 'propgrouplb.com' : 'propgrp.com'} only.`}
          </p>
        </div>
        {/* Links rather than state: this is a server component, and the market
            belongs in the URL so a filtered view can be shared or bookmarked. */}
        <nav className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Market">
          {([
            { value: 'all', label: 'Both' },
            { value: 'LEBANON', label: '🇱🇧 Lebanon' },
            { value: 'INTERNATIONAL', label: '🌍 International' },
          ] as const).map((o) => (
            <Link
              key={o.value}
              href={o.value === 'all' ? '/admin/analytics' : `/admin/analytics?market=${o.value}`}
              aria-current={market === o.value ? 'page' : undefined}
              className={`min-h-9 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                market === o.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {o.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* How the catalogue splits, whatever the filter — the question this page
          exists to answer now that one back office runs two websites. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.marketSplit.map((m) => (
          <div
            key={m.market}
            className={`rounded-xl border p-4 ${
              market === m.market ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white'
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">
              {m.market === 'LEBANON' ? '🇱🇧' : '🌍'} {m.site}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span><strong className="text-slate-800">{m.buildings.toLocaleString()}</strong> properties</span>
              <span><strong className="text-slate-800">{m.listings.toLocaleString()}</strong> listings</span>
              <span><strong className="text-slate-800">{m.views.toLocaleString()}</strong> views</span>
            </div>
          </div>
        ))}
      </div>

      {/* User behaviour (first-party event tracking) */}
      <BehaviorAnalytics site={market === 'all' ? null : market} />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Building2} label="Buildings" value={stats.totalBuildings} color="bg-slate-800" />
        <MetricCard icon={BarChart3} label="Listings" value={stats.totalListings} color="bg-slate-700" />
        <MetricCard icon={Users} label="Users" value={stats.totalUsers} color="bg-emerald-600" />
        <MetricCard icon={MessageSquare} label="Inquiries" value={stats.totalInquiries} color="bg-blue-600" />
        <MetricCard icon={Eye} label="Total Views" value={stats.totalViews} color="bg-slate-600" />
        <MetricCard icon={DollarSign} label="Avg Price" value={stats.priceRange.avg > 0 ? `$${(stats.priceRange.avg / 1000).toFixed(0)}K` : '—'} color="bg-slate-800" />
      </div>

      {/* Listing Intent Split */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-5 text-center">
          <p className="text-sm text-slate-500 mb-1">For Sale</p>
          <p className="text-3xl font-bold text-slate-900">{stats.forSaleCount}</p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center">
          <p className="text-sm text-slate-500 mb-1">For Rent</p>
          <p className="text-3xl font-bold text-slate-900">{stats.forRentCount}</p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center">
          <p className="text-sm text-slate-500 mb-1">Price Range (USD)</p>
          <p className="text-lg font-bold text-slate-900">
            {stats.priceRange.min > 0
              ? `$${stats.priceRange.min.toLocaleString()} – $${stats.priceRange.max.toLocaleString()}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Inquiries */}
        <div className="bg-white border shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            Monthly Inquiries
          </h3>
          <div className="space-y-3">
            {stats.monthlyInquiryCounts.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-20 text-right">{m.month}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-blue-600 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((m.count / maxInquiryCount) * 100, m.count > 0 ? 10 : 0)}%` }}
                  >
                    {m.count > 0 && <span className="text-xs font-bold text-white">{m.count}</span>}
                  </div>
                </div>
                {m.count === 0 && <span className="text-xs text-slate-400">0</span>}
              </div>
            ))}
          </div>
        </div>

        {/* User Growth */}
        <div className="bg-white border shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            User Growth (New Signups)
          </h3>
          <div className="space-y-3">
            {stats.userGrowthData.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-20 text-right">{m.month}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-emerald-600 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((m.count / maxUserCount) * 100, m.count > 0 ? 10 : 0)}%` }}
                  >
                    {m.count > 0 && <span className="text-xs font-bold text-white">{m.count}</span>}
                  </div>
                </div>
                {m.count === 0 && <span className="text-xs text-slate-400">0</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By Region */}
        <div className="bg-white border shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            Where the stock is
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.regionCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([region, count]) => (
                <div key={region} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-medium text-slate-900">{region.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-bold text-slate-800 bg-white px-3 py-1 rounded-lg shadow-sm">{count}</span>
                </div>
              ))}
            {Object.keys(stats.regionCounts).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* By Status */}
        <div className="bg-white border shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            Listings by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.statusCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => {
                const total = stats.totalListings || 1
                return (
                  <div key={status} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${statusColors[status] ?? 'bg-slate-400'}`} />
                      <span className="text-sm font-medium text-slate-900">{statusLabels[status] ?? status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 rounded-full h-2">
                        <div
                          className={`${statusColors[status] ?? 'bg-slate-400'} h-2 rounded-full`}
                          style={{ width: `${(count / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-900 w-8 text-right">{count}</span>
                    </div>
                  </div>
                )
              })}
            {Object.keys(stats.statusCounts).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No listings yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Inquiries */}
        <div className="bg-white border shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Recent Inquiries
          </h3>
          <div className="space-y-3">
            {stats.recentInquiries.map((inq: any) => (
              <div key={inq.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(inq.name || inq.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{inq.name || inq.email?.split('@')[0]}</p>
                  <p className="text-xs text-slate-500 truncate">{inq.email}</p>
                  {(inq.listingId || inq.message) && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{inq.message?.slice(0, 60) || 'Listing inquiry'}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(inq.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {stats.recentInquiries.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No inquiries yet</p>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white border shadow-sm rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            Recent Signups
          </h3>
          <div className="space-y-3">
            {stats.recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(u.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'SUPER_ADMIN' ? 'bg-slate-800 text-white' :
                    u.role === 'ADMIN' ? 'bg-slate-700 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {u.role}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">{new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No users yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border overflow-hidden shadow-sm rounded-2xl hover:shadow-md transition-all p-5">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shadow-md mb-3`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <dt className="text-xs font-medium text-slate-500 mb-1">{label}</dt>
      <dd className="text-2xl font-black text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</dd>
    </div>
  )
}
