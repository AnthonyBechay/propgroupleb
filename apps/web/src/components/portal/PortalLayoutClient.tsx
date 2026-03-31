'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Home,
  Building2,
  BarChart3,
  Calculator,
  Heart,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft
} from 'lucide-react'

const portalNavItems = [
  { href: '/portal/dashboard', label: 'Dashboard', icon: Home },
  { href: '/portal/portfolio', label: 'My Properties', icon: Building2 },
  { href: '/portal/market-analysis', label: 'Market Analysis', icon: BarChart3 },
  { href: '/portal/calculator', label: 'ROI Calculator', icon: Calculator },
  { href: '/portal/favorites', label: 'Saved Properties', icon: Heart },
  { href: '/portal/documents', label: 'Documents', icon: FileText },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

export function PortalLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/auth/login?next=/portal')
        return
      }
      if (!user.isActive || user.bannedAt) {
        router.push('/auth/banned')
        return
      }
    }
  }, [user, loading, router])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1B4965] mx-auto mb-4" />
          <p className="text-stone-600">Loading your portal...</p>
        </div>
      </div>
    )
  }

  if (!user || !user.isActive || user.bannedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#1B4965] mx-auto mb-4" />
          <p className="text-stone-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-64 bg-[#1B4965] flex flex-col transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="PropGroup"
              width={36}
              height={36}
              className="brightness-0 invert"
            />
            <div>
              <span className="font-bold text-white text-lg block leading-tight">PropGroup</span>
              <span className="text-xs text-white/50">My Portal</span>
            </div>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {portalNavItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-sm font-bold">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.email?.split('@')[0]}
              </p>
              <p className="text-xs text-white/50 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-white/70 hover:text-white hover:bg-white/10 text-xs"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                Back to Site
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-stone-700" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="PropGroup" width={28} height={28} />
            <span className="font-bold text-stone-900">PropGroup</span>
          </Link>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
