'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'

export function ConditionalNavbar() {
  const pathname = usePathname()

  // Don't show navbar on admin, auth, or portal routes
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/auth') || pathname?.startsWith('/portal')) {
    return null
  }

  return <Navbar />
}
