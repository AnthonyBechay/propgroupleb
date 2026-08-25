'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/admin/Sidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Loader2 } from 'lucide-react'
import { canAccessAdmin, canAccessAdminPath, adminHomeFor } from '@/lib/permissions'

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuth()
  // Lives here rather than in the header so the drawer and the desktop sidebar
  // can be the same component rendered twice.
  const [navOpen, setNavOpen] = useState(false)

  // A tap on a nav link navigates; the drawer must not stay over the page.
  useEffect(() => { setNavOpen(false) }, [pathname])

  // While the drawer is over the page, the page behind it must not scroll —
  // otherwise a swipe on the overlay scrolls the content you can't see.
  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [navOpen])

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/auth/login?next=/admin')
      return
    }
    if (!user.isActive || user.bannedAt) {
      router.push('/auth/banned')
      return
    }
    if (!canAccessAdmin(user.role)) {
      router.push('/unauthorized')
      return
    }
    // A CRM_MANAGER belongs in the back office, but only in the CRM. Send them
    // to the one place they can work rather than to /unauthorized, which reads
    // as "you don't belong here" for a role that does.
    if (!canAccessAdminPath(user.role, pathname)) {
      router.replace(adminHomeFor(user.role))
    }
  }, [user, loading, router, pathname])

  const allowed = !!user && user.isActive && !user.bannedAt && canAccessAdminPath(user.role, pathname)

  if (loading || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-800 mx-auto mb-4" />
          <p className="text-slate-500">{loading ? 'Loading…' : 'Redirecting…'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-64">
        <AdminHeader onOpenNav={() => setNavOpen(true)} />
        <main className="py-4 sm:py-5">
          {/* `min-w-0` stops a wide table or the CRM board from forcing the
              whole shell wider than the viewport on a phone. */}
          <div className="mx-auto min-w-0 max-w-[1600px] px-3 sm:px-4 lg:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
