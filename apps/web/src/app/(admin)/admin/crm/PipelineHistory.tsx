'use client'

import { useEffect, useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { STATUS_META, stageLabel, type LeadStatus, type OpportunityStage } from './types'

interface Entry {
  id: string
  at: string
  action: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any> | null
  by: string
}

interface History {
  createdAt: string
  source: string
  fromAd: boolean
  adLabel: string | null
  entries: Entry[]
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * One line per thing that happened, in words. The audit log already recorded
 * every move — it just said "UPDATE_OPPORTUNITY", and nobody could see it.
 * Returns null for entries that are noise here (a field edit with no status).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describe(e: Entry, market?: string | null): string | null {
  const d = e.details ?? {}
  const stage = (s?: string) => (s ? stageLabel(s as OpportunityStage, market) : '')
  const what = d.title ? ` ${d.title}` : ''
  switch (e.action) {
    case 'CREATE_OPPORTUNITY':
      return d.stage && !['SUGGESTED'].includes(d.stage)
        ? `Started a deal on${what || ' a property'} at ${stage(d.stage)}${d.viewingAt ? ` (${when(d.viewingAt)})` : ''}`
        : `Shortlisted${what || ' a property'}`
    case 'UPDATE_OPPORTUNITY':
      if (!d.stage || d.stage === d.from) return d.viewingAt ? `Rescheduled${what} to ${when(d.viewingAt)}` : null
      if (d.stage === 'REJECTED') return `Not this property:${what || ' a property'}`
      return `Moved${what || ' a deal'}${d.from ? ` from ${stage(d.from)}` : ''} to ${stage(d.stage)}${d.viewingAt ? ` (${when(d.viewingAt)})` : ''}`
    case 'CLOSE_OPPORTUNITY':
      return `Closed a sale${what}`
    case 'DELETE_OPPORTUNITY':
      return `Deleted the deal${what}`
    case 'PIPELINE_ACTION':
      if (d.action === 'noise') return 'Marked as noise — never replied'
      if (d.action === 'not_interested') return 'Marked as not interested'
      if (d.action === 'ping_later') return `Snoozed — ping in ${d.days ?? 7} days`
      return null
    case 'UPDATE_LEAD':
      if (d.status) return `Status set to ${STATUS_META[d.status as LeadStatus]?.label ?? d.status}`
      if (d.nextContactAt !== undefined) return d.nextContactAt ? `Follow-up planned for ${when(d.nextContactAt)}` : 'Follow-up cleared'
      return null
    case 'CREATE_LEAD':
    case 'CREATE_LEAD_FROM_INQUIRY':
      return 'Added as a client'
    case 'ACCEPT_CHAT_SUGGESTION':
      return 'Accepted what the assistant noted from the chat'
    case 'LOG_LEAD_CONTACT':
      return `Logged a ${String(d.channel ?? 'contact').toLowerCase()}`
    case 'ADD_LEAD_NOTE':
      return 'Added a note'
    case 'INBOX_REPLY':
      return 'Replied from the inbox'
    case 'INBOX_SEND_LISTING':
      return 'Sent a property from the inbox'
    case 'INBOX_FOLLOW_UP':
      return 'Sent the follow-up message'
    case 'INBOX_AI_REPLY':
      return 'Asked the assistant to reply'
    case 'INBOX_ASSISTANT_MODE':
      return `Assistant set to ${d.mode === 'off' ? 'off' : d.mode === 'always' ? 'always on' : 'normal'}`
    case 'INBOX_LINK_CLIENT':
      return 'Linked the chat to this client'
    default:
      return null
  }
}

/** The client's path through the pipeline: who moved them, from where, and when. */
export function PipelineHistory({ leadId, market, refreshKey }: { leadId: string; market?: string | null; refreshKey?: unknown }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [history, setHistory] = useState<History | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${apiUrl}/api/crm/${leadId}/history`, { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json) => { if (!cancelled) setHistory(json.data) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [apiUrl, leadId, refreshKey])

  const lines = (history?.entries ?? [])
    .map((e) => ({ ...e, text: describe(e, market) }))
    .filter((e): e is Entry & { text: string } => Boolean(e.text))

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" /> Pipeline history
      </p>
      {failed ? (
        <p className="text-sm text-slate-500">The history could not be loaded.</p>
      ) : !history ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <ol className="space-y-2.5">
          {lines.map((e) => (
            <li key={e.id} className="border-l-2 border-slate-200 pl-3">
              <p className="text-sm text-slate-800">{e.text}</p>
              <p className="text-[11px] text-slate-500">{when(e.at)} · {e.by}</p>
            </li>
          ))}
          <li className="border-l-2 border-slate-200 pl-3">
            <p className="text-sm text-slate-800">
              Came in{history.fromAd || history.source === 'FACEBOOK_AD' ? ' from an ad' : ` via ${history.source.replace(/_/g, ' ').toLowerCase()}`}
              {history.adLabel ? `: ${history.adLabel}` : ''}
            </p>
            <p className="text-[11px] text-slate-500">{when(history.createdAt)}</p>
          </li>
        </ol>
      )}
    </section>
  )
}
