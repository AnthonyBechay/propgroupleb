'use client'

import { useState } from 'react'
import { 
  TrendingUp, 
  Home, 
  Calculator, 
  Heart, 
  FileText, 
  Users,
  DollarSign,
  MapPin,
  BarChart3,
  Building2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import Link from 'next/link'

interface DashboardClientProps {
  user: any
  portfolioStats: {
    totalInvestment: number
    totalProperties: number
    averageROI: number
    monthlyIncome: number
    portfolioGrowth: number
    savedProperties: number
  }
  recentActivity: Array<{
    id: number
    type: string
    property: string
    date: string
  }>
  marketTrends: Array<{
    country: string
    trend: 'up' | 'down' | 'stable'
    value: number
    avgPrice: number
    propertyCount: number
  }>
  recentProperties: any[]
}

export function DashboardClient({ 
  user, 
  portfolioStats, 
  recentActivity, 
  marketTrends, 
  recentProperties 
}: DashboardClientProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('month')

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="pg-container max-w-7xl mx-auto py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="pg-text-3xl sm:pg-text-4xl lg:pg-text-5xl font-black text-stone-900 mb-3">
            Welcome back, <span className="pg-gradient-text">{user?.email?.split('@')[0] || 'Investor'}</span>!
          </h1>
          <p className="pg-text-lg text-stone-600 max-w-2xl">
            Here's an overview of your investment portfolio and market insights
          </p>
        </div>

        {/* Stats Grid */}
        <div className="pg-grid pg-grid-cols-1 sm:pg-grid-cols-2 lg:pg-grid-cols-4 mb-8 sm:mb-12">
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Total Investment"
            value={`$${portfolioStats.totalInvestment.toLocaleString()}`}
            trend="neutral"
            color="blue"
          />
          <StatCard
            icon={<Building2 className="w-6 h-6" />}
            title="Properties Owned"
            value={portfolioStats.totalProperties}
            trend="neutral"
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Average ROI"
            value={`${portfolioStats.averageROI.toFixed(1)}%`}
            trend="up"
            color="purple"
          />
          <StatCard
            icon={<Heart className="w-6 h-6" />}
            title="Saved Properties"
            value={portfolioStats.savedProperties}
            change="View all"
            trend="neutral"
            color="pink"
          />
        </div>

        {/* Quick Actions */}
        <div className="pg-grid pg-grid-cols-2 md:pg-grid-cols-4 mb-8 sm:mb-12">
          <QuickActionCard
            href="/properties"
            icon={<Home className="w-8 h-8" />}
            title="Browse Properties"
            description="Explore new opportunities"
            color="blue"
          />
          <QuickActionCard
            href="/portal/calculator"
            icon={<Calculator className="w-8 h-8" />}
            title="ROI Calculator"
            description="Calculate returns"
            color="green"
          />
          <QuickActionCard
            href="/portal/market-analysis"
            icon={<BarChart3 className="w-8 h-8" />}
            title="Market Analysis"
            description="View market trends"
            color="purple"
          />
          <QuickActionCard
            href="/portal/portfolio"
            icon={<FileText className="w-8 h-8" />}
            title="My Portfolio"
            description="Manage investments"
            color="orange"
          />
        </div>

        {/* Main Content Grid */}
        <div className="pg-grid pg-grid-cols-1 lg:pg-grid-cols-3 mb-8 sm:mb-12">
          {/* Market Trends */}
          <div className="lg:col-span-2 pg-card">
            <div className="pg-card-header">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="pg-text-xl font-bold text-stone-900">Market Trends</h2>
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border border-stone-200 rounded-lg text-sm bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4965] focus:border-transparent"
                >
                  <option value="week">Last Week</option>
                  <option value="month">Last Month</option>
                  <option value="year">Last Year</option>
                </select>
              </div>
            </div>
            <div className="pg-card-content">
            
              <div className="space-y-4">
                {marketTrends.length > 0 ? marketTrends.map((market) => (
                  <div key={market.country} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl hover:bg-stone-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-900">{market.country}</h3>
                        <p className="text-sm text-stone-500">
                          {market.propertyCount} properties • Avg: ${(market.avgPrice / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-lg font-semibold ${
                        market.trend === 'up' ? 'text-emerald-600' : 
                        market.trend === 'down' ? 'text-red-600' : 'text-stone-600'
                      }`}>
                        {market.value > 0 ? '+' : ''}{market.value}%
                      </span>
                      {market.trend === 'up' ? (
                        <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                      ) : market.trend === 'down' ? (
                        <ArrowDownRight className="w-5 h-5 text-red-600" />
                      ) : (
                        <span className="w-5 h-5 text-stone-400">→</span>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-stone-500">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-stone-300" />
                    <p>No market data available. Use the seed button in admin to add sample data.</p>
                  </div>
                )}
              </div>

              <Link 
                href="/portal/market-analysis" 
                className="mt-6 inline-flex items-center text-[#1B4965] hover:text-[#2B6985] font-medium transition-colors"
              >
                View detailed analysis
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="pg-card">
            <div className="pg-card-header">
              <h2 className="pg-text-xl font-bold text-stone-900">Recent Activity</h2>
            </div>
            <div className="pg-card-content">
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === 'inquiry' ? 'bg-blue-500' :
                      activity.type === 'favorite' ? 'bg-pink-500' : 'bg-gray-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm text-stone-900">
                        {activity.type === 'inquiry' && 'Sent inquiry for '}
                        {activity.type === 'favorite' && 'Saved '}
                        {activity.type === 'view' && 'Viewed '}
                        <span className="font-medium">{activity.property}</span>
                      </p>
                      <p className="text-xs text-stone-500 mt-1">{activity.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link 
                href="/portal/activity" 
                className="mt-6 inline-flex items-center text-[#1B4965] hover:text-[#2B6985] font-medium text-sm transition-colors"
              >
                View all activity
                <ArrowUpRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </div>
        </div>

        {/* Portfolio Performance */}
        <div className="pg-premium-card bg-[#1B4965] text-white shadow-xl rounded-2xl">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <h2 className="pg-text-2xl sm:pg-text-3xl font-bold mb-3">Portfolio Performance</h2>
                <p className="text-white/70 mb-6 text-lg">
                  {portfolioStats.totalProperties > 0 
                    ? "Your investments are performing well!" 
                    : "Start building your portfolio by exploring properties"
                  }
                </p>
                <div className="flex flex-wrap gap-6 sm:gap-8">
                  <div>
                    <p className="text-sm text-white/70 mb-1">Monthly Income</p>
                    <p className="pg-text-2xl sm:pg-text-3xl font-bold">${portfolioStats.monthlyIncome.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/70 mb-1">Portfolio Growth</p>
                    <p className="pg-text-2xl sm:pg-text-3xl font-bold">+{portfolioStats.portfolioGrowth}%</p>
                  </div>
                </div>
              </div>
              <Link 
                href="/portal/portfolio" 
                className="bg-white text-[#1B4965] px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg inline-flex items-center"
              >
                View Portfolio
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({ icon, title, value, change, trend, color }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-[#1B4965]',
    green: 'bg-emerald-600',
    purple: 'bg-[#C97B4B]',
    pink: 'bg-stone-600',
  }

  return (
    <div className="pg-stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color] || colorClasses.blue} p-3 rounded-xl text-white shadow-lg`}>
          {icon}
        </div>
        {trend === 'up' && <ArrowUpRight className="w-5 h-5 text-emerald-500" />}
        {trend === 'down' && <ArrowDownRight className="w-5 h-5 text-red-500" />}
      </div>
      <h3 className="text-sm text-stone-600 mb-2 font-medium">{title}</h3>
      <p className="pg-text-2xl sm:pg-text-3xl font-bold text-stone-900 mb-2">{value}</p>
      <p className={`text-sm ${
        trend === 'up' ? 'text-emerald-600' : 
        trend === 'down' ? 'text-red-600' : 'text-stone-500'
      }`}>
        {change}
      </p>
    </div>
  )
}

// Quick Action Card Component
function QuickActionCard({ href, icon, title, description, color }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-[#1B4965] hover:bg-[#2B6985]',
    green: 'bg-emerald-600 hover:bg-emerald-700',
    purple: 'bg-[#C97B4B] hover:bg-[#B86A3A]',
    orange: 'bg-stone-600 hover:bg-stone-700',
  }

  return (
    <Link 
      href={href}
      className="group pg-card hover:shadow-lg transition-all transform hover:-translate-y-1"
    >
      <div className="pg-card-content">
        <div className={`${colorClasses[color] || colorClasses.blue} p-4 rounded-xl text-white mb-4 group-hover:scale-110 transition-transform inline-block shadow-lg`}>
          {icon}
        </div>
        <h3 className="font-bold text-stone-900 mb-2 pg-text-lg">{title}</h3>
        <p className="text-sm text-stone-500">{description}</p>
      </div>
    </Link>
  )
}
