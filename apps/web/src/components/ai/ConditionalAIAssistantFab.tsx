'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

// The FAB is interactive-only (opens a chat on click). Defer the whole
// component tree until the user reaches a non-admin route — keeps lucide
// icons, chat markup, and prompt-state off the initial bundle.
const AIAssistantFab = dynamic(
  () => import('./AIAssistantFab').then(m => ({ default: m.AIAssistantFab })),
  { ssr: false, loading: () => null },
)

export function ConditionalAIAssistantFab() {
  const pathname = usePathname()

  // Don't show AI assistant on admin routes
  if (pathname?.startsWith('/admin')) {
    return null
  }

  return <AIAssistantFab />
}
