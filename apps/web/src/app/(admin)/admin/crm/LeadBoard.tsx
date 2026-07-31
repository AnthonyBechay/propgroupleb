'use client'

import { useMemo, useState } from 'react'
import {
  Phone, MessageCircle, MapPin, Wallet, MessageSquareWarning,
  CalendarCheck, Target, Clock, CalendarPlus, Users,
} from 'lucide-react'
import {
  type Lead, type LeadStatus, BOARD_COLUMNS, TYPE_LABELS, MARKET_META,
  formatLastContact, formatPlanned, hasAwaitingFeedback, TYPE_META,
  isRecentWin, isSupplyType, columnOf, acceptsDrop, lastActivityAt,
  SUB_STATUS_META,
} from './types'

/**
 * Trello-style pipeline.
 *
 * Two rules make it feel like Trello rather than a form: the drop is applied to
 * local state immediately and never triggers a full reload, and a column
 * refuses cards from the wrong side of the deal instead of silently bouncing
 * them back after a round-trip.
 */
export function LeadBoard({
  leads,
  onOpen,
  onMove,
  onBookViewing,
  untapped = {},
}: {
  leads: Lead[]
  onOpen: (id: string) => void
  onMove: (id: string, status: LeadStatus) => void
  /** Dropping into Viewing has to say *which* property — the parent asks. */
  onBookViewing: (lead: Lead) => void
  /** leadId -> count of matches nobody has shortlisted yet. */
  untapped?: Record<string, number>
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  const dragging = dragId ? leads.find((l) => l.id === dragId) ?? null : null

  // Most recently touched first; within the same day, clients with matches
  // nobody has looked at yet come first — those are the ones you can act on.
  const sorted = useMemo(() => {
    const day = (l: Lead) => Math.floor(lastActivityAt(l) / 86_400_000)
    return [...leads].sort((a, b) => {
      const byDay = day(b) - day(a)
      if (byDay !== 0) return byDay
      const explore = (untapped[b.id] ?? 0) > 0 ? 1 : 0
      const exploreA = (untapped[a.id] ?? 0) > 0 ? 1 : 0
      if (explore !== exploreA) return explore - exploreA
      return lastActivityAt(b) - lastActivityAt(a)
    })
  }, [leads, untapped])

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-3 -mx-1 px-1">
      {BOARD_COLUMNS.map((col) => {
        // Won only shows recent closes — older wins stay in the record but stop
        // cluttering the working board.
        const items = sorted.filter(
          (l) => columnOf(l) === col.key && (col.key !== 'WON' || isRecentWin(l))
        )
        const canDrop = dragging ? acceptsDrop(col, dragging) : true
        const isOver = overKey === col.key && canDrop
        const rejects = !!dragging && !canDrop

        return (
          <div
            key={col.key}
            onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOverKey(col.key) } }}
            onDragLeave={() => setOverKey((k) => (k === col.key ? null : k))}
            onDrop={(e) => {
              e.preventDefault()
              setOverKey(null)
              const lead = dragId ? leads.find((l) => l.id === dragId) : null
              setDragId(null)
              if (!lead || !acceptsDrop(col, lead) || columnOf(lead) === col.key) return
              // A viewing is always of something specific, so ask what.
              if (col.status === 'VIEWING') onBookViewing(lead)
              else onMove(lead.id, col.status)
            }}
            className={`flex-shrink-0 w-[228px] rounded-xl border transition-colors ${
              isOver ? 'border-slate-400 bg-slate-100 ring-2 ring-slate-300'
              : rejects ? 'border-slate-200 bg-slate-50 opacity-40'
              : 'border-slate-200 bg-slate-50'
            }`}
          >
            {/* Column header */}
            <div className="px-2.5 pt-2 pb-1.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                <h3 className="text-[13px] font-semibold text-slate-800">{col.label}</h3>
                <span className="text-[11px] text-slate-400 font-medium">{items.length}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{col.hint}</p>
            </div>

            {/* Cards */}
            <div className="px-1.5 pb-2 space-y-1 min-h-[80px] max-h-[calc(100vh-230px)] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-[11px] text-slate-300 text-center py-5">
                  {rejects ? 'Wrong side of the deal' : 'Drop a client here'}
                </p>
              ) : (
                items.map((l) => (
                  <LeadCard
                    key={l.id}
                    lead={l}
                    dragging={dragId === l.id}
                    untapped={untapped[l.id] ?? 0}
                    onOpen={onOpen}
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverKey(null) }}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** One client. Deliberately dense — a broker wants the whole book on screen. */
function LeadCard({
  lead: l, dragging, untapped, onOpen, onDragStart, onDragEnd,
}: {
  lead: Lead
  dragging: boolean
  untapped: number
  onOpen: (id: string) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const last = formatLastContact(l.lastContactAt)
  const planned = formatPlanned(l.nextContactAt)
  const where = l.areas.slice(0, 2).join(', ')
  const phone = l.whatsapp || l.phone
  const feedbackDue = hasAwaitingFeedback(l)
  const isSupply = isSupplyType(l.type)
  const sub = l.subStatus ? SUB_STATUS_META[l.subStatus] : null

  // Booked viewings, with who/what each one is against.
  const viewings = (l.opportunities ?? []).filter((o) => o.stage === 'VIEWING_BOOKED')

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(l.id)}
      className={`bg-white rounded-lg border border-l-[3px] border-slate-200 px-2 py-1.5 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-150 ${
        dragging ? 'opacity-30 rotate-1' : ''
      } ${TYPE_META[l.type].accent}`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="font-medium text-slate-900 text-[12.5px] leading-tight truncate">{l.name}</p>
        <span className="shrink-0 text-[10px] leading-none pt-0.5">
          {l.market === 'GEORGIA' ? '🇬🇪' : '🇱🇧'}
        </span>
      </div>

      <div className="flex items-center gap-1 mt-0.5 min-w-0">
        <span className={`shrink-0 text-[9px] font-bold px-1 py-px rounded ${TYPE_META[l.type].chip}`}>
          {TYPE_LABELS[l.type]}
        </span>
        <span className="text-[10.5px] text-slate-500 truncate">
          {l.askingFor || l.unitKinds.join(', ')}
        </span>
      </div>

      {/* Why this client is still open */}
      {sub && (
        <span className={`inline-block mt-1 text-[9.5px] font-semibold px-1.5 py-px rounded border ${sub.cls}`}>
          {sub.label}
        </span>
      )}

      {/* Who they're viewing, and when — a buyer can have several on the go */}
      {viewings.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {viewings.slice(0, 2).map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-1 text-[9.5px] text-violet-800 bg-violet-50 border border-violet-200 rounded px-1 py-px"
            >
              <CalendarCheck className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">
                {o.subject?.ref ? `${o.subject.ref} · ` : ''}{o.subject?.title ?? 'Viewing'}
              </span>
              {o.viewingAt && (
                <span className="ml-auto shrink-0 font-semibold">
                  {new Date(o.viewingAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
          {viewings.length > 2 && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] text-violet-700">
              <Users className="h-2.5 w-2.5" /> +{viewings.length - 2} more viewings
            </span>
          )}
        </div>
      )}

      {/* Action signals */}
      {(untapped > 0 || feedbackDue) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {untapped > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-emerald-800 bg-emerald-100 px-1 py-px rounded"
              title={`${untapped} match${untapped === 1 ? '' : 'es'} nobody has shortlisted yet`}
            >
              <Target className="h-2.5 w-2.5" /> {untapped} to explore
            </span>
          )}
          {feedbackDue && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-amber-800 bg-amber-100 px-1 py-px rounded">
              <MessageSquareWarning className="h-2.5 w-2.5" /> Feedback
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mt-1">
        {where && (
          <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-500 bg-slate-100 px-1 py-px rounded">
            <MapPin className="h-2.5 w-2.5" />{where}
            {l.areas.length > 2 && ` +${l.areas.length - 2}`}
          </span>
        )}
        {(l.budgetMin || l.budgetMax) && (
          <span className="inline-flex items-center gap-0.5 text-[9.5px] text-slate-500 bg-slate-100 px-1 py-px rounded">
            <Wallet className="h-2.5 w-2.5" />
            {isSupply
              ? `asks ${((l.budgetMin ?? 0) / 1000).toFixed(0)}k`
              : l.budgetMax ? `≤${(l.budgetMax / 1000).toFixed(0)}k` : `≥${((l.budgetMin ?? 0) / 1000).toFixed(0)}k`}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-slate-100">
        {/* Plain fact, not a countdown to a date nobody agreed to */}
        <span
          className={`inline-flex items-center gap-0.5 text-[9.5px] ${last.stale ? 'text-slate-500 font-medium' : 'text-slate-400'}`}
          title={l.lastContactAt ? `Last contact ${new Date(l.lastContactAt).toLocaleDateString()}` : 'No contact logged yet'}
        >
          <Clock className="h-2.5 w-2.5" />{last.text}
        </span>

        {planned && (
          <span
            className={`inline-flex items-center gap-0.5 text-[9.5px] font-medium ${planned.due ? 'text-sky-700' : 'text-slate-400'}`}
            title={l.nextContactNote || 'Planned follow-up'}
          >
            <CalendarPlus className="h-2.5 w-2.5" />{planned.text}
          </span>
        )}

        {phone && (
          <span className="flex items-center gap-0.5 ml-auto" onClick={(e) => e.stopPropagation()}>
            <a href={`tel:${l.phone}`} className="p-0.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100">
              <Phone className="h-3 w-3" />
            </a>
            <a
              href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="p-0.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
            >
              <MessageCircle className="h-3 w-3" />
            </a>
          </span>
        )}
      </div>
    </article>
  )
}
