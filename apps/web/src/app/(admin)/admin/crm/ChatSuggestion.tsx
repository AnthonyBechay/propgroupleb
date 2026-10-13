'use client'

import { useState } from 'react'
import { Sparkles, Check, X, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * What the chat assistant understood a client to want, waiting for a person.
 *
 * Never applied on its own. A misheard voice note must not be able to overwrite
 * a budget somebody agreed on the phone — so it is shown, and somebody decides.
 */

export interface Suggestion {
  id: string
  summary: string
  patch: {
    intent?: string; market?: string; area?: string; minBeds?: number
    budgetMax?: number; kind?: string; isInvestor?: boolean
  }
}

const INTENT_LABEL: Record<string, string> = {
  BUYER: 'Buying', RENTER: 'Looking to rent', SELLER: 'Selling', LANDLORD: 'Renting out',
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')

export function ChatSuggestion({
  suggestion,
  hasClient,
  onResolved,
}: {
  suggestion: Suggestion
  /** False when accepting will also create the client. */
  hasClient: boolean
  onResolved: (accepted: boolean) => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [busy, setBusy] = useState<'accept' | 'dismiss' | null>(null)
  const p = suggestion.patch ?? {}

  const facts = [
    p.intent ? INTENT_LABEL[p.intent] ?? p.intent : null,
    p.market ? titleCase(p.market) : null,
    p.area ?? null,
    p.kind ? titleCase(p.kind) : null,
    typeof p.minBeds === 'number' ? (p.minBeds === 0 ? 'Studio' : `${p.minBeds}+ bedrooms`) : null,
    typeof p.budgetMax === 'number' ? `Up to $${p.budgetMax.toLocaleString('en-US')}` : null,
    p.isInvestor ? 'Investor' : null,
  ].filter(Boolean)

  const resolve = async (action: 'accept' | 'dismiss') => {
    setBusy(action)
    try {
      const res = await fetch(`${apiUrl}/api/crm/inbox/suggestions/${suggestion.id}/${action}`, {
        method: 'POST', credentials: 'include',
      })
      if (res.ok) onResolved(action === 'accept')
    } finally { setBusy(null) }
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" /> From the chat — not saved yet
      </p>
      <p className="text-sm text-slate-800 mt-1">{suggestion.summary}</p>
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {facts.map((f) => (
            <span key={f} className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-xs text-slate-700">{f}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => resolve('accept')}
          disabled={busy !== null}
          className="min-h-11 px-3 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {hasClient ? 'Update client' : 'Add as client with this'}
        </button>
        <button
          onClick={() => resolve('dismiss')}
          disabled={busy !== null}
          className="min-h-11 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Dismiss
        </button>
      </div>
    </div>
  )
}
