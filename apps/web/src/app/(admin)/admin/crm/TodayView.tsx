'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, Phone, MessageCircle, CalendarCheck, MessageSquareWarning,
  Sparkles, Snowflake, Zap, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * The working screen.
 *
 * The board answers "how is the pipeline doing" — a manager's question. It
 * doesn't answer "what do I do now", which is the one a broker asks at 9am,
 * so the day's actual work was spread across five filters nobody clicked.
 * Everything here is time-sensitive: it either happens today or it decays.
 *
 * Ordered by how perishable each item is. An uncalled lead from this morning
 * goes cold in hours; a client we haven't rung in three weeks is already half
 * lost, but one more day won't change that.
 */

interface AgendaLead {
  id: string
  name: string
  phone: string | null
  whatsapp?: string | null
  market: string
  type?: string
  askingFor?: string | null
  source?: string
  createdAt?: string
  lastContactAt?: string | null
  nextContactAt?: string | null
  nextContactNote?: string | null
}

interface AgendaOpportunity {
  id: string
  viewingAt: string | null
  viewedAt: string | null
  lead: AgendaLead
}

interface Agenda {
  upcomingViewings: AgendaOpportunity[]
  awaitingFeedback: AgendaOpportunity[]
  needsNewOptions: AgendaLead[]
  dueFollowUps: AgendaLead[]
  freshLeads: AgendaLead[]
  goingCold: AgendaLead[]
}

const dayLabel = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  const days = Math.round((d.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${Math.abs(days)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function TodayView({
  market,
  onOpen,
}: {
  market: 'all' | 'LEBANON' | 'GEORGIA'
  onOpen: (id: string) => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (market !== 'all') p.set('market', market)
      const res = await fetch(`${apiUrl}/api/crm/agenda?${p}`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) setAgenda((await res.json()).data ?? null)
    } finally { setLoading(false) }
  }, [apiUrl, market])
  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }
  if (!agenda) return null

  const viewingsToday = agenda.upcomingViewings.filter(
    (o) => o.viewingAt && new Date(o.viewingAt).toDateString() === new Date().toDateString()
  )
  const viewingsSoon = agenda.upcomingViewings.filter((o) => !viewingsToday.includes(o))

  const totalWork =
    agenda.freshLeads.length + viewingsToday.length + agenda.dueFollowUps.length +
    agenda.awaitingFeedback.length + viewingsSoon.length +
    agenda.needsNewOptions.length + agenda.goingCold.length

  if (totalWork === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
        <p className="font-semibold text-slate-800">Nothing needs you right now.</p>
        <p className="text-sm text-slate-500 mt-1">
          No uncalled leads, no viewings today, no follow-ups due.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Section
        title="Never called"
        hint="Came in the last 3 days, nobody has spoken to them"
        icon={<Zap className="h-4 w-4" />}
        tone="red"
        count={agenda.freshLeads.length}
      >
        {agenda.freshLeads.map((l) => (
          <Row key={l.id} lead={l} onOpen={onOpen}
               meta={`${l.source ? l.source.replace(/_/g, ' ').toLowerCase() : 'new'} · ${dayLabel(l.createdAt)}`}
               detail={l.askingFor} />
        ))}
      </Section>

      <Section
        title="Viewings today"
        hint="Confirm the client is still coming"
        icon={<CalendarCheck className="h-4 w-4" />}
        tone="violet"
        count={viewingsToday.length}
      >
        {viewingsToday.map((o) => (
          <Row key={o.id} lead={o.lead} onOpen={onOpen}
               meta={o.viewingAt ? new Date(o.viewingAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''} />
        ))}
      </Section>

      <Section
        title="Follow-ups due"
        hint="You planned to call them by now"
        icon={<Phone className="h-4 w-4" />}
        tone="sky"
        count={agenda.dueFollowUps.length}
      >
        {agenda.dueFollowUps.map((l) => (
          <Row key={l.id} lead={l} onOpen={onOpen}
               meta={dayLabel(l.nextContactAt)} detail={l.nextContactNote} />
        ))}
      </Section>

      <Section
        title="Feedback owed"
        hint="Viewing happened, nobody recorded what they thought"
        icon={<MessageSquareWarning className="h-4 w-4" />}
        tone="amber"
        count={agenda.awaitingFeedback.length}
      >
        {agenda.awaitingFeedback.map((o) => (
          <Row key={o.id} lead={o.lead} onOpen={onOpen} meta={dayLabel(o.viewedAt)} />
        ))}
      </Section>

      <Section
        title="Waiting on us"
        hint="Everything we showed them is ruled out"
        icon={<Sparkles className="h-4 w-4" />}
        tone="indigo"
        count={agenda.needsNewOptions.length}
      >
        {agenda.needsNewOptions.map((l) => (
          <Row key={l.id} lead={l} onOpen={onOpen} meta="needs options" />
        ))}
      </Section>

      <Section
        title="Going cold"
        hint="No contact in 3 weeks and nothing planned"
        icon={<Snowflake className="h-4 w-4" />}
        tone="slate"
        count={agenda.goingCold.length}
      >
        {agenda.goingCold.map((l) => (
          <Row key={l.id} lead={l} onOpen={onOpen}
               meta={`last spoke ${dayLabel(l.lastContactAt)}`} detail={l.askingFor} />
        ))}
      </Section>

      {viewingsSoon.length > 0 && (
        <Section
          title="Viewings this week"
          hint="Booked, not today"
          icon={<CalendarCheck className="h-4 w-4" />}
          tone="slate"
          count={viewingsSoon.length}
        >
          {viewingsSoon.map((o) => (
            <Row key={o.id} lead={o.lead} onOpen={onOpen} meta={dayLabel(o.viewingAt)} />
          ))}
        </Section>
      )}
    </div>
  )
}

const TONES: Record<string, { head: string; badge: string }> = {
  red:    { head: 'text-red-700',    badge: 'bg-red-100 text-red-700' },
  violet: { head: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  sky:    { head: 'text-sky-700',    badge: 'bg-sky-100 text-sky-700' },
  amber:  { head: 'text-amber-800',  badge: 'bg-amber-100 text-amber-800' },
  indigo: { head: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  slate:  { head: 'text-slate-600',  badge: 'bg-slate-100 text-slate-600' },
}

function Section({
  title, hint, icon, tone, count, children,
}: {
  title: string; hint: string; icon: React.ReactNode; tone: keyof typeof TONES
  count: number; children: React.ReactNode
}) {
  // An empty pile is good news, not a card worth the screen space.
  if (count === 0) return null
  const t = TONES[tone]
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className={t.head}>{icon}</span>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${t.badge}`}>{count}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
      </div>
      <ul className="divide-y divide-slate-50 max-h-[280px] overflow-y-auto">{children}</ul>
    </section>
  )
}

function Row({
  lead, meta, detail, onOpen,
}: {
  lead: AgendaLead; meta?: string; detail?: string | null; onOpen: (id: string) => void
}) {
  const phone = lead.whatsapp || lead.phone
  return (
    <li>
      <div
        onClick={() => onOpen(lead.id)}
        className="group flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 cursor-pointer"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-slate-900 truncate">{lead.name}</span>
            <span className="text-[10px] shrink-0">{lead.market === 'GEORGIA' ? '🇬🇪' : '🇱🇧'}</span>
          </div>
          {(meta || detail) && (
            <p className="text-[11px] text-slate-400 truncate">
              {[meta, detail].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Acting on these is the point — one tap to call or message. */}
        <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200">
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {phone && (
            <a
              href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-200"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          <ArrowRight className="h-3.5 w-3.5 text-slate-200 group-hover:text-slate-400" />
        </span>
      </div>
    </li>
  )
}
