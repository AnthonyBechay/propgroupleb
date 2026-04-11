'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home,
  Building2,
  Users,
  Shield,
  FileText,
  Settings,
  BarChart3,
  LogOut,
  Bot,
  MessageSquare,
  PenTool,
  ArrowLeft,
  Inbox,
  MapPin,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function Sidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Properties', href: '/admin/properties', icon: Building2 },
    { name: 'Location Guides', href: '/admin/location-guides', icon: MapPin },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
    { name: 'Contact Messages', href: '/admin/contacts', icon: Inbox },
    { name: 'Site Content', href: '/admin/content', icon: PenTool },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
    { name: 'Documents', href: '/admin/documents', icon: FileText },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[#1B3A5C] px-6 pb-4 border-r border-[#153B52]">
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
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#C49A2E] text-white mt-0.5">
                  Super Admin
                </span>
              )}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href === '/admin/users' && pathname.startsWith('/admin/users'))
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all ${
                          isActive
                            ? 'bg-[#C49A2E] text-white'
                            : 'text-white/70 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? 'text-white' : 'text-white/50 group-hover:text-white'
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
                className="group flex w-full gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 text-white/70 hover:bg-white/10 hover:text-white transition-all border border-white/20 hover:border-white/30"
              >
                <ArrowLeft
                  className="h-5 w-5 shrink-0 text-white/50 group-hover:text-white"
                  aria-hidden="true"
                />
                Back to Website
              </Link>
              <button
                onClick={signOut}
                className="group flex w-full gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all border border-white/20 hover:border-red-400/30"
              >
                <LogOut
                  className="h-5 w-5 shrink-0 text-white/50 group-hover:text-red-300"
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
