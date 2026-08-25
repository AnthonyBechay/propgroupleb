'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  X, Phone, MessageCircle, Mail, Loader2, Send, Pencil, Trash2, Building2, Clock, CalendarPlus, ExternalLink, History, Handshake, ClipboardCheck, Lightbulb, Sparkles, Plus, StickyNote, Globe, Home,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { regionLabel } from '@/lib/crm-locations'
import { LeadFormModal } from './LeadFormModal'
import {
  type Lead, type LeadContact, type Opportunity, STATUS_META, TYPE_LABELS, MARKET_META,
  UNIT_KIND_LABELS, formatLastContact, formatPlanned, REJECTION_LABELS, hasSupplyIntent,
  SUB_STATUS_META, subStatusesFor, type LeadSubStatus, STRONG_MATCH_SCORE,
  isPastClient, LIVE_STAGES,
} from './types'
import { OpportunityList } from './OpportunityList'
import { SellerProperties } from './SellerProperties'
import { DealPanel } from './DealPanel'
import { ShareShortlistModal } from './ShareShortlistModal'
import { useAuth } from '@/contexts/AuthContext'
import { canSeeMoney as canSeeMoneyFor } from '@/lib/permissions'
import { listingRef } from '@/lib/reference'

type TabKey = 'overview' | 'properties' | 'activity' | 'matches'

/**
 * The drawer holds requirements, the conversation, the client's stock, live
 * matches and the full history — too much for one column. Tabs keep each job
 * on one screen instead of making the broker scroll to find anything.
 */
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  // Everything property-shaped about this client in one place: what they're
  // considering, what they viewed, and what they ended up buying. Splitting the
  // shortlist into a "Matches" tab meant "Properties & deals" showed no
  // properties at all.
  { key: 'properties', label: 'Properties' },
  { key: 'activity', label: 'Activity' },
  { key: 'matches', label: 'Find matches' },
]

/** Date presets, as an <input type="date"> value. */
const inDays = (n: number) => () => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const QUICK_PLANS: Array<{ label: string; value: () => string }> = [
  { label: 'Tomorrow', value: inDays(1) },
  { label: 'In 3 days', value: inDays(3) },
  { label: 'Next week', value: inDays(7) },
  { label: 'In 2 weeks', value: inDays(14) },
]

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
  // Planning the next touch belongs here — logging a call is exactly when you
  // know whether to ring back Monday.
  const [planDate, setPlanDate] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [subStatusError, setSubStatusError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // Recording a purchase we didn't list — a Batumi studio, a private sale.
  const [extTitle, setExtTitle] = useState('')
  const [extUrl, setExtUrl] = useState('')
  const [showExternal, setShowExternal] = useState(false)
  // Four tabs instead of one long scroll — the drawer holds requirements,
  // conversation, stock, matches and history, which is too much for one column.
  const [tab, setTab] = useState<TabKey>('overview')
  const [sharing, setSharing] = useState(false)

  const { user } = useAuth()
  // Presentation only: the server strips these fields for roles that may not
  // see them, so hiding here just avoids empty boxes.
  const canSeeMoney = canSeeMoneyFor(user?.role)

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
        body: JSON.stringify({
          channel,
          body: body.trim(),
          // Send the plan only when one was entered; omitting it leaves any
          // existing plan alone rather than silently wiping it.
          ...(planDate ? { nextContactAt: new Date(planDate).toISOString(), nextContactNote: planNote || null } : {}),
        }),
      })
      if (res.ok) {
        setBody('')
        setPlanDate('')
        setPlanNote('')
        await load()
        onChanged()
      }
    } finally { setBusy(false) }
  }

  /** File a note. Deliberately not a contact — see the backend for why. */
  async function addNote() {
    if (!note.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}/note`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: note.trim() }),
      })
      if (res.ok) { setNote(''); await load(); onChanged() }
    } finally { setBusy(false) }
  }

  /** Shortlist something we don't list ourselves, so the deal can be tracked. */
  async function addExternal() {
    if (!extTitle.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}/opportunities`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'INTERESTED',
          externalTitle: extTitle.trim(),
          externalUrl: extUrl.trim() || null,
        }),
      })
      if (res.ok) {
        setExtTitle(''); setExtUrl(''); setShowExternal(false)
        await load(); onChanged()
      }
    } finally { setBusy(false) }
  }

  /** Set (or clear) why this client is still open. */
  async function setSubStatus(next: LeadSubStatus | null) {
    setSubStatusError(null)
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/${lead.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subStatus: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setSubStatusError(j.message || j.error || 'Could not update')
        return
      }
      await load()
      onChanged()
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

  /**
   * Delete the client — and, unavoidably, every deal attached to them.
   *
   * This used to be an unlabelled bin next to Edit. From a board of deals, one
   * click on it wiped a client and all their cards while the user thought they
   * were removing one card. The blast radius is now spelled out before anything
   * happens, and the API refuses unless the count is echoed back.
   */
  async function remove() {
    const deals = (detail ?? lead).opportunities?.length ?? 0
    const warning = deals > 0
      ? `Delete ${lead.name}?\n\nThis also permanently deletes their ${deals} deal${deals === 1 ? '' : 's'}, including any closed sales and the commission recorded on them.\n\nTo remove a single property from their list instead, close this and use the ✕ on that row.`
      : `Delete ${lead.name} from the CRM? This cannot be undone.`
    if (!confirm(warning)) return
    setBusy(true)
    try {
      const res = await fetch(
        `${apiUrl}/api/crm/${lead.id}?confirmDeals=${deals}`,
        { method: 'DELETE', credentials: 'include' }
      )
      if (res.ok) { onChanged(); onClose() }
      else {
        const j = await res.json().catch(() => ({}))
        alert(j.message || 'Could not delete this client.')
      }
    } finally { setBusy(false) }
  }

  const l = detail ?? lead
  // A client selling AND buying gets both halves of the drawer.
  const isSupply = hasSupplyIntent(l)
  // Strong fits vs. worth-a-call near misses — brokers want both, but clearly separated.
  const strongMatches = matches.filter((m) => m.match.score >= STRONG_MATCH_SCORE)
  const nearMatches = matches.filter((m) => m.match.score < STRONG_MATCH_SCORE)
  // Closed deals lead the drawer; live ones decide whether they're still working.
  const closed = (l.opportunities ?? []).filter((o) => o.stage === 'WON')
  const live = (l.opportunities ?? []).filter((o) => LIVE_STAGES.includes(o.stage)).length

  const lastContact = formatLastContact(l.lastContactAt)
  const planned = formatPlanned(l.nextContactAt)
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
                {(l.intents?.length ? l.intents : [l.type]).map((t) => (
                  <span key={t} className="text-xs text-slate-400">{TYPE_LABELS[t]}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setEditing(true)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={remove}
                disabled={busy}
                className="px-2 py-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center gap-1 text-xs font-medium"
                title="Delete this client and everything attached to them"
              >
                <Trash2 className="h-4 w-4" /> Delete client
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
            {(l.opportunities?.length ?? 0) > 0 && (
              <button
                onClick={() => setSharing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                title="Compose a WhatsApp message listing these properties, with their reference codes"
              >
                <Send className="h-3.5 w-3.5" /> Send properties
              </button>
            )}
            <span
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600"
              title={l.lastContactAt ? new Date(l.lastContactAt).toLocaleString() : 'No contact logged yet'}
            >
              <Clock className="h-3.5 w-3.5" />{lastContact.text}
            </span>
            {planned && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                  planned.due ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-600'
                }`}
                title={l.nextContactNote || 'Planned follow-up'}
              >
                <CalendarPlus className="h-3.5 w-3.5" />{planned.text}
              </span>
            )}
          </div>

          {/* Why this client is still open — the answer to "he's Active, and?" */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">Waiting on</span>
              {subStatusesFor(l.type).map((k) => {
                const on = l.subStatus === k
                return (
                  <button
                    key={k}
                    onClick={() => setSubStatus(on ? null : k)}
                    disabled={busy}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                      on ? SUB_STATUS_META[k].cls : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {SUB_STATUS_META[k].label}
                  </button>
                )
              })}
              {l.subStatus === 'NEEDS_OPTIONS' && (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border ${SUB_STATUS_META.NEEDS_OPTIONS.cls}`}
                  title="Set automatically: everything shortlisted for this client has been ruled out"
                >
                  {SUB_STATUS_META.NEEDS_OPTIONS.label} · auto
                </span>
              )}
            </div>
            {subStatusError && <p className="text-[11px] text-red-600 mt-1.5">{subStatusError}</p>}
          </div>
        </div>

        {/* Tab bar */}
        <div className="sticky top-[132px] z-10 bg-slate-50 border-b border-slate-200 px-5">
          <nav className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-700'
                }`}
              >
                {t.label}
                {t.key === 'properties' && (l.opportunities?.length ?? 0) > 0 && (
                  <span className="ml-1 text-slate-400 font-normal">({l.opportunities!.length})</span>
                )}
                {t.key === 'matches' && strongMatches.length > 0 && (
                  <span className="ml-1 text-emerald-600 font-normal">({strongMatches.length})</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5 space-y-4">
          {tab === 'overview' && (
          <>
          {/* What they already bought or sold, first.
              Opening a client who closed months ago and being shown what they
              were once looking for is backwards — the deal is the headline. */}
          {closed.length > 0 && (
            <section className="bg-slate-900 text-white rounded-xl p-4">
              <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-2">
                {isSupply ? 'Sold with us' : 'Bought with us'}
              </p>
              <ul className="space-y-2">
                {closed.map((o) => (
                  <li key={o.id}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {o.subject?.ref && (
                        <span className="font-mono text-[10px] font-semibold text-white/60">{o.subject.ref}</span>
                      )}
                      <span className="text-sm font-semibold">
                        {o.subject?.title ?? o.externalTitle ?? 'Property'}
                      </span>
                    </div>
                    {o.soldUnitRef && <p className="text-xs text-white/70 mt-0.5">{o.soldUnitRef}</p>}
                    <p className="text-xs text-white/50 mt-0.5">
                      {o.closedAt
                        ? new Date(o.closedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
                        : 'date not recorded'}
                      {canSeeMoney && o.soldPrice != null && ` · ${o.soldCurrency} ${o.soldPrice.toLocaleString()}`}
                    </p>
                  </li>
                ))}
              </ul>
              {live === 0 && (
                <p className="text-[11px] text-white/50 mt-3 pt-3 border-t border-white/10">
                  Nothing else in progress. They stay on your books — ring them when
                  something suits.
                </p>
              )}
            </section>
          )}

          {/* Requirement summary */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {closed.length > 0 ? 'What they were after' : 'Looking for'}
            </p>
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

          </>
          )}

          {tab === 'activity' && (
          <>
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
            {/* Plan the next touch while you still remember what you agreed */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-600 inline-flex items-center gap-1">
                  <CalendarPlus className="h-3.5 w-3.5" /> Plan next contact
                </span>
                {QUICK_PLANS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setPlanDate(p.value())}
                    className="px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  >
                    {p.label}
                  </button>
                ))}
                {planDate && (
                  <button
                    type="button"
                    onClick={() => { setPlanDate(''); setPlanNote('') }}
                    className="text-[11px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-0.5"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={planDate}
                  onChange={(e) => setPlanDate(e.target.value)}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                />
                <input
                  value={planNote}
                  onChange={(e) => setPlanNote(e.target.value)}
                  placeholder="What for? (optional)"
                  className="flex-1 min-w-0 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={logContact}
                disabled={busy || !body.trim()}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {planDate ? 'Log & plan follow-up' : 'Log contact'}
              </button>
            </div>
          </section>

          {/* Notes — things worth remembering that aren't a phone call */}
          <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5" /> Notes
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="His brother is also looking · prefers ground floor · wants to close before September"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-y"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                A note doesn&apos;t count as contacting them.
              </span>
              <button
                onClick={addNote}
                disabled={busy || !note.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add note
              </button>
            </div>

            {(l.contacts ?? []).filter((c) => c.channel === 'NOTE').length > 0 && (
              <ol className="space-y-1.5 pt-1">
                {(l.contacts ?? [])
                  .filter((c) => c.channel === 'NOTE')
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.id} className="rounded-lg bg-amber-50/60 border border-amber-100 px-2.5 py-1.5">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.body}</p>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.contactedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </li>
                  ))}
              </ol>
            )}
          </section>

          </>
          )}

          {tab === 'properties' && (
          <>
          {/* What this client actually owns in the catalogue. Distinct from the
              shortlist below: that's what they're being shown, this is theirs. */}
          {(l.ownedBuildings?.length ?? 0) > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" /> Properties they own
                <span className="text-slate-400 font-normal normal-case">({l.ownedBuildings!.length})</span>
              </p>
              <ul className="space-y-1.5">
                {l.ownedBuildings!.map((b) => (
                  <li key={b.id}>
                    <a
                      href={`/admin/buildings/${b.id}`}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 hover:bg-slate-50 transition-colors"
                    >
                      {b.ref && (
                        <span className="font-mono text-[10px] font-semibold text-slate-500 shrink-0">{b.ref}</span>
                      )}
                      <span className="text-sm text-slate-800 truncate flex-1">{b.title}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {[b.city, b.caza].filter(Boolean).join(', ')}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

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
              canSeeMoney={canSeeMoney}
              onChanged={() => { load(); onChanged() }}
            />
          </section>

          <DealPanel lead={l} canSeeMoney={canSeeMoney} onChanged={() => { load(); onChanged() }} />

          {isSupply && (
            <SellerProperties
              leadId={l.id}
              properties={l.properties ?? []}
              canSeeMoney={canSeeMoney}
              onChanged={() => { load(); onChanged() }}
            />
          )}


          </>
          )}

          {tab === 'matches' && (
          <>
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
                      title="Add to their list"
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

          </>
          )}

          {tab === 'activity' && (
          <>
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
          </>
          )}
        </div>
      </aside>

      {sharing && (
        <ShareShortlistModal
          lead={l}
          siteUrl={typeof window !== 'undefined' ? window.location.origin : ''}
          onClose={() => setSharing(false)}
        />
      )}

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
