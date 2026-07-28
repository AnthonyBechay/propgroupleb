'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Home,
  Building2,
  Users,
  FileText,
  Settings,
  BarChart3,
  LogOut,
  MessageSquare,
  ArrowLeft,
  Inbox,
  MapPin,
  ListFilter,
  ClipboardList,
  ChevronDown,
  UserSearch,
  Contact,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
}

// Grouped so related work sits together and the list stays short. Each group
// collapses; the one containing the current route auto-opens.
const GROUPS: NavGroup[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Warehouse,
    items: [
      { name: 'Properties', href: '/admin/buildings', icon: Building2 },
      { name: 'Listings', href: '/admin/listings', icon: ListFilter },
      { name: 'Owner Submissions', href: '/admin/submissions', icon: ClipboardList },
      { name: 'Location Guides', href: '/admin/location-guides', icon: MapPin },
      { name: 'Documents', href: '/admin/documents', icon: FileText },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: Contact,
    items: [
      { name: 'CRM — Clients', href: '/admin/crm', icon: UserSearch },
      { name: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
      { name: 'Contact Messages', href: '/admin/contacts', icon: Inbox },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
]

const STORAGE_KEY = 'admin-nav-open-groups'

export function Sidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()

  const groupOf = (path: string) => GROUPS.find((g) => g.items.some((i) => path.startsWith(i.href)))?.id

  // Start with the active group open; restore the rest from localStorage.
  const [open, setOpen] = useState<string[]>(() => {
    const active = groupOf(pathname)
    return active ? [active] : ['inventory']
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const ids = JSON.parse(saved) as string[]
        const active = groupOf(pathname)
        setOpen(active && !ids.includes(active) ? [...ids, active] : ids)
      }
    } catch { /* ignore malformed storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the group containing the current page open when navigating.
  useEffect(() => {
    const active = groupOf(pathname)
    if (active) setOpen((prev) => (prev.includes(active) ? prev : [...prev, active]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function toggle(id: string) {
    setOpen((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const linkCls = (active: boolean) =>
    `group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 transition-all ${
      active ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
    }`
  const iconCls = (active: boolean) =>
    `h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-zinc-500 group-hover:text-white'}`

  const dashboardActive = pathname === '/admin'

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-zinc-900 px-6 pb-4 border-r border-zinc-800">
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center space-x-3">
            <Image src="/logo.png" alt="PropGroup" width={40} height={40} className="brightness-0 invert" />
            <div>
              <span className="font-bold text-lg text-white block leading-tight">Admin Panel</span>
              {user?.role === 'SUPER_ADMIN' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-600 text-white mt-0.5">
                  Super Admin
                </span>
              )}
              {user?.role === 'ADMIN' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-zinc-600 text-white mt-0.5">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-1">
            {/* Dashboard — always visible, ungrouped */}
            <li className="-mx-2">
              <Link href="/admin" className={linkCls(dashboardActive)}>
                <Home className={iconCls(dashboardActive)} aria-hidden="true" />
                Dashboard
              </Link>
            </li>

            {GROUPS.map((group) => {
              const isOpen = open.includes(group.id)
              const hasActive = group.items.some((i) => pathname.startsWith(i.href))
              return (
                <li key={group.id} className="-mx-2 mt-2">
                  <button
                    type="button"
                    onClick={() => toggle(group.id)}
                    aria-expanded={isOpen}
                    className={`w-full flex items-center gap-x-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                      hasActive ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <group.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <ul role="list" className="mt-1 space-y-1">
                      {group.items.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                          <li key={item.name}>
                            <Link href={item.href} className={linkCls(active)}>
                              <item.icon className={iconCls(active)} aria-hidden="true" />
                              {item.name}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}

            <li className="mt-auto space-y-2 -mx-2 pt-4">
              <Link
                href="/"
                target="_blank"
                className="group flex w-full gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
              >
                <ArrowLeft className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-white" aria-hidden="true" />
                Back to Website
              </Link>
              <button
                onClick={signOut}
                className="group flex w-full gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-zinc-400 hover:bg-red-900/30 hover:text-red-400 transition-all"
              >
                <LogOut className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-red-400" aria-hidden="true" />
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
