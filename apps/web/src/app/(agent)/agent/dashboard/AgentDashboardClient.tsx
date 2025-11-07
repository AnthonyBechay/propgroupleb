'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api/client'
import { ApiResponse, AgentDashboardStats } from '@/lib/types/api'
import {
  Home,
  TrendingUp,
  Mail,
  DollarSign,
  Eye,
  CheckCircle,
  Clock,
  BarChart3,
  FileText,
  Users,
  MapPin,
  Building2,
  Phone,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'

export default function AgentDashboardClient() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AgentDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const response = await apiClient.getAgentDashboardStats() as ApiResponse<AgentDashboardStats>
      if (response.success && response.data) {
        setStats(response.data)
      } else {
        setError(response.error || 'Failed to fetch dashboard stats')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg text-gray-600">{error || 'Failed to load dashboard'}</p>
        <Button onClick={fetchDashboardStats}>Try Again</Button>
      </div>
    )
  }

  // AgentDashboardStats has direct properties, not nested in overview
  const { totalProperties, totalInquiries, totalViews, estimatedCommission, recentInquiries, topProperties } = stats

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="pg-container max-w-7xl mx-auto py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <h1 className="pg-text-3xl sm:pg-text-4xl lg:pg-text-5xl font-black text-gray-900 dark:text-white">
            Welcome back, <span className="pg-gradient-text">{user?.firstName || 'Agent'}</span>!
          </h1>
          <p className="pg-text-lg text-gray-600 dark:text-gray-300 mt-2">
            Here's your performance overview
          </p>
        </div>

        {/* Stats Grid */}
        <div className="pg-grid pg-grid-cols-1 md:pg-grid-cols-2 lg:pg-grid-cols-4 mb-8 sm:mb-12">
          {/* Total Properties */}
          <div className="pg-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl shadow-md">
                <Home className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                Active
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Total Properties
              </p>
              <p className="pg-text-3xl sm:pg-text-4xl font-bold text-gray-900 dark:text-white">
                {totalProperties}
              </p>
            </div>
          </div>

          {/* Total Inquiries */}
          <div className="pg-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl shadow-md">
                <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex items-center text-sm text-orange-600 dark:text-orange-400">
                <Clock className="w-4 h-4 mr-1" />
                Pending
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Total Inquiries
              </p>
              <p className="pg-text-3xl sm:pg-text-4xl font-bold text-gray-900 dark:text-white">
                {totalInquiries}
              </p>
            </div>
          </div>

          {/* Total Views */}
          <div className="pg-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl shadow-md">
                <Eye className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Across all properties
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Total Views
              </p>
              <p className="pg-text-3xl sm:pg-text-4xl font-bold text-gray-900 dark:text-white">
                {totalViews.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Estimated Commission */}
          <div className="pg-stat-card">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl shadow-md">
                <DollarSign className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Estimated
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Est. Commission
              </p>
              <p className="pg-text-3xl sm:pg-text-4xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(estimatedCommission)}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity & Top Properties */}
        <div className="pg-grid pg-grid-cols-1 lg:pg-grid-cols-2 mb-8 sm:mb-12">
          {/* Recent Inquiries */}
          <div className="pg-card">
            <div className="pg-card-header">
              <CardTitle className="flex items-center justify-between pg-text-lg font-bold text-gray-900 dark:text-white">
                <span>Recent Inquiries</span>
                <Link href="/agent/inquiries">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                Latest property inquiries from potential buyers
              </CardDescription>
            </div>
            <div className="pg-card-content">
              <div className="space-y-4">
                {recentInquiries.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No inquiries yet</p>
                ) : (
                  recentInquiries.slice(0, 5).map((inquiry: any) => (
                    <div key={inquiry.id} className="flex items-start space-x-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                      <div className="flex-shrink-0">
                        {inquiry.property?.images?.[0] ? (
                          <Image
                            src={inquiry.property.images[0]}
                            alt={inquiry.property.title}
                            width={60}
                            height={60}
                            className="rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-15 h-15 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <Home className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {inquiry.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {inquiry.property?.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {formatDate(inquiry.createdAt)}
                        </p>
                      </div>
                      <div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/agent/inquiries?id=${inquiry.id}`}>
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Top Properties */}
          <div className="pg-card">
            <div className="pg-card-header">
              <CardTitle className="flex items-center justify-between pg-text-lg font-bold text-gray-900 dark:text-white">
                <span>Top Performing Properties</span>
                <Link href="/agent/properties">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                Your best properties by views and inquiries
              </CardDescription>
            </div>
            <div className="pg-card-content">
              <div className="space-y-4">
                {topProperties.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No properties yet</p>
                ) : (
                  topProperties.map((property: any) => (
                    <div key={property.id} className="flex items-start space-x-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors">
                      <div className="flex-shrink-0">
                        {property.images?.[0] ? (
                          <Image
                            src={property.images[0]}
                            alt={property.title}
                            width={60}
                            height={60}
                            className="rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-15 h-15 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <Home className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {property.title}
                        </p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(property.price)}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <Eye className="w-3 h-3 mr-1" />
                            {property.views}
                          </span>
                          <span className="flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {property._count?.propertyInquiries || 0}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/property/${property.id}`}>
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pg-card">
          <div className="pg-card-header">
            <CardTitle className="pg-text-lg font-bold text-gray-900 dark:text-white">Quick Actions</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">Manage your properties and client relationships</CardDescription>
          </div>
          <div className="pg-card-content">
            <div className="pg-grid pg-grid-cols-1 md:pg-grid-cols-3">
              <Link href="/agent/properties">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Building2 className="w-6 h-6" />
                  <span>Manage Properties</span>
                </Button>
              </Link>
              <Link href="/agent/inquiries">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Mail className="w-6 h-6" />
                  <span>View Inquiries</span>
                </Button>
              </Link>
              <Link href="/agent/profile">
                <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <Users className="w-6 h-6" />
                  <span>Edit Profile</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
