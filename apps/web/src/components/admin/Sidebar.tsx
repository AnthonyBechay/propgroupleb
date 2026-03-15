'use client'

import Link from 'next/link'
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
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function Sidebar() {
  const pathname = usePathname()
  const { signOut, user } = useAuth()

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Properties', href: '/admin/properties', icon: Building2 },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
    { name: 'Site Content', href: '/admin/content', icon: PenTool },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
    { name: 'Documents', href: '/admin/documents', icon: FileText },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6 pb-4 border-r-2 border-slate-700">
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="text-white font-bold w-6 h-6" />
            </div>
            <div>
              <span className="font-black text-lg text-white block leading-tight">
                Admin Panel
              </span>
              {user?.role === 'SUPER_ADMIN' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md mt-0.5">
                  Super Admin
                </span>
              )}
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-2">
                {navigation.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href === '/admin/users' && pathname.startsWith('/admin/users'))
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
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
            <li className="mt-auto">
              <button
                onClick={signOut}
                className="group flex w-full gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all border-2 border-slate-700 hover:border-red-500/50"
              >
                <LogOut
                  className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-red-400"
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
