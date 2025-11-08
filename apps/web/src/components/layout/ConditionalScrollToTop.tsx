'use client'

import { usePathname } from 'next/navigation'
import { ScrollToTop } from './ScrollToTop'

export function ConditionalScrollToTop() {
  const pathname = usePathname()

  // Don't show scroll to top on admin routes
  if (pathname?.startsWith('/admin')) {
    return null
  }

  return <ScrollToTop />
}
