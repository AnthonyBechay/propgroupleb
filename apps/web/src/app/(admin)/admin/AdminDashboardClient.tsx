'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import {
  Building2,
  Users,
  Heart,
  FileText,
  Shield,
  MessageSquare,
  Inbox,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Globe,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import Link from 'next/link'

interface DashboardData {
  overview: {
    totalProperties: number
    totalUsers: number
    totalFavorites: number
    totalInquiries: number
    totalContactMessages: number
    totalDocuments: number
  }
  trends: {
    newUsersThisWeek: number
    newInquiriesThisWeek: number
    newUsersThisMonth: number
    newInquiriesThisMonth: number
  }
  recent: {
    users: Array<{ id: string; email: string; firstName?: string; lastName?: string; role: string; createdAt: string }>
    inquiries: Array<{ id: string; name: string; email: string; propertyTitle: string; status: string; createdAt: string; property?: { id: string; title: string; price: number; currency: string } }>
    properties: Array<{ id: string; title: string; country: string; price: number; currency: string; status?: string; availabilityStatus?: string; createdAt: string }>
    contacts: Array<{ id: string; name: string; email: string; subject?: string; createdAt: string }>
  }
  statistics: {
    usersByRole: Array<{ role: string; _count: { role: number } }>
    propertiesByCountry: Array<{ country: string; _count: { country: number } }>
    inquiriesByStatus: Array<{ status: string; _count: { status: number } }>
    propertiesByStatus: Array<{ availabilityStatus: string; _count: { availabilityStatus: number } }>
  }
}

function formatCurrency(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  RESPONDED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-stone-100 text-stone-600',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  RESERVED: 'bg-amber-100 text-amber-700',
  SOLD: 'bg-red-100 text-red-700',
  OFF_MARKET: 'bg-stone-100 text-stone-600',
}

export function AdminDashboardClient() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await apiClient.getAdminStats() as any
        const raw = response.data || response
        setData(raw)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-stone-500 text-sm">Loading dashboard...</div>
      </div>
    )
  }

  if (!data) return null

  const { overview, trends, recent, statistics } = data

  const statCards = [
    { label: 'Properties', value: overview.totalProperties, icon: Building2, color: 'bg-[#1B4965]', href: '/admin/properties' },
    { label: 'Users', value: overview.totalUsers, icon: Users, color: 'bg-emerald-600', href: '/admin/users', trend: trends.newUsersThisWeek, trendLabel: 'this week' },
    { label: 'Inquiries', value: overview.totalInquiries, icon: MessageSquare, color: 'bg-[#C97B4B]', href: '/admin/inquiries', trend: trends.newInquiriesThisWeek, trendLabel: 'this week' },
    { label: 'Favorites', value: overview.totalFavorites, icon: Heart, color: 'bg-rose-500' },
    { label: 'Messages', value: overview.totalContactMessages, icon: Inbox, color: 'bg-violet-600', href: '/admin/contacts' },
    { label: 'Documents', value: overview.totalDocuments, icon: FileText, color: 'bg-sky-600', href: '/admin/documents' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
            <p className="text-sm text-stone-500 mt-0.5">Platform overview</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
            user?.role === 'SUPER_ADMIN' ? 'bg-[#C97B4B] text-white' : 'bg-[#1B4965] text-white'
          }`}>
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            {user?.role?.replace('_', ' ')}
          </span>
        </div>

        {/* Stat Cards - compact 6-col grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {statCards.map((item) => {
            const content = (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 ${item.color} rounded-lg flex items-center justify-center`}>
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  {item.href && <ArrowUpRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500 transition-colors" />}
                </div>
                <p className="text-2xl font-bold text-stone-900">{item.value.toLocaleString()}</p>
                <p className="text-xs text-stone-500 mt-0.5">{item.label}</p>
                {item.trend !== undefined && item.trend > 0 && (
                  <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />+{item.trend} {item.trendLabel}
                  </p>
                )}
              </>
            )
            const cls = "bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-shadow group"
            return item.href ? (
              <Link key={item.label} href={item.href} className={cls}>{content}</Link>
            ) : (
              <div key={item.label} className={cls}>{content}</div>
            )
          })}
        </div>

        {/* Two-column breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Properties by Country */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-stone-400" />
              Properties by Country
            </h3>
            <div className="space-y-2">
              {statistics.propertiesByCountry.map((s) => {
                const pct = overview.totalProperties > 0 ? (s._count.country / overview.totalProperties * 100) : 0
                return (
                  <div key={s.country} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-stone-600 w-20 truncate">{s.country}</span>
                    <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1B4965] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-stone-700 w-8 text-right">{s._count.country}</span>
                  </div>
                )
              })}
              {statistics.propertiesByCountry.length === 0 && (
                <p className="text-xs text-stone-400">No properties yet</p>
              )}
            </div>
          </div>

          {/* Property Availability */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-stone-400" />
              Availability Status
            </h3>
            <div className="space-y-2">
              {statistics.propertiesByStatus?.map((s) => (
                <div key={s.availabilityStatus} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[s.availabilityStatus] || 'bg-stone-100 text-stone-600'}`}>
                    {s.availabilityStatus?.replace('_', ' ') || 'N/A'}
                  </span>
                  <span className="text-sm font-semibold text-stone-700">{s._count.availabilityStatus}</span>
                </div>
              ))}
              {(!statistics.propertiesByStatus || statistics.propertiesByStatus.length === 0) && (
                <p className="text-xs text-stone-400">No data</p>
              )}
            </div>
          </div>

          {/* Inquiry Status */}
          <div className="bg-white rounded-xl border border-stone-200 p-4">
            <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-stone-400" />
              Inquiry Status
            </h3>
            <div className="space-y-2">
              {statistics.inquiriesByStatus?.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[s.status] || 'bg-stone-100 text-stone-600'}`}>
                    {s.status?.replace('_', ' ') || 'N/A'}
                  </span>
                  <span className="text-sm font-semibold text-stone-700">{s._count.status}</span>
                </div>
              ))}
              {(!statistics.inquiriesByStatus || statistics.inquiriesByStatus.length === 0) && (
                <p className="text-xs text-stone-400">No inquiries yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Activity Feed — Recent Inquiries + Recent Properties + Recent Contacts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Inquiries */}
          <div className="bg-white rounded-xl border border-stone-200">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#C97B4B]" />
                Recent Inquiries
              </h3>
              <Link href="/admin/inquiries" className="text-xs text-[#1B4965] hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recent.inquiries.length === 0 ? (
                <p className="px-4 py-6 text-sm text-stone-400 text-center">No inquiries yet</p>
              ) : (
                recent.inquiries.map((inq) => (
                  <div key={inq.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{inq.name || inq.email}</p>
                        <p className="text-xs text-stone-500 truncate">{inq.propertyTitle || inq.property?.title || 'General inquiry'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[inq.status] || 'bg-stone-100 text-stone-600'}`}>
                          {inq.status}
                        </span>
                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{timeAgo(inq.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Properties */}
          <div className="bg-white rounded-xl border border-stone-200">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#1B4965]" />
                Recent Properties
              </h3>
              <Link href="/admin/properties" className="text-xs text-[#1B4965] hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recent.properties.length === 0 ? (
                <p className="px-4 py-6 text-sm text-stone-400 text-center">No properties yet</p>
              ) : (
                recent.properties.map((prop) => (
                  <div key={prop.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{prop.title}</p>
                        <p className="text-xs text-stone-500">{prop.country} &middot; {formatCurrency(prop.price, prop.currency)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {prop.availabilityStatus && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[prop.availabilityStatus] || 'bg-stone-100 text-stone-600'}`}>
                            {prop.availabilityStatus.replace('_', ' ')}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-400">{timeAgo(prop.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Users */}
          <div className="bg-white rounded-xl border border-stone-200">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                New Users (7 days)
              </h3>
              <Link href="/admin/users" className="text-xs text-[#1B4965] hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recent.users.length === 0 ? (
                <p className="px-4 py-6 text-sm text-stone-400 text-center">No new users this week</p>
              ) : (
                recent.users.map((u) => (
                  <div key={u.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white">{u.email.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">
                            {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                          </p>
                          {u.firstName && <p className="text-xs text-stone-500 truncate">{u.email}</p>}
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0">{timeAgo(u.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Contact Messages */}
          <div className="bg-white rounded-xl border border-stone-200">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
                <Inbox className="h-4 w-4 text-violet-600" />
                Recent Messages
              </h3>
              <Link href="/admin/contacts" className="text-xs text-[#1B4965] hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-stone-50">
              {recent.contacts?.length === 0 ? (
                <p className="px-4 py-6 text-sm text-stone-400 text-center">No messages yet</p>
              ) : (
                recent.contacts?.map((msg) => (
                  <div key={msg.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{msg.name}</p>
                        <p className="text-xs text-stone-500 truncate">{msg.subject || msg.email}</p>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0">{timeAgo(msg.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
