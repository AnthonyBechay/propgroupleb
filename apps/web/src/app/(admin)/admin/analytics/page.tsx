import { prisma } from '@/lib/prisma'
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
  Calendar,
} from 'lucide-react'

export default async function AnalyticsPage() {
  let totalProperties = 0
  let totalUsers = 0
  let totalInquiries = 0
  let totalFavorites = 0
  let totalViews = 0
  let totalPortfolioValue = 0
  let propertiesByCountry: any[] = []
  let propertiesByStatus: any[] = []
  let propertiesByType: any[] = []
  let topProperties: any[] = []
  let recentInquiries: any[] = []
  let recentUsers: any[] = []
  let priceRange = { min: 0, max: 0, avg: 0 }
  let monthlyInquiryCounts: { month: string; count: number }[] = []
  let userGrowthData: { month: string; count: number }[] = []

  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)

    const results = await Promise.all([
      // 0: total properties
      prisma.property.count(),
      // 1: total users
      prisma.user.count(),
      // 2: total inquiries
      prisma.propertyInquiry.count(),
      // 3: total favorites
      prisma.favoriteProperty.count(),
      // 4: total views
      prisma.property.aggregate({ _sum: { views: true } }),
      // 5: portfolio value
      prisma.property.aggregate({ _sum: { price: true }, _min: { price: true }, _max: { price: true }, _avg: { price: true } }),
      // 6: by country
      prisma.property.groupBy({ by: ['country'], _count: true, _avg: { price: true } }),
      // 7: by status
      prisma.property.groupBy({ by: ['status'], _count: true }),
      // 8: by type
      prisma.property.groupBy({ by: ['propertyType'], _count: true }),
      // 9: top properties
      prisma.property.findMany({
        take: 10,
        orderBy: { favoriteProperties: { _count: 'desc' } },
        include: {
          _count: { select: { favoriteProperties: true, propertyInquiries: true } },
          investmentData: { select: { rentalYield: true, expectedROI: true } },
        },
      }),
      // 10: recent inquiries
      prisma.propertyInquiry.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          propertyTitle: true,
          createdAt: true,
          property: { select: { title: true, country: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      // 11: recent users
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, firstName: true, lastName: true, createdAt: true, role: true },
      }),
      // 12: inquiries in last 6 months (for monthly chart)
      prisma.propertyInquiry.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // 13: users in last 6 months (for growth chart)
      prisma.user.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    totalProperties = results[0]
    totalUsers = results[1]
    totalInquiries = results[2]
    totalFavorites = results[3]
    totalViews = results[4]._sum.views || 0
    totalPortfolioValue = results[5]._sum.price || 0
    priceRange = {
      min: results[5]._min.price || 0,
      max: results[5]._max.price || 0,
      avg: Math.round(results[5]._avg.price || 0),
    }
    propertiesByCountry = results[6]
    propertiesByStatus = results[7]
    propertiesByType = results[8]
    topProperties = results[9]
    recentInquiries = results[10]
    recentUsers = results[11]

    // Build monthly inquiry counts
    const inquiryDates = results[12] as { createdAt: Date }[]
    const userDates = results[13] as { createdAt: Date }[]

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`

      monthlyInquiryCounts.push({
        month: label,
        count: inquiryDates.filter(inq => {
          const c = new Date(inq.createdAt)
          return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
        }).length,
      })

      userGrowthData.push({
        month: label,
        count: userDates.filter(u => {
          const c = new Date(u.createdAt)
          return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
        }).length,
      })
    }
  } catch (error) {
    console.error('Error fetching analytics data:', error)
  }

  const maxInquiryCount = Math.max(...monthlyInquiryCounts.map(m => m.count), 1)
  const maxUserCount = Math.max(...userGrowthData.map(m => m.count), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1B3A5C] rounded-xl flex items-center justify-center shadow-md">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          Analytics Dashboard
        </h1>
        <p className="mt-2 text-slate-600">
          Real-time platform performance and engagement metrics.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Building2} label="Properties" value={totalProperties} color="bg-[#1B3A5C]" />
        <MetricCard icon={Users} label="Users" value={totalUsers} color="bg-emerald-600" />
        <MetricCard icon={MessageSquare} label="Inquiries" value={totalInquiries} color="bg-[#C49A2E]" />
        <MetricCard icon={Heart} label="Favorites" value={totalFavorites} color="bg-pink-600" />
        <MetricCard icon={Eye} label="Total Views" value={totalViews} color="bg-slate-600" />
        <MetricCard icon={DollarSign} label="Portfolio Value" value={`$${(totalPortfolioValue / 1_000_000).toFixed(1)}M`} color="bg-[#1B3A5C]" />
      </div>

      {/* Price Overview */}
      <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-[#C49A2E] rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          Price Overview
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500 mb-1">Lowest Price</p>
            <p className="text-2xl font-bold text-slate-900">${priceRange.min.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500 mb-1">Average Price</p>
            <p className="text-2xl font-bold text-[#1B3A5C]">${priceRange.avg.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-500 mb-1">Highest Price</p>
            <p className="text-2xl font-bold text-slate-900">${priceRange.max.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Inquiries Chart */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#C49A2E] rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            Monthly Inquiries
          </h3>
          <div className="space-y-3">
            {monthlyInquiryCounts.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-20 text-right">{m.month}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-[#C49A2E] h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((m.count / maxInquiryCount) * 100, m.count > 0 ? 10 : 0)}%` }}
                  >
                    {m.count > 0 && (
                      <span className="text-xs font-bold text-white">{m.count}</span>
                    )}
                  </div>
                </div>
                {m.count === 0 && <span className="text-xs text-slate-400">0</span>}
              </div>
            ))}
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            User Growth (New Signups)
          </h3>
          <div className="space-y-3">
            {userGrowthData.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-20 text-right">{m.month}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-emerald-600 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((m.count / maxUserCount) * 100, m.count > 0 ? 10 : 0)}%` }}
                  >
                    {m.count > 0 && (
                      <span className="text-xs font-bold text-white">{m.count}</span>
                    )}
                  </div>
                </div>
                {m.count === 0 && <span className="text-xs text-slate-400">0</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Properties by Country */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            By Country
          </h3>
          <div className="space-y-3">
            {propertiesByCountry.map((item) => (
              <div key={item.country} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-sm font-bold text-slate-900">{item.country}</span>
                  <p className="text-xs text-slate-500">Avg: ${Math.round(item._avg?.price || 0).toLocaleString()}</p>
                </div>
                <span className="text-sm font-bold text-[#1B3A5C] bg-white px-3 py-1 rounded-lg shadow-sm">
                  {item._count}
                </span>
              </div>
            ))}
            {propertiesByCountry.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Properties by Status */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            By Status
          </h3>
          <div className="space-y-3">
            {propertiesByStatus.map((item) => {
              const statusColors: Record<string, string> = {
                OFF_PLAN: 'bg-amber-500',
                NEW_BUILD: 'bg-emerald-600',
                RESALE: 'bg-[#C49A2E]',
              }
              const statusLabels: Record<string, string> = {
                OFF_PLAN: 'Off Plan',
                NEW_BUILD: 'New Build',
                RESALE: 'Resale',
              }
              return (
                <div key={item.status} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${statusColors[item.status] || 'bg-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-900">{statusLabels[item.status] || item.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-200 rounded-full h-2">
                      <div
                        className={`${statusColors[item.status] || 'bg-slate-400'} h-2 rounded-full`}
                        style={{ width: `${totalProperties > 0 ? (item._count / totalProperties) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-8 text-right">{item._count}</span>
                  </div>
                </div>
              )
            })}
            {propertiesByStatus.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Properties by Type */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            By Type
          </h3>
          <div className="space-y-3">
            {propertiesByType.map((item) => (
              <div key={item.propertyType} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-900">
                  {item.propertyType.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1 rounded-lg shadow-sm">
                  {item._count}
                </span>
              </div>
            ))}
            {propertiesByType.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Properties Table */}
      <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          Top Performing Properties
        </h3>
        {topProperties.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Favorites</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Inquiries</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Views</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Yield</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {topProperties.map((property, i) => (
                  <tr key={property.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 max-w-[200px] truncate">{property.title}</p>
                          <p className="text-xs text-slate-500">{property.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      ${property.price?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-pink-600">
                        <Heart className="w-3 h-3" /> {property._count.favoriteProperties}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                        <MessageSquare className="w-3 h-3" /> {property._count.propertyInquiries}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">
                      {property.views || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-emerald-600">
                      {property.investmentData?.rentalYield
                        ? `${property.investmentData.rentalYield.toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold
                        ${property.status === 'OFF_PLAN' ? 'bg-amber-100 text-amber-700' :
                          property.status === 'NEW_BUILD' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-purple-100 text-purple-700'}`}>
                        {(property.status || '').replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">No properties yet. Add some to see analytics.</p>
        )}
      </div>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Inquiries */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#C49A2E] rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Recent Inquiries
          </h3>
          <div className="space-y-3">
            {recentInquiries.map((inq: any) => (
              <div key={inq.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-[#C49A2E] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {inq.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{inq.name}</p>
                  <p className="text-xs text-slate-500 truncate">{inq.email}</p>
                  <p className="text-xs text-[#1B3A5C] mt-1">Re: {inq.property?.title || inq.propertyTitle || 'Deleted Property'}</p>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(inq.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {recentInquiries.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No inquiries yet</p>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            Recent Signups
          </h3>
          <div className="space-y-3">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {u.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email.split('@')[0]}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'ADMIN' ? 'bg-[#1B3A5C] text-white' :
                    u.role === 'SUPER_ADMIN' ? 'bg-[#C49A2E] text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {u.role}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {recentUsers.length === 0 && (
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
    <div className="bg-white border-2 border-slate-100 overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-all p-5">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shadow-md mb-3`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <dt className="text-xs font-medium text-slate-500 mb-1">{label}</dt>
      <dd className="text-2xl font-black text-slate-900">{typeof value === 'number' ? value.toLocaleString() : value}</dd>
    </div>
  )
}
