'use client'

import { useState } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  MapPin, 
  DollarSign,
  Building2,
  Users,
  Calendar,
  Filter,
  Download,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  Home
} from 'lucide-react'
import Link from 'next/link'

interface MarketData {
  country: string
  name: string
  avgPrice: number
  priceChange: number
  avgROI: number
  rentalYield: number
  goldenVisa: number
  propertyCount: number
  marketTrend: string
  bestFor: string[]
  insights: string[]
}

interface ComparisonMetric {
  metric: string
  key: string
  format: string
}

interface MarketAnalysisClientProps {
  marketData: MarketData[]
  comparisonMetrics: ComparisonMetric[]
}

export function MarketAnalysisClient({ marketData, comparisonMetrics }: MarketAnalysisClientProps) {
  const [selectedCountry, setSelectedCountry] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState('avgROI')
  const [timeRange, setTimeRange] = useState('1y')

  const formatValue = (value: number, format: string) => {
    switch(format) {
      case 'currency':
        return value === 0 ? 'N/A' : `$${value.toLocaleString()}`
      case 'percentage':
        return `${value > 0 ? '+' : ''}${value}%`
      default:
        return value.toString()
    }
  }

  const selectedMarket = marketData[selectedCountry] || marketData[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Market Analysis
              </h1>
              <p className="text-gray-600">
                Real-time insights and trends across our investment markets
              </p>
            </div>
          </div>

        </div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {marketData.length > 0 ? marketData.map((data, index) => (
            <div
              key={data.country}
              onClick={() => setSelectedCountry(index)}
              className={`bg-white rounded-xl shadow-sm p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedCountry === index ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{data.name}</h3>
                </div>
                {data.priceChange > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-500" />
                ) : data.priceChange < 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-red-500" />
                ) : (
                  <span className="w-5 h-5 text-gray-400">→</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Avg. Price</span>
                  <span className="text-sm font-medium">${(data.avgPrice / 1000).toFixed(0)}K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">ROI</span>
                  <span className="text-sm font-medium">{data.avgROI.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Properties</span>
                  <span className="text-sm font-medium">{data.propertyCount}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Market Data Coming Soon
              </h3>
              <p className="text-gray-600 mb-6">
                We're preparing detailed market analysis for Lebanon real estate. Check back soon for updated insights.
              </p>
            </div>
          )}
        </div>

        {/* Detailed Analysis Section */}
        {marketData.length > 0 && selectedMarket && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Country Deep Dive */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {selectedMarket.name} Market Deep Dive
              </h2>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <MetricCard
                  icon={<DollarSign className="w-5 h-5" />}
                  label="Avg. Property Price"
                  value={`$${selectedMarket.avgPrice.toLocaleString()}`}
                  trend={selectedMarket.priceChange}
                />
                <MetricCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Expected ROI"
                  value={`${selectedMarket.avgROI.toFixed(1)}%`}
                  trend={0}
                />
                <MetricCard
                  icon={<Home className="w-5 h-5" />}
                  label="Rental Yield"
                  value={`${selectedMarket.rentalYield.toFixed(1)}%`}
                  trend={0}
                />
                <MetricCard
                  icon={<Globe className="w-5 h-5" />}
                  label="Golden Visa"
                  value={selectedMarket.goldenVisa === 0 ? 'N/A' : `$${(selectedMarket.goldenVisa / 1000)}K`}
                  trend={0}
                />
                <MetricCard
                  icon={<Building2 className="w-5 h-5" />}
                  label="Market Status"
                  value={selectedMarket.marketTrend}
                  trend={0}
                />
                <MetricCard
                  icon={<Users className="w-5 h-5" />}
                  label="Properties"
                  value={selectedMarket.propertyCount.toString()}
                  trend={0}
                />
              </div>

              {/* Best For */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Best For</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selectedMarket.bestFor.map((item) => (
                    <div key={item} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-900">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* View Properties Button */}
              <Link
                href={`/properties?country=${selectedMarket.country.toLowerCase()}`}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                View {selectedMarket.name} Properties
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Link>
            </div>

            {/* Market Insights */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Market Insights
              </h3>
              <div className="space-y-3">
                {selectedMarket.insights.map((insight, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="mt-1">
                      <Info className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        {marketData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Market Comparison</h2>
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  compareMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {compareMode ? 'Hide Comparison' : 'Show Comparison'}
              </button>
            </div>

            {compareMode && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Metric</th>
                      {marketData.map((data) => (
                        <th key={data.country} className="text-center py-3 px-4 font-semibold text-gray-900">
                          {data.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonMetrics.map((metric) => (
                      <tr key={metric.key} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-700 font-medium">{metric.metric}</td>
                        {marketData.map((data) => {
                          const metricKey = metric.key as keyof typeof data;
                          const metricValue = data[metricKey] as number;
                          return (
                            <td key={data.country} className="text-center py-3 px-4">
                              <span className={`font-medium ${
                                metric.key === 'priceChange' && metricValue > 0 ? 'text-green-600' :
                                metric.key === 'priceChange' && metricValue < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {formatValue(metricValue, metric.format)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Metric Card Component
function MetricCard({ icon, label, value, trend }: any) {
  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-gray-500">{icon}</div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-gray-900">{value}</span>
        {trend !== 0 && (
          <span className={`text-xs font-medium ${
            trend > 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  )
}
