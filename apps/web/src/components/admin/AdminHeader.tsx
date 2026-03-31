'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Bell, Search, Menu, X, Home, Building2, Users, Shield, FileText, Settings, BarChart3, LogOut, Bot, MessageSquare, Inbox, PenTool } from 'lucide-react'
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
    { name: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
    { name: 'Contact Messages', href: '/admin/contacts', icon: Inbox },
    { name: 'Site Content', href: '/admin/content', icon: PenTool },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'AI Settings', href: '/admin/ai-settings', icon: Bot },
    { name: 'Documents', href: '/admin/documents', icon: FileText },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ]

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-stone-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
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
            <Search className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-stone-400 pl-3" />
            <Input
              className="block h-10 w-full border border-stone-200 rounded-lg py-0 pl-10 pr-4 text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-[#1B4965] focus:border-[#1B4965] sm:text-sm bg-stone-50"
              placeholder="Search..."
              type="search"
              name="search"
            />
          </div>
          <div className="flex items-center gap-x-4 lg:gap-x-6">
            <Button
              variant="ghost"
              size="sm"
              className="relative hover:bg-stone-100 rounded-lg"
            >
              <Bell className="h-5 w-5 text-stone-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#C97B4B] rounded-full"></span>
              <span className="sr-only">View notifications</span>
            </Button>

            <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-stone-200" aria-hidden="true" />

            <div className="flex items-center gap-x-3 lg:gap-x-4">
              <div className="hidden lg:block lg:max-w-xs lg:truncate lg:leading-6">
                <p className="text-sm font-semibold text-stone-900">
                  {user?.email}
                </p>
                <p className="text-xs text-stone-500 font-medium">Administrator</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-[#1B4965] flex items-center justify-center">
                <span className="text-sm font-semibold text-white">
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
            className="fixed inset-y-0 left-0 w-72 bg-[#1B4965] shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 shrink-0 items-center px-6 border-b border-[#153B52]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#C97B4B] rounded-xl flex items-center justify-center">
                  <Shield className="text-white font-bold w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-lg text-white block leading-tight">
                    Admin Panel
                  </span>
                  {user?.role === 'SUPER_ADMIN' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#C97B4B] text-white mt-0.5">
                      Super Admin
                    </span>
                  )}
                </div>
              </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href === '/admin/users' && pathname.startsWith('/admin/users'))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all ${
                      isActive
                        ? 'bg-[#C97B4B] text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <item.icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive ? 'text-white' : 'text-white/50 group-hover:text-white'
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
                className="group flex w-full gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-all border border-white/20 hover:border-red-400/30 mt-4"
              >
                <LogOut className="h-5 w-5 shrink-0 text-white/50 group-hover:text-red-300" />
                Sign out
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
