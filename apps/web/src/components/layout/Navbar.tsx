'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import { Button } from '@/components/ui/button'
import {
  Menu,
  X,
  Building2,
  Info,
  Phone,
  ChevronDown,
  LogOut,
  Settings,
  Bell,
  Sparkles,
  Shield,
  LayoutDashboard
} from 'lucide-react'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
    setIsProfileDropdownOpen(false)
  }, [pathname])

  const isActive = (path: string) => pathname === path

  const profileLinks = [
    { href: '/portal/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    { href: '/portal/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ]

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled
        ? 'bg-white/95 backdrop-blur-lg shadow-lg'
        : 'bg-white shadow-sm'
    } border-b border-stone-200`}>
      <div className="pg-container max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center h-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 group flex-shrink-0">
            <Image
              src="/logo.png"
              alt="PropGroup"
              width={40}
              height={40}
              className="transform group-hover:scale-110 transition-all duration-300"
              priority
            />
            <div>
              <span className="font-bold text-xl text-stone-900 block leading-tight">
                PropGroup
              </span>
              <span className="text-xs text-stone-500">Georgia Real Estate</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 flex-1 overflow-x-auto overflow-y-hidden px-4 mx-4 scrollbar-hide" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
            <NavLink href="/properties" icon={<Building2 className="w-4 h-4" />} isActive={isActive('/properties')}>
              Properties
            </NavLink>

            <NavLink href="/ai-search" icon={<Sparkles className="w-4 h-4" />} isActive={isActive('/ai-search')}>
              <span className="flex items-center gap-1.5">
                AI Search
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[#C97B4B] text-white rounded-full">
                  NEW
                </span>
              </span>
            </NavLink>

            <NavLink href="/about" icon={<Info className="w-4 h-4" />} isActive={isActive('/about')}>
              About
            </NavLink>
            <NavLink href="/contact" icon={<Phone className="w-4 h-4" />} isActive={isActive('/contact')}>
              Contact
            </NavLink>
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden lg:flex items-center space-x-2 flex-shrink-0">
            {loading ? (
              <div className="flex items-center space-x-2" data-testid="loading-skeleton">
                <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
                <div className="w-16 h-4 rounded bg-stone-200 animate-pulse" />
              </div>
            ) : user ? (
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Notification Bell */}
                <Link href="/portal/notifications">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative text-stone-600 hover:text-stone-900"
                  >
                    <Bell className="w-5 h-5" />
                  </Button>
                </Link>

                {/* User Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    onBlur={() => setTimeout(() => setIsProfileDropdownOpen(false), 200)}
                    aria-expanded={isProfileDropdownOpen}
                    aria-haspopup="true"
                    className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 rounded-full hover:shadow-md transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#1B4965] flex items-center justify-center text-white text-sm font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-stone-700 font-medium">
                      {user.email?.split('@')[0]}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-stone-500 transition-transform ${
                      isProfileDropdownOpen ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {isProfileDropdownOpen && (
                    <div role="menu" className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-stone-100 py-2 animate-in fade-in slide-in-from-top-2">
                      <div className="px-4 py-3 border-b border-stone-100">
                        <p className="text-sm font-medium text-stone-900">
                          {user.email}
                        </p>
                        <p className="text-xs text-stone-500 mt-1">
                          My Account
                        </p>
                      </div>
                      {profileLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-stone-700 hover:bg-stone-50 transition-colors"
                        >
                          {link.icon}
                          <span className="font-medium">{link.label}</span>
                        </Link>
                      ))}
                      <div className="border-t border-stone-100 mt-2 pt-2">
                        <button
                          onClick={signOut}
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="font-medium">Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Portal Button */}
                {!pathname.startsWith('/portal') && !pathname.startsWith('/admin') && (
                  <Link href="/portal/dashboard">
                    <Button size="sm" variant="ghost" className="text-stone-600 hover:text-[#1B4965] hover:bg-[#E8F1F5]">
                      <LayoutDashboard className="w-4 h-4 mr-1.5" />
                      Portal
                    </Button>
                  </Link>
                )}

                {/* Admin Button for Admin/Super Admin users */}
                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && !pathname.startsWith('/admin') && (
                  <Link href="/admin">
                    <Button size="sm" variant="outline" className="border-[#1B4965] text-[#1B4965] hover:bg-[#E8F1F5]">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Button>
                  </Link>
                )}

              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <AuthModal>
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </AuthModal>
                <AuthModal defaultMode="signup">
                  <Button size="sm" className="bg-[#C97B4B] hover:bg-[#B86A3A] text-white shadow-md hover:shadow-lg transition-all">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Get Started
                  </Button>
                </AuthModal>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`lg:hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="py-4 space-y-1 border-t border-stone-200">
            <MobileNavLink
              href="/properties"
              icon={<Building2 className="w-4 h-4" />}
              isActive={isActive('/properties')}
              onClick={() => setIsMenuOpen(false)}
            >
              Properties
            </MobileNavLink>

            <MobileNavLink
              href="/about"
              icon={<Info className="w-4 h-4" />}
              isActive={isActive('/about')}
              onClick={() => setIsMenuOpen(false)}
            >
              About
            </MobileNavLink>
            <MobileNavLink
              href="/contact"
              icon={<Phone className="w-4 h-4" />}
              isActive={isActive('/contact')}
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </MobileNavLink>

            {/* Mobile Auth Section */}
            <div className="pt-4 px-4 border-t border-stone-200">
              {loading ? (
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
                  <div className="w-24 h-4 rounded bg-stone-200 animate-pulse" />
                </div>
              ) : user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-3 py-2 bg-stone-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-[#1B4965] flex items-center justify-center text-white text-sm font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-stone-500">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  {!pathname.startsWith('/portal') && !pathname.startsWith('/admin') && (
                    <Link href="/portal/dashboard" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full border-[#1B4965] text-[#1B4965]">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        My Portal
                      </Button>
                    </Link>
                  )}
                  <Button
                    onClick={signOut}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <AuthModal>
                  <Button size="sm" className="w-full bg-[#C97B4B] hover:bg-[#B86A3A] text-white">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Sign In / Get Started
                  </Button>
                </AuthModal>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

// Desktop Navigation Link Component
function NavLink({ href, icon, children, isActive }: any) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
        isActive
          ? 'bg-[#E8F1F5] text-[#1B4965]'
          : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}

// Mobile Navigation Link Component
function MobileNavLink({ href, icon, children, isActive, onClick }: any) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors ${
        isActive
          ? 'bg-[#E8F1F5] text-[#1B4965] border-l-4 border-[#1B4965]'
          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900 border-l-4 border-transparent'
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}
