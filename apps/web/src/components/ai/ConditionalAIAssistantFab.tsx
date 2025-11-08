'use client'

import { usePathname } from 'next/navigation'
import { AIAssistantFab } from './AIAssistantFab'

export function ConditionalAIAssistantFab() {
  const pathname = usePathname()

  // Don't show AI assistant on admin routes
  if (pathname?.startsWith('/admin')) {
    return null
  }

  return <AIAssistantFab />
}
