'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import { Button } from '@/components/ui/button'
import {
  Menu,
  X,
  Home,
  Building2,
  Info,
  Phone,
  BarChart3,
  Calculator,
  DollarSign,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Heart,
  FileText,
  Bell,
  Globe,
  Sparkles,
  TrendingUp,
  Shield
} from 'lucide-react'

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isPortalDropdownOpen, setIsPortalDropdownOpen] = useState(false)
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
    setIsPortalDropdownOpen(false)
    setIsProfileDropdownOpen(false)
  }, [pathname])

  const isActive = (path: string) => pathname === path

  const portalLinks = [
    { href: '/portal/dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" />, color: 'text-blue-600' },
    { href: '/portal/market-analysis', label: 'Market Analysis', icon: <BarChart3 className="w-4 h-4" />, color: 'text-green-600' },
    { href: '/portal/calculator', label: 'ROI Calculator', icon: <Calculator className="w-4 h-4" />, color: 'text-purple-600' },
    { href: '/portal/portfolio', label: 'My Portfolio', icon: <DollarSign className="w-4 h-4" />, color: 'text-orange-600' },
    { href: '/portal/favorites', label: 'Saved Properties', icon: <Heart className="w-4 h-4" />, color: 'text-red-600' },
    { href: '/portal/documents', label: 'Documents', icon: <FileText className="w-4 h-4" />, color: 'text-indigo-600' },
  ]

  const profileLinks = [
    { href: '/portal/settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    { href: '/portal/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ]

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-lg' 
        : 'bg-white dark:bg-gray-900 shadow-sm'
    } border-b border-gray-200 dark:border-gray-800`}>
      <div className="pg-container max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center h-16 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-all duration-300 shadow-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            </div>
            <div>
              <span className="font-bold text-xl text-gray-900 dark:text-white block leading-tight">
                PropGroup
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Smart Investments</span>
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
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full">
                  NEW
                </span>
              </span>
            </NavLink>

            {/* Portal Dropdown for logged in users */}
            {user && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setIsPortalDropdownOpen(!isPortalDropdownOpen)}
                  onBlur={() => setTimeout(() => setIsPortalDropdownOpen(false), 200)}
                  aria-expanded={isPortalDropdownOpen}
                  aria-haspopup="true"
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-1 whitespace-nowrap ${
                    pathname.startsWith('/portal')
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 text-blue-700 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Portal
                  <ChevronDown className={`w-3 h-3 transition-transform ${
                    isPortalDropdownOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {isPortalDropdownOpen && (
                  <div role="menu" className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 animate-in fade-in slide-in-from-top-2">
                    {portalLinks.map((link, index) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        className="flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-white dark:group-hover:bg-gray-600 transition-colors ${link.color}`}>
                          {link.icon}
                        </div>
                        <div>
                          <span className="font-medium block">{link.label}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {link.href.includes('dashboard') && 'Overview & stats'}
                            {link.href.includes('market') && 'Live market data'}
                            {link.href.includes('calculator') && 'Calculate returns'}
                            {link.href.includes('portfolio') && 'Your investments'}
                            {link.href.includes('favorites') && 'Saved for later'}
                            {link.href.includes('documents') && 'Contracts & docs'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            <NavLink href="/about" icon={<Info className="w-4 h-4" />} isActive={isActive('/about')}>
              About
            </NavLink>
            <NavLink href="/contact" icon={<Phone className="w-4 h-4" />} isActive={isActive('/contact')}>
              Contact
            </NavLink>
          </div>

          {/* Desktop Auth Section */}
          <div className="hidden lg:flex items-center space-x-2 flex-shrink-0">
            {user ? (
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Notification Bell */}
                <Link href="/portal/notifications">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-full hover:shadow-md transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {user.email?.split('@')[0]}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${
                      isProfileDropdownOpen ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {isProfileDropdownOpen && (
                    <div role="menu" className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 animate-in fade-in slide-in-from-top-2">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          My Account
                        </p>
                      </div>
                      {profileLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          {link.icon}
                          <span className="font-medium">{link.label}</span>
                        </Link>
                      ))}
                      <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                        <button
                          onClick={signOut}
                          role="menuitem"
                          className="flex items-center gap-3 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="font-medium">Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Admin Button for Admin/Super Admin users */}
                {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && !pathname.startsWith('/admin') && (
                  <Link href="/admin">
                    <Button size="sm" variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Panel
                    </Button>
                  </Link>
                )}

                {!pathname.startsWith('/portal') && !pathname.startsWith('/admin') && (
                  <Link href="/portal/dashboard">
                    <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Go to Portal
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
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all">
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
          <div className="py-4 space-y-1 border-t border-gray-200 dark:border-gray-700">
            <MobileNavLink 
              href="/properties" 
              icon={<Building2 className="w-4 h-4" />}
              isActive={isActive('/properties')}
              onClick={() => setIsMenuOpen(false)}
            >
              Properties
            </MobileNavLink>
            
            {/* Mobile Portal Links */}
            {user && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Portal
                </div>
                {portalLinks.map((link) => (
                  <MobileNavLink
                    key={link.href}
                    href={link.href}
                    icon={link.icon}
                    isActive={isActive(link.href)}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {link.label}
                  </MobileNavLink>
                ))}
                <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
              </>
            )}
            
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
            <div className="pt-4 px-4 border-t border-gray-200 dark:border-gray-700">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
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
                  <Button size="sm" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
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
          ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 text-blue-700 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
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
          ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white border-l-4 border-transparent'
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}
