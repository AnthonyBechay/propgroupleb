import { prisma } from '@/lib/prisma'
import {
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  Activity,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react'

export default async function AnalyticsPage() {
  // Layout already handles authentication
  let totalProperties = 0
  let propertiesByCountry: any[] = []
  let propertiesByStatus: any[] = []
  let userGrowth: any[] = []
  let inquiriesByMonth: any[] = []
  let topProperties: any[] = []

  try {
    // Fetch analytics data
    const results = await Promise.all([
      prisma.property.count(),
      prisma.property.groupBy({
        by: ['country'],
        _count: true,
      }),
      prisma.property.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.user.findMany({
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 30
      }),
      prisma.propertyInquiry.findMany({
        select: { createdAt: true },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.property.findMany({
        take: 5,
        orderBy: {
          favoriteProperties: {
            _count: 'desc'
          }
        },
        include: {
          _count: {
            select: {
              favoriteProperties: true,
              propertyInquiries: true
            }
          }
        }
      })
    ])

    totalProperties = results[0]
    propertiesByCountry = results[1]
    propertiesByStatus = results[2]
    userGrowth = results[3]
    inquiriesByMonth = results[4]
    topProperties = results[5]
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    // Use default empty values if database query fails
  }

  // Calculate growth rate
  const lastMonthUsers = userGrowth.filter(u => 
    u.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length
  const previousMonthUsers = userGrowth.filter(u => 
    u.createdAt > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) &&
    u.createdAt <= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length
  const growthRate = previousMonthUsers > 0 
    ? ((lastMonthUsers - previousMonthUsers) / previousMonthUsers * 100).toFixed(1)
    : '100'

  return (
    <div className="space-y-6">
      {/* Header - Updated styling */}
      <div>
        <h1 className="text-3xl font-black text-stone-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1B4965] rounded-xl flex items-center justify-center shadow-md">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          Analytics Dashboard
        </h1>
        <p className="mt-2 text-stone-600">
          Track your platform's performance and user engagement metrics.
        </p>
      </div>

      {/* Key Metrics - Updated with gradient cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border-2 border-slate-100 overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-all">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#1B4965] rounded-xl flex items-center justify-center shadow-md">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <dt className="text-sm font-medium text-stone-600 mb-1">
              Total Properties
            </dt>
            <dd className="text-3xl font-black text-stone-900">
              {totalProperties}
            </dd>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-100 overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-all">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="flex items-baseline text-sm font-bold px-3 py-1 rounded-lg bg-green-100 text-green-700">
                +{growthRate}%
              </div>
            </div>
            <dt className="text-sm font-medium text-stone-600 mb-1">
              User Growth
            </dt>
            <dd className="text-3xl font-black text-stone-900">
              {lastMonthUsers}
            </dd>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-100 overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-all">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#C97B4B] rounded-xl flex items-center justify-center shadow-md">
                <Activity className="h-6 w-6 text-white" />
              </div>
            </div>
            <dt className="text-sm font-medium text-stone-600 mb-1">
              Monthly Inquiries
            </dt>
            <dd className="text-3xl font-black text-stone-900">
              {inquiriesByMonth.length}
            </dd>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-100 overflow-hidden shadow-lg rounded-2xl hover:shadow-xl transition-all">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-stone-600 rounded-xl flex items-center justify-center shadow-md">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <dt className="text-sm font-medium text-stone-600 mb-1">
              Avg. Engagement
            </dt>
            <dd className="text-3xl font-black text-stone-900">
              {topProperties.length > 0
                ? Math.round(topProperties.reduce((acc, p) => acc + p._count.propertyInquiries, 0) / topProperties.length)
                : 0
              }
            </dd>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Properties by Country - Updated styling */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-[#C97B4B] rounded-lg flex items-center justify-center">
              <PieChart className="h-5 w-5 text-white" />
            </div>
            Properties by Country
          </h3>
          <div className="space-y-4">
            {propertiesByCountry.map((item) => (
              <div key={item.country} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-stone-900">{item.country}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-200 rounded-full h-2.5">
                    <div
                      className="bg-[#1B4965] h-2.5 rounded-full shadow-sm"
                      style={{
                        width: `${(item._count / totalProperties * 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-sm text-stone-900 font-bold w-12 text-right bg-white px-2 py-1 rounded-lg shadow-sm">
                    {item._count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Properties by Status - Updated styling */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            Properties by Status
          </h3>
          <div className="space-y-4">
            {propertiesByStatus.map((item) => {
              const statusColors = {
                'OFF_PLAN': 'bg-amber-500',
                'NEW_BUILD': 'bg-emerald-600',
                'RESALE': 'bg-[#C97B4B]'
              }
              return (
                <div key={item.status} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-stone-900">{item.status.replace('_', ' ')}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-slate-200 rounded-full h-2.5">
                      <div
                        className={`${statusColors[item.status as keyof typeof statusColors]} h-2.5 rounded-full shadow-sm`}
                        style={{
                          width: `${(item._count / totalProperties * 100)}%`
                        }}
                      />
                    </div>
                    <span className="text-sm text-stone-900 font-bold w-12 text-right bg-white px-2 py-1 rounded-lg shadow-sm">
                      {item._count}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Properties - Updated styling */}
        <div className="bg-white border-2 border-slate-100 shadow-lg rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-stone-900 mb-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-stone-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            Top Performing Properties
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Favorites
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Inquiries
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-stone-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {topProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-stone-900">
                      {property.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                      {property.country}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                      {property._count.favoriteProperties}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                      {property._count.propertyInquiries}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold shadow-sm
                        ${property.status === 'OFF_PLAN' ? 'bg-amber-500 text-white' :
                          property.status === 'NEW_BUILD' ? 'bg-emerald-600 text-white' :
                          'bg-[#C97B4B] text-white'}`}>
                        {property.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
