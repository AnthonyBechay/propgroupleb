'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/analytics'

// Paths we don't track as marketing page views (admin/portal are internal).
const IGNORED_PREFIXES = ['/admin', '/portal', '/auth', '/setup', '/unauthorized']

/**
 * Fires a `page_view` event on every client navigation (mounted once at the
 * root). Internal areas (admin/portal/auth) are excluded so the dashboard
 * reflects real visitor behaviour, not staff browsing.
 */
export function AnalyticsTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (IGNORED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return
    track('page_view', { path: pathname })
  }, [pathname])

  return null
}
