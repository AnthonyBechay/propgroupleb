'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'

export function ConditionalNavbar() {
  const pathname = usePathname()

  // Don't show navbar on admin or auth routes
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth')) {
    return null
  }

  return <Navbar />
}
