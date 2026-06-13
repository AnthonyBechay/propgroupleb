'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { normalizeApiUrl } from '@/lib/utils/api-url'

// The FAB is interactive-only (opens a chat on click). Defer the whole
// component tree until the user reaches a non-admin route — keeps lucide
// icons, chat markup, and prompt-state off the initial bundle.
const AIAssistantFab = dynamic(
  () => import('./AIAssistantFab').then(m => ({ default: m.AIAssistantFab })),
  { ssr: false, loading: () => null },
)

export function ConditionalAIAssistantFab() {
  const pathname = usePathname()
  // Respect the admin "Floating AI Assistant" toggle. Default to enabled so the
  // FAB still shows before settings load or if the request fails.
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    fetch(`${apiUrl}/api/settings/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const v = (json?.data ?? json)?.aiFabEnabled
        if (typeof v === 'boolean') setEnabled(v)
      })
      .catch(() => {})
  }, [])

  // Don't show AI assistant on admin routes or when disabled in settings.
  if (pathname?.startsWith('/admin') || !enabled) {
    return null
  }

  return <AIAssistantFab />
}
