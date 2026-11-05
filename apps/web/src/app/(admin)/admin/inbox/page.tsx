'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { InboxView } from '../crm/InboxView'
import { LeadDrawer } from '../crm/LeadDrawer'
import type { Lead } from '../crm/types'

/**
 * Conversations, on a page of their own.
 *
 * The inbox used to be a tab inside the CRM, under that page's client filters
 * and market switches — none of which apply to a chat — and boxed into
 * whatever height was left. Talking to clients is most of the day, so it gets
 * the whole screen and nothing on it that is not about the conversation.
 */
export default function InboxPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const router = useRouter()
  // The client's card opens over the conversation, so the chat stays where it is.
  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const loadClient = useCallback(async (leadId: string) => {
    const res = await fetch(`${apiUrl}/api/crm/${leadId}`, { credentials: 'include', cache: 'no-store' })
    const lead = res.ok ? ((await res.json()).data ?? null) : null
    if (lead) setOpenLead(lead)
    return Boolean(lead)
  }, [apiUrl])
  // A step in the history, so the phone's Back closes the card and not the chat
  // underneath it, which would leave the card floating over the conversation list.
  const openClient = useCallback(async (leadId: string) => {
    if (await loadClient(leadId)) {
      window.history.pushState({ ...window.history.state, inboxClient: true }, '', window.location.href)
    }
  }, [loadClient])
  const closeClient = useCallback(() => {
    setOpenLead(null)
    if (window.history.state?.inboxClient) window.history.back()
  }, [])
  useEffect(() => {
    const onPop = () => { if (!window.history.state?.inboxClient) setOpenLead(null) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // Arriving from a client's card or a deal: open that client's thread.
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null)
  useEffect(() => {
    setFocusLeadId(new URLSearchParams(window.location.search).get('lead'))
  }, [])

  return (
    <div>
      <InboxView
        fill
        focusLeadId={focusLeadId}
        onOpenLead={openClient}
        onChanged={() => {}}
      />

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={closeClient}
          onChanged={() => { void loadClient(openLead.id) }}
          onShowInPipeline={(leadId) => router.push(`/admin/crm?focus=${leadId}`)}
        />
      )}
    </div>
  )
}
