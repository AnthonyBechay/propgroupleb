'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, CalendarCheck, Building2, Handshake, Search, Check } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { countryFlag } from '@/lib/market'
import { type Lead, type Opportunity, isSupplyType, LIVE_STAGES } from './types'

/**
 * "Viewing" is never a state a client is simply in — it's a viewing *of*
 * something, on a date. A buyer may be seeing three flats this week and a
 * seller may be showing his flat to three buyers, so this books one pairing at
 * a time and the board shows them all.
 *
 * Candidates come from what's already shortlisted for this client first (the
 * normal case), with the full match list available when the viewing is for
 * something nobody shortlisted yet.
 */

interface Candidate {
  key: string
  kind: 'LISTING' | 'CLIENT'
  id: string
  title: string
  subtitle: string | null
  ref?: string | null
  score?: number | null
  /** Which market it sits in — both are offered now, so it has to be visible. */
  country?: string | null
  /** Present when this pairing already exists as an opportunity. */
  opportunityId?: string
  alreadyBooked?: boolean
}

/** Local datetime string for <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BookViewingModal({
  lead, onClose, onBooked,
}: {
  lead: Lead
  onClose: () => void
  onBooked: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [matches, setMatches] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Candidate | null>(null)
  const [when, setWhen] = useState(() => {
    // Default to tomorrow at 15:00 — viewings are rarely booked for right now.
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(15, 0, 0, 0)
    return toLocalInput(d)
  })
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wantsCounterpart = isSupplyType(lead.type)

  // Already-shortlisted items — the most likely thing being viewed.
  const shortlisted: Candidate[] = useMemo(
    () =>
      (lead.opportunities ?? [])
        .filter((o: Opportunity) => o.stage !== 'REJECTED' && o.stage !== 'WON')
        .map((o: Opportunity) => ({
          key: `op-${o.id}`,
          kind: (o.subject?.kind === 'CLIENT' ? 'CLIENT' : 'LISTING') as 'LISTING' | 'CLIENT',
          id: o.listingId ?? o.counterpartLeadId ?? '',
          title: o.subject?.title ?? 'Shortlisted item',
          subtitle: o.subject?.subtitle ?? null,
          ref: o.subject?.ref ?? null,
          score: o.matchScore,
          opportunityId: o.id,
          alreadyBooked: o.stage === 'VIEWING_BOOKED',
        }))
        .filter((c) => c.id),
    [lead.opportunities]
  )

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        // A seller is viewed *by* buyers; a buyer views properties.
        const url = wantsCounterpart
          ? `${apiUrl}/api/crm/${lead.id}/lead-matches`
          : `${apiUrl}/api/crm/${lead.id}/matches`
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
        if (!res.ok) return
        const j = await res.json()
        const rows = j.data ?? []
        if (cancelled) return
        setMatches(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows.map((r: any): Candidate => {
            if (wantsCounterpart) {
              const l = r.lead ?? r
              return {
                key: `lead-${l.id}`, kind: 'CLIENT', id: l.id, title: l.name,
                subtitle: l.askingFor ?? l.type, score: r.match?.score ?? null,
              }
            }
            const li = r.listing ?? r
            const b = li.building ?? li.unit?.building
            return {
              key: `listing-${li.id}`, kind: 'LISTING', id: li.id,
              title: li.headline || b?.title || 'Property',
              subtitle: [b?.city, b?.caza].filter(Boolean).join(', ') || null,
              ref: li.unit?.ref ?? li.building?.ref ?? null,
              country: b?.country ?? null,
              score: r.match?.score ?? null,
            }
          })
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [apiUrl, lead.id, wantsCounterpart])

  // Shortlisted first, then matches we haven't shortlisted, de-duplicated.
  const candidates = useMemo(() => {
    const seen = new Set(shortlisted.map((c) => `${c.kind}-${c.id}`))
    const rest = matches.filter((m) => !seen.has(`${m.kind}-${m.id}`))
    const all = [...shortlisted, ...rest]
    if (!query.trim()) return all
    const q = query.toLowerCase()
    return all.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      (c.ref ?? '').toLowerCase().includes(q) ||
      (c.subtitle ?? '').toLowerCase().includes(q)
    )
  }, [shortlisted, matches, query])

  async function book() {
    if (!picked || !when) return
    setSaving(true)
    setError(null)
    try {
      const viewingAt = new Date(when).toISOString()
      const res = picked.opportunityId
        ? await fetch(`${apiUrl}/api/crm/opportunities/${picked.opportunityId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: 'VIEWING_BOOKED', viewingAt }),
          })
        : await fetch(`${apiUrl}/api/crm/${lead.id}/opportunities`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage: 'VIEWING_BOOKED',
              viewingAt,
              matchScore: picked.score ?? null,
              ...(picked.kind === 'LISTING'
                ? { listingId: picked.id }
                : { counterpartLeadId: picked.id }),
            }),
          })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.message || j.error || 'Could not book the viewing')
        return
      }
      onBooked()
    } catch {
      setError('Network error — check your connection.')
    } finally {
      setSaving(false)
    }
  }

  const liveCount = (lead.opportunities ?? []).filter((o) => LIVE_STAGES.includes(o.stage)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-violet-600" /> Book a viewing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {wantsCounterpart
                ? <>Which buyer is seeing <strong>{lead.name}</strong>&apos;s property?</>
                : <>What is <strong>{lead.name}</strong> going to see?</>}
              {liveCount > 0 && ` · ${liveCount} already in play`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={wantsCounterpart ? 'Search buyers…' : 'Search by ref (PG-1042) or title…'}
              className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">
              {wantsCounterpart
                ? 'No buyers match this property yet. Shortlist one from the client’s page first.'
                : 'Nothing to view yet — shortlist a property for this client first.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {candidates.map((c) => {
                const on = picked?.key === c.key
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => setPicked(c)}
                      className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
                        on ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-300' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {c.kind === 'CLIENT'
                          ? <Handshake className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          : <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                        {c.ref && <span className="font-mono text-[10px] font-semibold text-slate-500 shrink-0">{c.ref}</span>}
                        {c.country && <span className="text-[11px] shrink-0">{countryFlag(c.country)}</span>}
                        <span className="text-sm font-medium text-slate-900 truncate">{c.title}</span>
                        {c.score != null && (
                          <span className="ml-auto shrink-0 text-[10px] font-bold text-slate-400">{c.score}%</span>
                        )}
                        {on && <Check className="h-4 w-4 text-violet-600 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.subtitle && <span className="text-xs text-slate-400 truncate">{c.subtitle}</span>}
                        {c.opportunityId && (
                          <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-px rounded">
                            {c.alreadyBooked ? 'Viewing booked — reschedule' : 'Shortlisted'}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 space-y-2.5">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <label className="block">
            <span className="text-xs font-medium text-slate-600">When</span>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1 w-full h-9 px-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={book}
              disabled={!picked || !when || saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Book viewing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
