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
  MessageSquare,
  ExternalLink,
  Inbox,
  MapPin,
  ListFilter,
  ClipboardList,
  UserSearch,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessAdminPath, isSuperAdmin, ROLE_LABELS, type Role } from '@/lib/permissions'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  /** Matched in addition to `href` so a detail route keeps its parent lit. */
  match?: string[]
}

interface NavGroup {
  id: string
  label: string
  items: NavItem[]
}

/**
 * Sections, not accordions.
 *
 * These used to be collapsible: each group remembered its open state in
 * localStorage, and the group containing the current route force-opened itself
 * on every navigation. So the nav re-laid itself out as you used it — going to
 * Settings expanded System and pushed nothing, but coming back to Properties
 * expanded Inventory and shoved System five rows down. Every link was at a
 * different height on every page, which is the "sliding menu": you learn where
 * Listings is, and next time it isn't there.
 *
 * Collapsing was solving a problem this list doesn't have. Eleven links fit.
 * They are now always visible, always in the same place, and the headers are
 * plain labels with nothing to click.
 */
const GROUPS: NavGroup[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { name: 'Properties', href: '/admin/buildings', icon: Building2 },
      { name: 'Listings', href: '/admin/listings', icon: ListFilter },
      { name: 'Owner submissions', href: '/admin/submissions', icon: ClipboardList },
      { name: 'Location guides', href: '/admin/location-guides', icon: MapPin },
      { name: 'Documents', href: '/admin/documents', icon: FileText },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    items: [
      { name: 'CRM', href: '/admin/crm', icon: UserSearch },
      { name: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
      { name: 'Contact messages', href: '/admin/contacts', icon: Inbox },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Users', href: '/admin/users', icon: Users },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
]

/** Every nav destination, flattened — the header's breadcrumb reads this too. */
export const ADMIN_NAV_ITEMS = [
  { name: 'Dashboard', href: '/admin', icon: Home },
  ...GROUPS.flatMap((g) => g.items),
]

/**
 * The back-office nav — one component, two presentations.
 *
 * Desktop gets a fixed rail; below `lg` the same markup slides in as a drawer.
 * They used to be two separate lists in two files with two colour schemes and
 * two sets of links, which is why the mobile one still offered a page the
 * desktop one had dropped.
 */
export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  return (
    <>
      {/* Desktop rail */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <SidebarNav />
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          className={cn(
            'absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] transition-transform duration-200 ease-out',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <SidebarNav onNavigate={onClose} onClose={onClose} />
        </div>
      </div>
    </>
  )
}

function isActive(pathname: string, item: NavItem): boolean {
  const all = [item.href, ...(item.match ?? [])]
  return all.some((h) => pathname === h || pathname.startsWith(h + '/'))
}

function SidebarNav({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname()
  const { signOut, user } = useAuth()
  const role = (user?.role ?? 'USER') as Role

  // A restricted role sees only what it can actually open. Filtering here (not
  // just guarding the route) is the difference between a nav that reflects the
  // job and one that offers five links ending in "Forbidden".
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccessAdminPath(role, i.href)) }))
    .filter((g) => g.items.length > 0)

  const showDashboard = canAccessAdminPath(role, '/admin')
  const dashboardActive = pathname === '/admin'

  // `min-h-11` keeps every row at the ~44px Apple/Android minimum touch target;
  // at the old `p-2.5` these were 36px and consistently mis-tapped on a phone.
  const linkCls = (active: boolean) =>
    cn(
      'group relative flex min-h-11 items-center gap-x-3 rounded-lg px-2.5 py-2.5 text-sm font-medium leading-6 transition-colors',
      active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white',
    )
  const iconCls = (active: boolean) =>
    cn('h-5 w-5 shrink-0', active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300')

  return (
    <div className="flex h-full grow flex-col gap-y-4 overflow-y-auto overscroll-contain border-r border-zinc-800 bg-zinc-900 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3">
        <Image src="/logo.png" alt="PropGroup" width={36} height={36} className="brightness-0 invert" />
        <div className="min-w-0 flex-1">
          <span className="block text-base font-bold leading-tight text-white">Back office</span>
          <span
            className={cn(
              'mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-white',
              isSuperAdmin(role) ? 'bg-amber-600' : role === 'ADMIN' ? 'bg-zinc-700' : 'bg-emerald-700',
            )}
          >
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-1">
          {showDashboard && (
            <li className="-mx-2">
              <Link href="/admin" onClick={onNavigate} className={linkCls(dashboardActive)}>
                <Home className={iconCls(dashboardActive)} aria-hidden="true" />
                Dashboard
                {dashboardActive && <ActiveMark />}
              </Link>
            </li>
          )}

          {groups.map((group) => (
            <li key={group.id} className="-mx-2 mt-4 first:mt-2">
              {/* A label, not a button. Nothing here opens or closes. */}
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                {group.label}
              </p>
              <ul role="list" className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={linkCls(active)}
                      >
                        <item.icon className={iconCls(active)} aria-hidden="true" />
                        <span className="truncate">{item.name}</span>
                        {active && <ActiveMark />}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}

          <li className="-mx-2 mt-auto space-y-1 pt-6">
            <Link
              href="/"
              target="_blank"
              onClick={onNavigate}
              className="group flex min-h-11 w-full items-center gap-x-3 rounded-lg px-2.5 py-2.5 text-sm font-medium leading-6 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-white"
            >
              <ExternalLink className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-zinc-300" aria-hidden="true" />
              View website
            </Link>
            <button
              onClick={signOut}
              className="group flex min-h-11 w-full items-center gap-x-3 rounded-lg px-2.5 py-2.5 text-sm font-medium leading-6 text-zinc-400 transition-colors hover:bg-red-900/30 hover:text-red-400"
            >
              <LogOut className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-red-400" aria-hidden="true" />
              Sign out
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

/** The bar down the left edge of the active row — findable at a glance. */
function ActiveMark() {
  return (
    <span
      className="absolute inset-y-1.5 -left-2 w-1 rounded-r bg-white"
      aria-hidden="true"
    />
  )
}
