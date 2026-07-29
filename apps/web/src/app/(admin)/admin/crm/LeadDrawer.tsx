'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  X, Phone, MessageCircle, Mail, Loader2, Send, Pencil, Trash2, Building2,
  CalendarClock, AlertTriangle, ExternalLink, History, Handshake,
  ClipboardCheck, Lightbulb, Sparkles, Plus,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { regionLabel } from '@/lib/crm-locations'
import { LeadFormModal } from './LeadFormModal'
import {
  type Lead, type LeadContact, type Opportunity, STATUS_META, TYPE_LABELS, MARKET_META,
  UNIT_KIND_LABELS, formatDue, REJECTION_LABELS, isSupplyType,
} from './types'
import { OpportunityList } from './OpportunityList'
import { listingRef } from '@/lib/reference'

interface MatchScore {
  score: number
  reasons: string[]
  misses: string[]
}

interface ListingMatch {
  listing: {
    id: string
    slug: string | null
    headline: string | null
    price: number
    currency: string
    intent: string
    building?: { ref?: string | null; title: string; city: string | null; caza: string | null; images: string[] } | null
    unit?: {
      ref?: string | null
      kind: string; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null
      building?: { ref?: string | null; title: string; city: string | null; caza: string | null; images: string[] } | null
    } | null
  }
  match: MatchScore
}

interface LeadMatch {
  lead: Lead
  match: MatchScore
}

/** Colour the match badge by strength so strong fits jump out. */
function scoreCls(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800'
  if (score >= 60) return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
}

const CHANNELS = ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'VIEWING', 'NOTE'] as const

/** Full client view: contact history, quick log, and matching live listings. */
export function LeadDrawer({ lead, onClose, onChanged }: { lead: Lead; onClose: () => void; onChanged: () => void }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [detail, setDetail] = useState<Lead | null>(null)
  const [matches, setMatches] = useState<ListingMatch[]>([])
  const [leadMatches, setLeadMatches] = useState<LeadMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  // Quick contact-log form
  const [channel, setChannel] = useState<typeof CHANNELS[number]>('CALL')
  const [body, setBody] = useState('')
  const [interval, setInterval] = useState(String(lead.contactIntervalDays))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, m, lm] = await Promise.all([
        fetch(`${apiUrl}/api/crm/${lead.id}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/${lead.id}/matches`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/${lead.id}/lead-matches`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (d.ok) setDetail((await d.json()).data ?? null)
      if (m.ok) setMatches((await m.json()).data ?? [])
      if (lm.ok) setLeadMatches((await lm.json()).data ?? [])
    } finally {
      setLoading(false)
    }
  }, [apiUrl, lead.id])
  useEffect(() => { load() }, [load])

  async function logContact() {
    if (!body.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}/contact`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, body: body.trim(), contactIntervalDays: Number(interval) || undefined }),
      })
      if (res.ok) {
        setBody('')
        await load()
        onChanged()
      }
    } finally { setBusy(false) }
  }

  /** Shortlist a matched listing / counterpart client so it starts being tracked. */
  async function addOpportunity(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}/opportunities`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { await load(); onChanged() }
    } finally { setBusy(false) }
  }

  async function setStatus(status: string) {
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) { await load(); onChanged() }
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!confirm(`Delete ${lead.name} from the CRM? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) { onChanged(); onClose() }
    } finally { setBusy(false) }
  }

  const l = detail ?? lead
  const isSupply = isSupplyType(l.type)
  // Strong fits vs. worth-a-call near misses — brokers want both, but clearly separated.
  const strongMatches = matches.filter((m) => m.match.score >= 70)
  const nearMatches = matches.filter((m) => m.match.score < 70)
  const due = formatDue(l.nextContactAt)
  const where = [l.areas.join(', '), l.regions.map(regionLabel).join(', ')].filter(Boolean).join(' · ')
  const phone = l.whatsapp || l.phone

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-slate-50 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">{l.name}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_META[l.status].cls}`}>{STATUS_META[l.status].label}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${MARKET_META[l.market].cls}`}>{MARKET_META[l.market].label}</span>
                <span className="text-xs text-slate-400">{TYPE_LABELS[l.type]}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setEditing(true)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={remove} disabled={busy} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
          </div>

          {/* Contact actions */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {l.phone && (
              <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">
                <Phone className="h-3.5 w-3.5" /> {l.phone}
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            {l.email && (
              <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 hover:bg-slate-100">
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
            <span className={`ml-auto inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
              due.tone === 'overdue' ? 'bg-red-50 text-red-700' : due.tone === 'today' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {due.tone === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
              {due.text}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Requirement summary */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Looking for</p>
            <p className="text-sm text-slate-800">
              {l.askingFor || l.unitKinds.map((k) => UNIT_KIND_LABELS[k] ?? k).join(', ') || '—'}
            </p>
            {where && <p className="text-sm text-slate-500 mt-1">in {where}</p>}
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
              {(l.budgetMin || l.budgetMax) && (
                <span>Budget: <strong>{l.currency} {(l.budgetMin ?? 0).toLocaleString()}–{l.budgetMax ? l.budgetMax.toLocaleString() : '∞'}</strong></span>
              )}
              {l.minBeds != null && <span>{l.minBeds}+ beds</span>}
              <span className="text-slate-400">Every {l.contactIntervalDays}d</span>
            </div>
            {l.notes && <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3">{l.notes}</p>}
          </section>

          {/* Status quick-set */}
          <section className="flex flex-wrap gap-1.5">
            {(['ACTIVE', 'VIEWING', 'NEGOTIATING', 'WON', 'LOST'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                disabled={busy || l.status === s}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-100 ${
                  l.status === s ? `${STATUS_META[s].cls} border-transparent` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </section>

          {/* Log a contact */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Log a contact</p>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    channel === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.charAt(0) + c.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="What was said / agreed?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-y"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Next in</label>
              <input
                type="number" min="1" value={interval} onChange={(e) => setInterval(e.target.value)}
                className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
              />
              <span className="text-xs text-slate-500">days</span>
              <button
                onClick={logContact}
                disabled={busy || !body.trim()}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Log &amp; reschedule
              </button>
            </div>
          </section>

          {/* What we've shown them, and how it went */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" /> Shortlist &amp; viewings
              {(l.opportunities?.length ?? 0) > 0 && (
                <span className="text-slate-400 font-normal normal-case">({l.opportunities!.length})</span>
              )}
            </p>

            {/* Why their search isn't landing */}
            {(l.insights?.length ?? 0) > 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Pattern in their rejections
                </p>
                <ul className="mt-1 space-y-0.5">
                  {l.insights!.map((i) => (
                    <li key={i.reason} className="text-xs text-amber-800">
                      <strong>{i.count}×</strong> {REJECTION_LABELS[i.reason as keyof typeof REJECTION_LABELS] ?? i.reason} — {i.advice}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {l.needsNewOptions && (
              <div className="mb-3 rounded-lg bg-sky-50 border border-sky-200 p-2.5 text-xs text-sky-800 flex items-start gap-1.5">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Everything shown has been ruled out — this client is waiting on new options from us.</span>
              </div>
            )}

            <OpportunityList
              opportunities={l.opportunities ?? []}
              labelFor={(o: Opportunity) => ({
                // The API resolves this for us — ruled-out items are excluded
                // from the match lists, so we can't look them up there.
                title: o.subject?.title ?? (o.counterpartLeadId ? 'Client' : 'Property'),
                subtitle: o.subject?.subtitle ?? undefined,
                isClient: o.subject?.kind === 'CLIENT' || !!o.counterpartLeadId,
              })}
              onChanged={() => { load(); onChanged() }}
            />
          </section>

          {/* Client-to-client common ground */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Handshake className="h-3.5 w-3.5" /> Possible client matches
              {leadMatches.length > 0 && <span className="text-slate-400 font-normal normal-case">({leadMatches.length})</span>}
            </p>
            <p className="text-[11px] text-slate-400 -mt-2 mb-3">
              {!isSupply
                ? 'Sellers/landlords in our CRM whose property could suit this client.'
                : 'Buyers/renters in our CRM who are looking for what this client has.'}
            </p>
            {loading ? (
              <div className="flex justify-center py-6 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : leadMatches.length === 0 ? (
              <p className="text-sm text-slate-400">No counterpart clients match closely enough yet.</p>
            ) : (
              <div className="space-y-2">
                {leadMatches.map(({ lead: other, match }) => (
                  <div key={other.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-100">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${scoreCls(match.score)}`}>{match.score}%</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {other.name} <span className="text-xs font-normal text-slate-400">· {TYPE_LABELS[other.type]}</span>
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {match.reasons.slice(0, 3).join(' · ') || other.askingFor || other.areas.join(', ')}
                      </p>
                    </div>
                    {other.phone && (
                      <a
                        href={`https://wa.me/${(other.whatsapp || other.phone).replace(/[^0-9]/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600 shrink-0"
                        title={`Message ${other.name}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => addOpportunity({ counterpartLeadId: other.id, matchScore: match.score })}
                      disabled={busy}
                      title="Add to shortlist"
                      className="shrink-0 p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Matching listings — only useful for clients who are looking */}
          {!isSupply && (
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Matching properties
              {matches.length > 0 && <span className="text-slate-400 font-normal normal-case">({matches.length})</span>}
            </p>
            {loading ? (
              <div className="flex justify-center py-6 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : matches.length === 0 ? (
              <p className="text-sm text-slate-400">
                {l.market === 'GEORGIA'
                  ? 'Georgia inventory lives on propgrp.com — no local matches.'
                  : 'No live listings fit these criteria closely enough yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {/* Near misses are worth a call even when they don't tick every box. */}
                {nearMatches.length > 0 && strongMatches.length > 0 && (
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Strong fit</p>
                )}
                {[...strongMatches, ...nearMatches].map(({ listing: m, match }, idx) => {
                  const startsNear = idx === strongMatches.length && nearMatches.length > 0 && strongMatches.length > 0
                  const b = m.building ?? m.unit?.building
                  const img = b?.images?.[0]
                  return (
                    <div key={m.id}>
                    {startsNear && (
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide pt-2 pb-1">
                        Worth a call — close but not exact
                      </p>
                    )}
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <Link
                      href={m.slug ? `/listings/${m.slug}` : '#'}
                      target="_blank"
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={normalizeFileUrl(img)} alt="" className="h-12 w-16 object-cover rounded-md shrink-0" />
                      ) : (
                        <div className="h-12 w-16 bg-slate-100 rounded-md flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scoreCls(match.score)}`}>{match.score}%</span>
                          {listingRef(m) && <span className="font-mono text-[10px] font-semibold text-slate-400 shrink-0">{listingRef(m)}</span>}
                          <p className="text-sm font-medium text-slate-900 truncate">{m.headline || b?.title || 'Listing'}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {match.reasons.slice(0, 3).join(' · ') || [b?.city, b?.caza].filter(Boolean).join(', ')}
                        </p>
                        {match.misses.length > 0 && (
                          <p className="text-[11px] text-amber-600 mt-0.5 truncate">⚠ {match.misses.slice(0, 2).join(' · ')}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-900">{m.currency} {m.price?.toLocaleString()}</p>
                        <ExternalLink className="h-3 w-3 text-slate-400 ml-auto" />
                      </div>
                    </Link>
                    <button
                      onClick={() => addOpportunity({ listingId: m.id, matchScore: match.score })}
                      disabled={busy}
                      title="Add to shortlist"
                      className="shrink-0 p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          )}

          {/* History */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Contact history
            </p>
            {!l.contacts?.length ? (
              <p className="text-sm text-slate-400">No contacts logged yet.</p>
            ) : (
              <ol className="space-y-3">
                {l.contacts.map((c: LeadContact) => (
                  <li key={c.id} className="border-l-2 border-slate-200 pl-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{c.channel.charAt(0) + c.channel.slice(1).toLowerCase()}</span>
                      <span>{new Date(c.contactedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </aside>

      {editing && (
        <LeadFormModal
          lead={l}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); onChanged() }}
        />
      )}
    </>
  )
}
