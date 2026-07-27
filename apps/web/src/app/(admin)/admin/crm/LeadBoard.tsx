'use client'

import { useState } from 'react'
import {
  Phone, MessageCircle, AlertTriangle, CalendarClock, MapPin, Wallet,
  MessageSquareWarning, CalendarCheck, Sparkles,
} from 'lucide-react'
import {
  type Lead, type LeadStatus, BOARD_STAGES, STATUS_META, TYPE_LABELS, MARKET_META,
  formatDue, isWaitingOnUs, hasAwaitingFeedback, nextViewing, TYPE_META,
} from './types'

const STAGE_ACCENT: Record<string, string> = {
  NEW: 'bg-sky-500',
  ACTIVE: 'bg-emerald-500',
  VIEWING: 'bg-violet-500',
  NEGOTIATING: 'bg-amber-500',
  WON: 'bg-green-600',
}

const STAGE_HINT: Record<string, string> = {
  NEW: 'Just came in — call them',
  ACTIVE: 'Searching with us',
  VIEWING: 'Viewing requested / booked',
  NEGOTIATING: 'Offer on the table',
  WON: 'Deal closed',
}

/**
 * Trello-style pipeline. Each column is a stage; cards drag between them and
 * the drop writes the new status straight back to the API. Overdue cards are
 * flagged so the urgent work is visible without leaving the board.
 */
export function LeadBoard({
  leads,
  onOpen,
  onMove,
}: {
  leads: Lead[]
  onOpen: (id: string) => void
  onMove: (id: string, status: LeadStatus) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {BOARD_STAGES.map((stage) => {
        const items = leads.filter((l) => l.status === stage)
        const overdueCount = items.filter((l) => formatDue(l.nextContactAt).tone === 'overdue').length
        const isOver = overStage === stage

        return (
          <div
            key={stage}
            onDragOver={(e) => { e.preventDefault(); setOverStage(stage) }}
            onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              setOverStage(null)
              if (dragId) {
                const lead = leads.find((l) => l.id === dragId)
                if (lead && lead.status !== stage) onMove(dragId, stage)
              }
              setDragId(null)
            }}
            className={`flex-shrink-0 w-[280px] rounded-xl border transition-colors ${
              isOver ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-slate-50'
            }`}
          >
            {/* Column header */}
            <div className="px-3 pt-3 pb-2 sticky top-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${STAGE_ACCENT[stage]}`} />
                <h3 className="text-sm font-semibold text-slate-800">{STATUS_META[stage].label}</h3>
                <span className="text-xs text-slate-400 font-medium">{items.length}</span>
                {overdueCount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                    {overdueCount} due
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">{STAGE_HINT[stage]}</p>
            </div>

            {/* Cards */}
            <div className="px-2 pb-2 space-y-2 min-h-[120px] max-h-[calc(100vh-380px)] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-6">Drop a client here</p>
              ) : (
                items.map((l) => {
                  const due = formatDue(l.nextContactAt)
                  const where = l.areas.slice(0, 2).join(', ')
                  const phone = l.whatsapp || l.phone
                  const waiting = isWaitingOnUs(l)
                  const feedbackDue = hasAwaitingFeedback(l)
                  const viewingAt = nextViewing(l)
                  const shown = (l.opportunities ?? []).length
                  const isSupply = l.type === 'SELLER' || l.type === 'LANDLORD'
                  return (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={() => setDragId(l.id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null) }}
                      onClick={() => onOpen(l.id)}
                      className={`bg-white rounded-lg border border-l-4 p-2.5 cursor-pointer hover:shadow-md transition-all ${
                        dragId === l.id ? 'opacity-40' : ''
                      } ${TYPE_META[l.type].accent} ${due.tone === 'overdue' ? 'border-red-200' : 'border-slate-200'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-slate-900 text-sm leading-tight truncate">{l.name}</p>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${MARKET_META[l.market].cls}`}>
                          {l.market === 'GEORGIA' ? '🇬🇪' : '🇱🇧'}
                        </span>
                      </div>

                      {/* Which side of the deal they're on — colour-coded */}
                      <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_META[l.type].chip}`}>
                        {TYPE_LABELS[l.type]}
                      </span>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {l.askingFor || l.unitKinds.join(', ')}
                      </p>

                      {/* Action signals — what this client needs from us */}
                      {(waiting || feedbackDue || viewingAt) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {feedbackDue && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                              <MessageSquareWarning className="h-2.5 w-2.5" /> Feedback needed
                            </span>
                          )}
                          {viewingAt && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-800 bg-violet-100 px-1.5 py-0.5 rounded">
                              <CalendarCheck className="h-2.5 w-2.5" />
                              {new Date(viewingAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {waiting && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-800 bg-sky-100 px-1.5 py-0.5 rounded">
                              <Sparkles className="h-2.5 w-2.5" /> Needs new options
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {where && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <MapPin className="h-2.5 w-2.5" />{where}
                            {l.areas.length > 2 && ` +${l.areas.length - 2}`}
                          </span>
                        )}
                        {(l.budgetMin || l.budgetMax) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Wallet className="h-2.5 w-2.5" />
                            {isSupply
                              ? `asks ${((l.budgetMin ?? 0) / 1000).toFixed(0)}k`
                              : l.budgetMax ? `≤${(l.budgetMax / 1000).toFixed(0)}k` : `≥${((l.budgetMin ?? 0) / 1000).toFixed(0)}k`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                            due.tone === 'overdue' ? 'text-red-600'
                            : due.tone === 'today' ? 'text-amber-600'
                            : 'text-slate-400'
                          }`}
                        >
                          {due.tone === 'overdue' ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                          {due.text}
                        </span>
                        {shown > 0 && (
                          <span className="text-[10px] text-slate-400">{shown} shown</span>
                        )}
                        {phone && (
                          <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <a href={`tel:${l.phone}`} className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100">
                              <Phone className="h-3 w-3" />
                            </a>
                            <a
                              href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          </span>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
