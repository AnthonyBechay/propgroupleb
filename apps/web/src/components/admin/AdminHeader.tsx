'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Building2, ChevronDown, Menu, Plus, Tag, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessAdminPath, ROLE_LABELS, type Role } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { AdminSearch } from './AdminSearch'

interface QuickAction {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

/**
 * Creating something was always a two-step journey: get to the right list
 * page, then find its "Add" button. These are the three things this back office
 * exists to create, reachable from anywhere.
 */
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Property', href: '/admin/buildings/new', icon: Building2, description: 'A building, villa or land plot' },
  { label: 'Listing', href: '/admin/listings/new', icon: Tag, description: 'Put existing stock on the market' },
  { label: 'Client', href: '/admin/crm?new=1', icon: UserPlus, description: 'A buyer, seller or tenant' },
]

/**
 * The back-office top bar.
 *
 * It used to carry a second, hand-maintained copy of the whole navigation for
 * mobile — different colours, different links, and one page the desktop rail
 * had already dropped. The drawer now renders the real `Sidebar`, so this is
 * the menu button, search, what you can create, and who you are.
 */
export function AdminHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { user, signOut } = useAuth()
  const role = (user?.role ?? 'USER') as Role
  const [menu, setMenu] = useState<null | 'create' | 'user'>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(null)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenu(null) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const actions = QUICK_ACTIONS.filter((a) => canAccessAdminPath(role, a.href.split('?')[0]))
  const initial = user?.email?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:gap-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      <AdminSearch />

      <div ref={wrapRef} className="ml-auto flex items-center gap-2">
        {/* Quick create */}
        {actions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((m) => (m === 'create' ? null : 'create'))}
              aria-expanded={menu === 'create'}
              aria-haspopup="menu"
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', menu === 'create' && 'rotate-180')} />
            </button>
            {menu === 'create' && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
              >
                {actions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    role="menuitem"
                    onClick={() => setMenu(null)}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <a.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">{a.label}</span>
                      <span className="block text-xs text-slate-400">{a.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Who you are */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => (m === 'user' ? null : 'user'))}
            aria-expanded={menu === 'user'}
            aria-haspopup="menu"
            aria-label="Account menu"
            className="flex min-h-11 items-center gap-2 rounded-lg px-1 transition-colors hover:bg-slate-100"
          >
            {/* The email is the useful half and it is the half that doesn't fit
                on a phone, so it truncates rather than disappearing outright. */}
            <span className="hidden min-w-0 text-right leading-tight sm:block">
              <span className="block max-w-[14rem] truncate text-sm font-semibold text-slate-900">{user?.email}</span>
              <span className="block text-xs font-medium text-slate-500">{ROLE_LABELS[role] ?? role}</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
              {initial}
            </span>
          </button>
          {menu === 'user' && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
                <p className="truncate text-sm font-semibold text-slate-900">{user?.email}</p>
                <p className="text-xs text-slate-500">{ROLE_LABELS[role] ?? role}</p>
              </div>
              {canAccessAdminPath(role, '/admin/settings') && (
                <Link
                  href="/admin/settings"
                  role="menuitem"
                  onClick={() => setMenu(null)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Settings
                </Link>
              )}
              <Link
                href="/"
                target="_blank"
                role="menuitem"
                onClick={() => setMenu(null)}
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                View website
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenu(null); signOut() }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
