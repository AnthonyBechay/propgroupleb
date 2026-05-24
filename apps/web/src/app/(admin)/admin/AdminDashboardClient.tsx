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
  MapPin,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import Link from 'next/link'

interface DashboardData {
  overview: {
    totalBuildings: number
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
    inquiries: Array<{ id: string; name: string; email: string; buildingTitle?: string; status: string; createdAt: string; building?: { id: string; title: string } }>
    buildings: Array<{ id: string; title: string; city?: string; status: string; createdAt: string }>
    contacts: Array<{ id: string; name: string; email: string; subject?: string; createdAt: string }>
  }
  statistics: {
    usersByRole: Array<{ role: string; _count: { role: number } }>
    buildingsByCity: Array<{ city: string | null; _count: { city: number } }>
    inquiriesByStatus: Array<{ status: string; _count: { status: number } }>
    buildingsByStatus: Array<{ status: string; _count: { status: number } }>
  }
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
  NEW:           'bg-blue-100 text-blue-700',
  PENDING:       'bg-amber-100 text-amber-700',
  RESPONDED:     'bg-blue-100 text-blue-700',
  CLOSED:        'bg-slate-100 text-slate-600',
  CONVERTED:     'bg-emerald-100 text-emerald-700',
  OFF_PLAN:      'bg-violet-100 text-violet-700',
  NEW_BUILD:     'bg-sky-100 text-sky-700',
  RESALE:        'bg-slate-100 text-slate-600',
  AVAILABLE:     'bg-emerald-100 text-emerald-700',
  RESERVED:      'bg-amber-100 text-amber-700',
  SOLD:          'bg-red-100 text-red-700',
  OFF_MARKET:    'bg-slate-100 text-slate-600',
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
        <div className="text-slate-500 text-sm">Loading dashboard…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400 text-sm">Could not load dashboard data.</div>
      </div>
    )
  }

  const { overview, trends, recent, statistics } = data

  const statCards = [
    { label: 'Buildings', value: overview.totalBuildings ?? 0,        icon: Building2,    color: 'bg-slate-800', href: '/admin/properties' },
    { label: 'Users',     value: overview.totalUsers ?? 0,            icon: Users,        color: 'bg-emerald-600', href: '/admin/users',    trend: trends.newUsersThisWeek,    trendLabel: 'this week' },
    { label: 'Inquiries', value: overview.totalInquiries ?? 0,        icon: MessageSquare,color: 'bg-slate-600', href: '/admin/inquiries', trend: trends.newInquiriesThisWeek, trendLabel: 'this week' },
    { label: 'Favorites', value: overview.totalFavorites ?? 0,        icon: Heart,        color: 'bg-rose-500' },
    { label: 'Messages',  value: overview.totalContactMessages ?? 0,  icon: Inbox,        color: 'bg-violet-600', href: '/admin/contacts' },
    { label: 'Documents', value: overview.totalDocuments ?? 0,        icon: FileText,     color: 'bg-sky-600',    href: '/admin/documents' },
  ]

  const totalBuildings = overview.totalBuildings || 1

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Platform overview</p>
          </div>
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white">
            <Shield className="h-3.5 w-3.5 mr-1.5" />
            {user?.role?.replace('_', ' ')}
          </span>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {statCards.map((item) => {
            const content = (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 ${item.color} rounded-lg flex items-center justify-center`}>
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  {item.href && <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />}
                </div>
                <p className="text-2xl font-bold text-slate-900">{item.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                {item.trend !== undefined && item.trend > 0 && (
                  <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />+{item.trend} {item.trendLabel}
                  </p>
                )}
              </>
            )
            const cls = "bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow group"
            return item.href ? (
              <Link key={item.label} href={item.href} className={cls}>{content}</Link>
            ) : (
              <div key={item.label} className={cls}>{content}</div>
            )
          })}
        </div>

        {/* Breakdown row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* Buildings by City */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              Buildings by City
            </h3>
            <div className="space-y-2">
              {(statistics.buildingsByCity ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">No buildings yet</p>
              ) : (
                (statistics.buildingsByCity ?? []).map((s) => {
                  const pct = totalBuildings > 0 ? (s._count.city / totalBuildings * 100) : 0
                  return (
                    <div key={s.city ?? 'unknown'} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-600 w-24 truncate">{s.city ?? 'Unknown'}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 w-6 text-right">{s._count.city}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Building Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              Building Status
            </h3>
            <div className="space-y-2">
              {(statistics.buildingsByStatus ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">No data</p>
              ) : (
                (statistics.buildingsByStatus ?? []).map((s) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {s.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{s._count.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Inquiry Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              Inquiry Status
            </h3>
            <div className="space-y-2">
              {(statistics.inquiriesByStatus ?? []).length === 0 ? (
                <p className="text-xs text-slate-400">No inquiries yet</p>
              ) : (
                (statistics.inquiriesByStatus ?? []).map((s) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[s.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {s.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{s._count.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Recent Inquiries */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                Recent Inquiries
              </h3>
              <Link href="/admin/inquiries" className="text-xs text-slate-500 hover:text-slate-900 font-medium">View all</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {(recent.inquiries ?? []).length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No inquiries yet</p>
              ) : (
                (recent.inquiries ?? []).map((inq) => (
                  <div key={inq.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{inq.name || inq.email}</p>
                        <p className="text-xs text-slate-500 truncate">{inq.buildingTitle || inq.building?.title || 'General inquiry'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[inq.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {inq.status}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{timeAgo(inq.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Buildings */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                Recent Buildings
              </h3>
              <Link href="/admin/properties" className="text-xs text-slate-500 hover:text-slate-900 font-medium">View all</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {(recent.buildings ?? []).length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No buildings yet</p>
              ) : (
                (recent.buildings ?? []).map((b) => (
                  <div key={b.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{b.title}</p>
                        <p className="text-xs text-slate-500">{b.city ?? 'Lebanon'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[b.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {b.status?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400">{timeAgo(b.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Users */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                New Users (7 days)
              </h3>
              <Link href="/admin/users" className="text-xs text-slate-500 hover:text-slate-900 font-medium">View all</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {(recent.users ?? []).length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No new users this week</p>
              ) : (
                (recent.users ?? []).map((u) => (
                  <div key={u.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white">{u.email.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                          </p>
                          {u.firstName && <p className="text-xs text-slate-500 truncate">{u.email}</p>}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(u.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Contact Messages */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Inbox className="h-4 w-4 text-violet-600" />
                Recent Messages
              </h3>
              <Link href="/admin/contacts" className="text-xs text-slate-500 hover:text-slate-900 font-medium">View all</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {(recent.contacts ?? []).length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">No messages yet</p>
              ) : (
                (recent.contacts ?? []).map((msg) => (
                  <div key={msg.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{msg.name}</p>
                        <p className="text-xs text-slate-500 truncate">{msg.subject || msg.email}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(msg.createdAt)}</span>
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
