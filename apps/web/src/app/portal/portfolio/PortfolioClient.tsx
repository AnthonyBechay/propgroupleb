'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  DollarSign,
  Home,
  PieChart,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MapPin
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PortfolioItem {
  id: string
  customName: string
  propertyId: string
  purchasePrice: number
  currentValue: number
  purchaseDate: string
  location: string
  currentRent: number
  monthlyExpenses: number
  roi: number
  appreciation: number
  type: string
  status: string
}

interface PortfolioClientProps {
  initialPortfolio: PortfolioItem[]
}

export function PortfolioClient({ initialPortfolio }: PortfolioClientProps) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('purchaseDate')

  // Calculate portfolio totals
  const totals = initialPortfolio.reduce((acc, property) => {
    acc.totalInvestment += property.purchasePrice
    acc.totalValue += property.currentValue
    acc.totalMonthlyIncome += property.currentRent
    acc.totalMonthlyExpenses += property.monthlyExpenses
    return acc
  }, {
    totalInvestment: 0,
    totalValue: 0,
    totalMonthlyIncome: 0,
    totalMonthlyExpenses: 0
  })

  const totalAppreciation = totals.totalInvestment > 0
    ? ((totals.totalValue - totals.totalInvestment) / totals.totalInvestment) * 100
    : 0
  const netMonthlyIncome = totals.totalMonthlyIncome - totals.totalMonthlyExpenses
  const annualNetIncome = netMonthlyIncome * 12
  const overallROI = totals.totalInvestment > 0
    ? (annualNetIncome / totals.totalInvestment) * 100
    : 0

  // Filter and sort portfolio
  const filteredPortfolio = initialPortfolio
    .filter(p => filterStatus === 'all' || p.status === filterStatus)
    .sort((a, b) => {
      switch(sortBy) {
        case 'value':
          return b.currentValue - a.currentValue
        case 'roi':
          return b.roi - a.roi
        case 'purchaseDate':
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
        default:
          return 0
      }
    })

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                My Portfolio
              </h1>
              <p className="text-slate-600">
                Track and manage your real estate investments
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            icon={<DollarSign className="w-6 h-6" />}
            title="Total Investment"
            value={`$${totals.totalInvestment.toLocaleString()}`}
            subtitle="Across all properties"
            color="blue"
          />
          <SummaryCard
            icon={<TrendingUp className="w-6 h-6" />}
            title="Current Value"
            value={`$${totals.totalValue.toLocaleString()}`}
            subtitle={`+${totalAppreciation.toFixed(1)}% appreciation`}
            color="green"
            trend={totalAppreciation}
          />
          <SummaryCard
            icon={<Home className="w-6 h-6" />}
            title="Net Monthly Income"
            value={`$${netMonthlyIncome.toLocaleString()}`}
            subtitle={`${overallROI.toFixed(1)}% annual ROI`}
            color="purple"
          />
          <SummaryCard
            icon={<PieChart className="w-6 h-6" />}
            title="Properties"
            value={initialPortfolio.length}
            subtitle={`${initialPortfolio.filter(p => p.status === 'Rented').length} rented`}
            color="orange"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
          >
            <option value="all">All Properties</option>
            <option value="Rented">Rented</option>
            <option value="Vacant">Vacant</option>
            <option value="Under Construction">Under Construction</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]"
          >
            <option value="purchaseDate">Sort by Date</option>
            <option value="value">Sort by Value</option>
            <option value="roi">Sort by ROI</option>
          </select>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredPortfolio.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredPortfolio.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Home className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {initialPortfolio.length === 0
                ? "Your portfolio is empty"
                : "No properties match your filters"
              }
            </h3>
            <p className="text-slate-600 mb-6">
              {initialPortfolio.length === 0
                ? "Browse properties to start building your investment portfolio."
                : "Try adjusting your filters to see more properties"
              }
            </p>
            {initialPortfolio.length === 0 && (
              <Link href="/properties">
                <Button className="bg-[#1B3A5C] hover:bg-[#24507D]">
                  Browse Properties
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Summary Card Component
function SummaryCard({ icon, title, value, subtitle, color, trend }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-[#1B3A5C]',
    green: 'bg-emerald-600',
    purple: 'bg-[#C49A2E]',
    orange: 'bg-slate-600',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color] || colorClasses.blue} p-3 rounded-lg text-white`}>
          {icon}
        </div>
        {trend !== undefined && (
          trend > 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-500" /> :
          trend < 0 ? <ArrowDownRight className="w-5 h-5 text-red-500" /> : null
        )}
      </div>
      <h3 className="text-sm text-slate-600 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}

// Property Card Component
function PropertyCard({ property }: { property: PortfolioItem }) {
  const netIncome = property.currentRent - property.monthlyExpenses
  const isPositive = netIncome > 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{property.customName}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {property.location}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500">Purchase Price</p>
          <p className="text-sm font-semibold">${property.purchasePrice.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Current Value</p>
          <p className="text-sm font-semibold">${property.currentValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Monthly Income</p>
          <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            ${netIncome.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">ROI</p>
          <p className="text-sm font-semibold">{property.roi.toFixed(1)}%</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          property.status === 'Rented' ? 'bg-emerald-100 text-emerald-800' :
          property.status === 'Vacant' ? 'bg-red-100 text-red-800' :
          'bg-amber-100 text-amber-800'
        }`}>
          {property.status}
        </span>
        <span className="text-xs text-slate-500">
          Purchased {new Date(property.purchaseDate).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
