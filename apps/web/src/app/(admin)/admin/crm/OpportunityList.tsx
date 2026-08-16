'use client'

import { useState } from 'react'
import {
  Building2, CalendarPlus, Check, X, ThumbsUp, ThumbsDown, Loader2, Trash2, Send, Handshake, Pencil,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import {
  type Opportunity, type OpportunityStage, type RejectionReason,
  OPPORTUNITY_META, REJECTION_LABELS,
} from './types'

const REJECTION_ORDER: RejectionReason[] = [
  'PRICE_TOO_HIGH', 'TOO_SMALL', 'LOCATION', 'CONDITION', 'LAYOUT',
  'FLOOR_LEVEL', 'NO_PARKING', 'NOISE', 'NO_VIEW', 'BUILDING_QUALITY',
  'TOO_BIG', 'NO_ELEVATOR', 'CHANGED_MIND', 'BOUGHT_ELSEWHERE', 'UNAVAILABLE', 'OTHER',
]

/**
 * What we've put in front of this client and how each one went.
 *
 * The important behaviour: a rejection closes that property only — it records
 * *why*, keeps it out of future suggestions, and drops the client back to
 * searching rather than ending the relationship.
 */
export function OpportunityList({
  opportunities,
  labelFor,
  onChanged,
}: {
  opportunities: Opportunity[]
  /** Resolves an opportunity to a display title (listing headline or client name). */
  labelFor: (o: Opportunity) => { title: string; subtitle?: string; isClient: boolean }
  onChanged: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [reason, setReason] = useState<RejectionReason>('PRICE_TOO_HIGH')
  const [feedback, setFeedback] = useState('')
  const [viewingAt, setViewingAt] = useState('')
  // Closing a deal is when the money is known, so that's when we ask.
  const [closingId, setClosingId] = useState<string | null>(null)
  const [soldPrice, setSoldPrice] = useState('')
  const [commission, setCommission] = useState('')

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    try {
      const res = await fetch(`${apiUrl}/api/crm/opportunities/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setRejectingId(null); setBookingId(null); setClosingId(null)
        setFeedback(''); setViewingAt(''); setSoldPrice(''); setCommission('')
        onChanged()
      }
    } finally { setBusyId(null) }
  }

  async function remove(id: string) {
    if (!confirm('Remove this from the shortlist?')) return
    setBusyId(id)
    try {
      const res = await fetch(`${apiUrl}/api/crm/opportunities/${id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) onChanged()
    } finally { setBusyId(null) }
  }

  if (opportunities.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Nothing shortlisted yet — add a match below to start tracking what this client has seen.
      </p>
    )
  }

  // Live deals first, ruled-out ones last.
  const sorted = [...opportunities].sort((a, b) => {
    const rank = (s: OpportunityStage) => (s === 'REJECTED' ? 2 : s === 'WON' ? 1 : 0)
    return rank(a.stage) - rank(b.stage)
  })

  return (
    <ul className="space-y-2">
      {sorted.map((o) => {
        const meta = OPPORTUNITY_META[o.stage]
        const { title, subtitle, isClient } = labelFor(o)
        const isRejected = o.stage === 'REJECTED'
        const busy = busyId === o.id

        return (
          <li
            key={o.id}
            className={`rounded-lg border p-2.5 ${isRejected ? 'border-slate-100 bg-slate-50/60 opacity-75' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${meta.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isClient ? <Handshake className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                  {o.subject?.ref && (
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500">{o.subject.ref}</span>
                  )}
                  <span className={`text-sm font-medium truncate ${isRejected ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {title}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                  {o.matchScore != null && (
                    <span className="text-[10px] font-bold text-slate-400">{o.matchScore}%</span>
                  )}
                </div>
                {subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>}
                {o.stage === 'WON' && (o.soldPrice || o.commissionUsd) && (
                  <p className="text-xs font-medium text-emerald-700 mt-0.5">
                    {o.soldPrice ? `Sold ${o.soldCurrency} ${o.soldPrice.toLocaleString()}` : 'Closed'}
                    {o.commissionUsd ? ` · we made $${o.commissionUsd.toLocaleString()}` : ''}
                  </p>
                )}

                {o.viewingAt && o.stage === 'VIEWING_BOOKED' && (
                  <button
                    type="button"
                    onClick={() => {
                      // Pre-fill the picker with the current slot for a quick change.
                      setViewingAt(new Date(o.viewingAt!).toISOString().slice(0, 16))
                      setBookingId(o.id)
                      setRejectingId(null)
                    }}
                    className="text-xs text-violet-700 mt-1 inline-flex items-center gap-1 hover:underline"
                    title="Change the viewing date"
                  >
                    <CalendarPlus className="h-3 w-3" />
                    Viewing {new Date(o.viewingAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    <Pencil className="h-2.5 w-2.5 opacity-60" />
                  </button>
                )}
                {isRejected && o.rejectionReason && (
                  <p className="text-xs text-red-600 mt-1">
                    Ruled out — {REJECTION_LABELS[o.rejectionReason]}
                  </p>
                )}
                {o.feedback && <p className="text-xs text-slate-500 mt-1 italic">“{o.feedback}”</p>}
              </div>

              <button
                onClick={() => remove(o.id)}
                disabled={busy}
                className="p-1 text-slate-300 hover:text-red-600 shrink-0"
                title="Remove from shortlist"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Stage actions — only for deals still in play */}
            {!isRejected && o.stage !== 'WON' && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
                {o.stage === 'SUGGESTED' && (
                  <ActionBtn onClick={() => patch(o.id, { stage: 'SHARED' })} disabled={busy} icon={<Send className="h-3 w-3" />}>
                    Sent to client
                  </ActionBtn>
                )}
                {(o.stage === 'SUGGESTED' || o.stage === 'SHARED') && (
                  <ActionBtn onClick={() => { setBookingId(o.id); setRejectingId(null) }} disabled={busy} icon={<CalendarPlus className="h-3 w-3" />}>
                    Book viewing
                  </ActionBtn>
                )}
                {o.stage === 'VIEWING_BOOKED' && (
                  <>
                    <ActionBtn onClick={() => patch(o.id, { stage: 'VIEWED' })} disabled={busy} icon={<Check className="h-3 w-3" />}>
                      Viewing done
                    </ActionBtn>
                    <ActionBtn
                      onClick={() => {
                        setViewingAt(o.viewingAt ? new Date(o.viewingAt).toISOString().slice(0, 16) : '')
                        setBookingId(o.id); setRejectingId(null)
                      }}
                      disabled={busy}
                      icon={<CalendarPlus className="h-3 w-3" />}
                    >
                      Reschedule
                    </ActionBtn>
                    <ActionBtn onClick={() => patch(o.id, { stage: 'SHARED', viewingAt: null })} disabled={busy} icon={<X className="h-3 w-3" />}>
                      Cancel viewing
                    </ActionBtn>
                  </>
                )}
                {o.stage === 'VIEWED' && (
                  <>
                    <ActionBtn onClick={() => patch(o.id, { stage: 'INTERESTED' })} disabled={busy} tone="good" icon={<ThumbsUp className="h-3 w-3" />}>
                      Liked it
                    </ActionBtn>
                    <ActionBtn onClick={() => { setRejectingId(o.id); setBookingId(null) }} disabled={busy} tone="bad" icon={<ThumbsDown className="h-3 w-3" />}>
                      Didn&apos;t like it
                    </ActionBtn>
                  </>
                )}
                {o.stage === 'INTERESTED' && (
                  <ActionBtn onClick={() => patch(o.id, { stage: 'OFFER_MADE' })} disabled={busy} icon={<Send className="h-3 w-3" />}>
                    Offer made
                  </ActionBtn>
                )}
                {o.stage === 'OFFER_MADE' && (
                  <ActionBtn
                    onClick={() => { setClosingId(o.id); setRejectingId(null); setBookingId(null) }}
                    disabled={busy} tone="good" icon={<Check className="h-3 w-3" />}
                  >
                    Deal closed
                  </ActionBtn>
                )}
                {/* Closing form appears inline once "Deal closed" is pressed */}
                {closingId === o.id && (
                  <div className="w-full mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2 space-y-2">
                    <p className="text-[11px] font-semibold text-emerald-800">What did it close at?</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] text-slate-500">Sold price</span>
                        <input
                          type="number" min="0" value={soldPrice}
                          onChange={(e) => setSoldPrice(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-slate-500">Our commission (USD)</span>
                        <input
                          type="number" min="0" value={commission}
                          onChange={(e) => setCommission(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 rounded text-sm bg-white"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setClosingId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 rounded hover:bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => patch(o.id, {
                          stage: 'WON',
                          soldPrice: soldPrice ? Number(soldPrice) : null,
                          commissionUsd: commission ? Number(commission) : null,
                        })}
                        disabled={busy}
                        className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Record the deal
                      </button>
                    </div>
                  </div>
                )}
                {o.stage !== 'VIEWED' && (
                  <ActionBtn onClick={() => { setRejectingId(o.id); setBookingId(null) }} disabled={busy} tone="bad" icon={<X className="h-3 w-3" />}>
                    Rule out
                  </ActionBtn>
                )}
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 self-center" />}
              </div>
            )}

            {/* Book a viewing */}
            {bookingId === o.id && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-slate-600">
                  {o.stage === 'VIEWING_BOOKED' ? 'New viewing time' : 'Viewing time'}
                </label>
                <input
                  type="datetime-local"
                  value={viewingAt}
                  onChange={(e) => setViewingAt(e.target.value)}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
                <button
                  onClick={() => patch(o.id, {
                    stage: 'VIEWING_BOOKED',
                    viewingAt: viewingAt ? new Date(viewingAt).toISOString() : new Date().toISOString(),
                  })}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {o.stage === 'VIEWING_BOOKED' ? 'Save new time' : 'Book'}
                </button>
                <button onClick={() => { setBookingId(null); setViewingAt('') }} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
              </div>
            )}

            {/* Record why it was ruled out */}
            {rejectingId === o.id && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs font-medium text-slate-600">Why didn&apos;t it work?</p>
                <div className="flex flex-wrap gap-1">
                  {REJECTION_ORDER.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                        reason === r ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {REJECTION_LABELS[r]}
                    </button>
                  ))}
                </div>
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What did they say? (optional)"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patch(o.id, { stage: 'REJECTED', rejectionReason: reason, feedback: feedback || null })}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Rule out &amp; keep searching
                  </button>
                  <button onClick={() => setRejectingId(null)} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ActionBtn({
  children, onClick, disabled, icon, tone,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
  icon?: React.ReactNode; tone?: 'good' | 'bad'
}) {
  const cls =
    tone === 'good' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
    : tone === 'bad' ? 'border-red-200 text-red-600 hover:bg-red-50'
    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border bg-white transition-colors disabled:opacity-50 ${cls}`}
    >
      {icon}{children}
    </button>
  )
}
