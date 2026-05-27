'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  Building2,
  Users,
  FileText,
  Settings,
  BarChart3,
  LogOut,
  Bot,
  MessageSquare,
  ArrowLeft,
  Inbox,
  MapPin,
  Wrench,
  Zap,
  ListFilter,
  DollarSign,
  HardHat,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function Sidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Buildings', href: '/admin/buildings', icon: Building2 },
    { name: 'Listings', href: '/admin/listings', icon: ListFilter },
    { name: 'Location Guides', href: '/admin/location-guides', icon: MapPin },
    { name: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
    { name: 'Contact Messages', href: '/admin/contacts', icon: Inbox },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
    { name: 'Documents', href: '/admin/documents', icon: FileText },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  const pmNavigation = [
    { name: 'PM Dashboard', href: '/admin/management', icon: Home },
    { name: 'Tenancies', href: '/admin/management/tenancies', icon: DollarSign },
    { name: 'Maintenance', href: '/admin/management/tickets', icon: Wrench },
    { name: 'Utilities', href: '/admin/management/utilities', icon: Zap },
    { name: 'Service Charges', href: '/admin/management/service-charges', icon: HardHat },
    { name: 'Vendors', href: '/admin/management/vendors', icon: HardHat },
  ]

  const isPMSection = pathname.startsWith('/admin/management')

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-zinc-900 px-6 pb-4 border-r border-zinc-800">
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="PropGroup"
              width={40}
              height={40}
              className="brightness-0 invert"
            />
            <div>
              <span className="font-bold text-lg text-white block leading-tight">
                Admin Panel
              </span>
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
          <ul role="list" className="flex flex-1 flex-col gap-y-5">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/admin' && pathname.startsWith(item.href))
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 transition-all ${
                          isActive
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? 'text-white' : 'text-zinc-500 group-hover:text-white'
                          }`}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>

            {/* Property Management section */}
            <li>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2 flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Property Management
              </div>
              <ul role="list" className="-mx-2 space-y-1">
                {pmNavigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/admin/management' && pathname.startsWith(item.href))
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 transition-all ${
                          isActive
                            ? 'bg-zinc-700 text-white'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? 'text-white' : 'text-zinc-500 group-hover:text-white'
                          }`}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
            <li className="mt-auto space-y-2">
              <Link
                href="/"
                target="_blank"
                className="group flex w-full gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all"
              >
                <ArrowLeft
                  className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-white"
                  aria-hidden="true"
                />
                Back to Website
              </Link>
              <button
                onClick={signOut}
                className="group flex w-full gap-x-3 rounded-lg p-2.5 text-sm font-medium leading-6 text-zinc-400 hover:bg-red-900/30 hover:text-red-400 transition-all"
              >
                <LogOut
                  className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-red-400"
                  aria-hidden="true"
                />
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
