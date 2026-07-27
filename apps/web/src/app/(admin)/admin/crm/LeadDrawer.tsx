'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  X, Phone, MessageCircle, Mail, Loader2, Send, Pencil, Trash2, Building2,
  CalendarClock, AlertTriangle, ExternalLink, History,
} from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { LeadFormModal } from './LeadFormModal'
import {
  type Lead, type LeadContact, STATUS_META, TYPE_LABELS, MARKET_META,
  UNIT_KIND_LABELS, formatDue,
} from './types'

interface Match {
  id: string
  slug: string | null
  headline: string | null
  price: number
  currency: string
  intent: string
  building?: { title: string; city: string | null; caza: string | null; images: string[] } | null
  unit?: {
    kind: string; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null
    building?: { title: string; city: string | null; caza: string | null; images: string[] } | null
  } | null
}

const CHANNELS = ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'VIEWING', 'NOTE'] as const

/** Full client view: contact history, quick log, and matching live listings. */
export function LeadDrawer({ lead, onClose, onChanged }: { lead: Lead; onClose: () => void; onChanged: () => void }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [detail, setDetail] = useState<Lead | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
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
      const [d, m] = await Promise.all([
        fetch(`${apiUrl}/api/crm/${lead.id}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/${lead.id}/matches`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (d.ok) setDetail((await d.json()).data ?? null)
      if (m.ok) setMatches((await m.json()).data ?? [])
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
  const due = formatDue(l.nextContactAt)
  const where = [l.areas.join(', '), l.city, l.caza].filter(Boolean).join(' · ')
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

          {/* Matching listings */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Matching properties
            </p>
            {loading ? (
              <div className="flex justify-center py-6 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : matches.length === 0 ? (
              <p className="text-sm text-slate-400">
                {l.market === 'GEORGIA'
                  ? 'Georgia inventory lives on propgrp.com — no local matches.'
                  : 'No live listings match these criteria yet.'}
              </p>
            ) : (
              <div className="space-y-2">
                {matches.map((m) => {
                  const b = m.building ?? m.unit?.building
                  const img = b?.images?.[0]
                  return (
                    <Link
                      key={m.id}
                      href={m.slug ? `/listings/${m.slug}` : '#'}
                      target="_blank"
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 border border-slate-100"
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
                        <p className="text-sm font-medium text-slate-900 truncate">{m.headline || b?.title || 'Listing'}</p>
                        <p className="text-xs text-slate-500">
                          {[b?.city, b?.caza].filter(Boolean).join(', ')}
                          {m.unit?.bedrooms != null && ` · ${m.unit.bedrooms} bed`}
                          {m.unit?.areaSqm != null && ` · ${m.unit.areaSqm} m²`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-900">{m.currency} {m.price?.toLocaleString()}</p>
                        <ExternalLink className="h-3 w-3 text-slate-400 ml-auto" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

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
