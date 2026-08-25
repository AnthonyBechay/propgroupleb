'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Menu } from 'lucide-react'
import { ROLE_LABELS, type Role } from '@/lib/permissions'

/**
 * The back-office top bar.
 *
 * It used to carry a second, hand-maintained copy of the whole navigation for
 * mobile — different colours, different links, and one page the desktop rail
 * had already dropped. The drawer now renders the real `Sidebar`, so this is
 * just the menu button and who you are.
 */
export function AdminHeader({ onOpenNav }: { onOpenNav: () => void }) {
  const { user } = useAuth()
  const role = (user?.role ?? 'USER') as Role

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-3 border-b border-slate-200 bg-white px-3 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="lg:hidden -ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-x-3">
        {/* The email is the useful half and it is the half that doesn't fit on a
            phone, so it truncates rather than disappearing at a breakpoint. */}
        <div className="min-w-0 text-right leading-tight">
          <p className="truncate text-sm font-semibold text-slate-900">{user?.email}</p>
          <p className="text-xs font-medium text-slate-500">{ROLE_LABELS[role] ?? role}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900">
          <span className="text-sm font-semibold text-white">
            {user?.email?.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}
