import { normalizeApiUrl } from '@/lib/utils/api-url'
import { Wrench, DollarSign, AlertTriangle, Home, Zap, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function fetchDashboard() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  try {
    const res = await fetch(`${apiUrl}/api/management/dashboard`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.data
  } catch {
    return null
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  EMERGENCY: 'text-red-600',
  HIGH: 'text-orange-500',
  NORMAL: 'text-blue-500',
  LOW: 'text-slate-400',
}

export default async function ManagementDashboardPage() {
  const dash = await fetchDashboard()

  const ticketsByPriority: Array<{ priority: string; _count: { id: number } }> =
    dash?.openTicketsByPriority ?? []

  const kpis = [
    {
      label: 'Overdue Rent',
      value: dash?.overdueRentCount ?? 0,
      icon: DollarSign,
      href: '/admin/management/tenancies?overdue=1',
      color: 'bg-red-50 text-red-600',
      urgent: (dash?.overdueRentCount ?? 0) > 0,
    },
    {
      label: 'Open Tickets',
      value: ticketsByPriority.reduce((sum, t) => sum + (t._count?.id ?? 0), 0),
      icon: Wrench,
      href: '/admin/management/tickets',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Vacant Units',
      value: dash?.vacantUnitsCount ?? 0,
      icon: Home,
      href: '/admin/management/tenancies',
      color: 'bg-slate-50 text-slate-600',
    },
    {
      label: 'Rented Units',
      value: dash?.rentedUnitsCount ?? 0,
      icon: TrendingUp,
      href: '/admin/management/tenancies',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Bills Pending Allocation',
      value: dash?.allocatedBillsCount ?? 0,
      icon: Zap,
      href: '/admin/management/utilities',
      color: 'bg-blue-50 text-blue-600',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Property Management</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of tenancies, maintenance, and utilities</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map(kpi => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="block bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className={`inline-flex p-2 rounded-lg mb-3 ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <p className={`text-2xl font-bold ${kpi.urgent ? 'text-red-600' : 'text-slate-900'}`}>
              {kpi.value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
          </Link>
        ))}
      </div>

      {/* Ticket breakdown */}
      {ticketsByPriority.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-slate-500" />
            Open Tickets by Priority
          </h2>
          <div className="space-y-3">
            {['EMERGENCY', 'HIGH', 'NORMAL', 'LOW'].map(priority => {
              const entry = ticketsByPriority.find(t => t.priority === priority)
              const count = entry?._count?.id ?? 0
              return (
                <Link
                  key={priority}
                  href={`/admin/management/tickets?priority=${priority}`}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {priority === 'EMERGENCY' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    <span className={`text-sm font-medium ${PRIORITY_COLORS[priority]}`}>
                      {priority}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{count}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tenancies', desc: 'Active leases & rent tracking', href: '/admin/management/tenancies', icon: DollarSign },
          { label: 'Maintenance', desc: 'Tickets & repair requests', href: '/admin/management/tickets', icon: Wrench },
          { label: 'Utilities', desc: 'Bills, meters & allocations', href: '/admin/management/utilities', icon: Zap },
          { label: 'Service Charges', desc: 'Recurring HOA fees', href: '/admin/management/service-charges', icon: TrendingUp },
          { label: 'Vendors', desc: 'Plumbers, electricians & more', href: '/admin/management/vendors', icon: Wrench },
        ].map(item => (
          <Link
            key={item.label}
            href={item.href}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
          >
            <item.icon className="h-5 w-5 text-slate-400 mb-3" />
            <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
