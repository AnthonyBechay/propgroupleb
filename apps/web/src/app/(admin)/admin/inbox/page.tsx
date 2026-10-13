'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { InboxView } from '../crm/InboxView'

/**
 * Conversations, on a page of their own.
 *
 * The inbox used to be a tab inside the CRM, under that page's client filters
 * and market switches — none of which apply to a chat — and boxed into
 * whatever height was left. Talking to clients is most of the day, so it gets
 * the whole screen and nothing on it that is not about the conversation.
 */
export default function InboxPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  // Arriving from a client's card or a deal: open that client's thread.
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null)
  useEffect(() => {
    setFocusLeadId(new URLSearchParams(window.location.search).get('lead'))
  }, [])

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations by name, number or message"
          className="w-full min-h-11 pl-9 pr-9 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 min-h-9 min-w-9 inline-flex items-center justify-center text-slate-500">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <InboxView
        fill
        search={search}
        focusLeadId={focusLeadId}
        onOpenLead={(leadId) => router.push(`/admin/crm?lead=${leadId}`)}
        onChanged={() => {}}
      />
    </div>
  )
}
