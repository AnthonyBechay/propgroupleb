'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Bell, Search, Menu, X, Home, Building2, Users, Shield, FileText, Settings, BarChart3, LogOut, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminHeader() {
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Properties', href: '/admin/properties', icon: Building2 },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
    { name: 'Documents', href: '/admin/documents', icon: FileText },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b-2 border-slate-200 bg-white px-4 shadow-md sm:gap-x-6 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden -ml-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>

        <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
          <div className="relative flex flex-1 items-center max-w-md">
            <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-slate-400 pl-3" />
            <Input
              className="block h-10 w-full border-2 border-slate-200 rounded-xl py-0 pl-10 pr-4 text-gray-900 placeholder:text-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm bg-slate-50"
              placeholder="Search..."
              type="search"
              name="search"
            />
          </div>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <Button
              variant="ghost"
              size="sm"
              className="relative hover:bg-slate-100 rounded-xl"
            >
              <Bell className="h-5 w-5 text-slate-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full"></span>
              <span className="sr-only">View notifications</span>
            </Button>

            {/* Separator */}
            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" aria-hidden="true" />

            {/* Profile dropdown */}
            <div className="flex items-center gap-x-3 lg:gap-x-4">
              <div className="hidden lg:block lg:max-w-xs lg:truncate lg:leading-6">
                <p className="text-sm font-bold text-gray-900">
                  {user?.email}
                </p>
                <p className="text-xs text-slate-600 font-medium">Administrator</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-slate-700">
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

            <nav className="flex-1 px-4 py-4 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href === '/admin/users' && pathname.startsWith('/admin/users'))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
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
                    />
                    {item.name}
                  </Link>
                )
              })}

              <button
                onClick={() => {
                  signOut()
                  setMobileMenuOpen(false)
                }}
                className="group flex w-full gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all border-2 border-slate-700 hover:border-red-500/50 mt-4"
              >
                <LogOut className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-red-400" />
                Sign out
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
