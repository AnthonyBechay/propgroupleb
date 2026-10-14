'use client'

import { useCallback, useEffect, useState } from 'react'
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
  // The client's card opens over the conversation, so the chat stays where it is.
  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const openClient = useCallback(async (leadId: string) => {
    const res = await fetch(`${apiUrl}/api/crm/${leadId}`, { credentials: 'include', cache: 'no-store' })
    if (res.ok) setOpenLead((await res.json()).data ?? null)
  }, [apiUrl])
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
          onClose={() => setOpenLead(null)}
          onChanged={() => openClient(openLead.id)}
        />
      )}
    </div>
  )
}
