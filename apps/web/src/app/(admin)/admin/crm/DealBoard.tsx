'use client'

import { useMemo, useState } from 'react'
import {
  Phone, MessageCircle, Calendar, AlertCircle, Search, Handshake,
  TrendingUp, Loader2, Check, Plus,
} from 'lucide-react'
import {
  type Deal, type OpportunityStage, DEAL_COLUMNS, dealColumnOf, STAGE_LABELS,
  dealCommission, dealAlert, isLiveDeal, TYPE_LABELS,
} from './types'
import { countryFlag } from '@/lib/market'

/**
 * The pipeline, as deals.
 *
 * The old board had one card per client and one column per `lead.status`, which
 * could not express the thing this business does every week: the same client
 * viewing an apartment in Achrafieh while negotiating a studio in Batumi. The
 * stage lives on the deal, so the board reads deals.
 *
 * A client with three deals appears three times, on purpose. The client is a
 * person you know; a deal is a thing that is or isn't happening, and only the
 * second belongs in a pipeline.
 */
export function DealBoard({
  deals,
  canSeeMoney,
  busyId,
  onMove,
  onOpenClient,
  onSetCommission,
  onNewDeal,
}: {
  deals: Deal[]
  canSeeMoney: boolean
  busyId: string | null
  onMove: (dealId: string, stage: OpportunityStage) => void
  onOpenClient: (leadId: string) => void
  onSetCommission: (dealId: string, usd: number) => void
  /** Start a deal: pick the client, then the property. */
  onNewDeal: () => void
}) {
  const [q, setQ] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return deals
    return deals.filter((d) =>
      [d.lead.name, d.lead.phone, d.subject?.title, d.subject?.ref, d.subject?.subtitle]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    )
  }, [deals, q])

  // Money at the top, because "where is the business" is the first question the
  // board is opened to answer.
  const summary = useMemo(() => {
    const live = filtered.filter(isLiveDeal)
    const won = filtered.filter((d) => d.stage === 'WON')
    const sum = (rows: Deal[]) =>
      rows.reduce((t, d) => t + (dealCommission(d)?.usd ?? 0), 0)
    return { liveCount: live.length, pipeline: sum(live), wonCount: won.length, earned: sum(won) }
  }, [filtered])

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Client, property or ref…"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <button
          onClick={onNewDeal}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> New deal
        </button>

        <div className="flex items-center gap-3 px-2 text-sm">
          <span className="text-slate-500">
            <strong className="text-slate-900">{summary.liveCount}</strong> live
          </span>
          {canSeeMoney && summary.pipeline > 0 && (
            <span className="inline-flex items-center gap-1 text-slate-500" title="Commission if every live deal lands">
              <TrendingUp className="h-3.5 w-3.5" />
              <strong className="text-slate-900">${summary.pipeline.toLocaleString()}</strong> in play
            </span>
          )}
          {canSeeMoney && summary.earned > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Handshake className="h-3.5 w-3.5" />
              <strong>${summary.earned.toLocaleString()}</strong> closed
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-3">
        {DEAL_COLUMNS.map((col) => {
          const cards = filtered.filter((d) => dealColumnOf(d) === col.key)
          const value = cards.reduce((t, d) => t + (dealCommission(d)?.usd ?? 0), 0)

          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOver(col.key) }}
              onDragLeave={() => setOver((k) => (k === col.key ? null : k))}
              onDrop={(e) => {
                e.preventDefault()
                setOver(null)
                const id = e.dataTransfer.getData('text/plain') || dragging
                setDragging(null)
                if (!id) return
                const deal = deals.find((d) => d.id === id)
                if (!deal || dealColumnOf(deal) === col.key) return
                onMove(id, col.stage)
              }}
              className={`w-[264px] shrink-0 rounded-xl border transition-colors ${
                over === col.key ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="p-2.5 border-b border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  <span className="text-sm font-semibold text-slate-900">{col.label}</span>
                  <span className="text-xs text-slate-400">{cards.length}</span>
                  {canSeeMoney && value > 0 && (
                    <span className="ml-auto text-[11px] font-medium text-slate-500">
                      ${value.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{col.hint}</p>
              </div>

              <div className="p-1.5 space-y-1.5 min-h-[120px]">
                {cards.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    canSeeMoney={canSeeMoney}
                    busy={busyId === d.id}
                    onDragStart={() => setDragging(d.id)}
                    onOpenClient={onOpenClient}
                    onSetCommission={onSetCommission}
                  />
                ))}

                {cards.length === 0 && (
                  col.key === 'SUGGESTED' ? (
                    <button
                      onClick={onNewDeal}
                      className="w-full py-6 text-[11px] text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors"
                    >
                      + Start a deal
                    </button>
                  ) : (
                    <p className="text-[11px] text-slate-300 text-center py-6">Nothing here</p>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DealCard({
  deal: d, canSeeMoney, busy, onDragStart, onOpenClient, onSetCommission,
}: {
  deal: Deal
  canSeeMoney: boolean
  busy: boolean
  onDragStart: () => void
  onOpenClient: (leadId: string) => void
  onSetCommission: (dealId: string, usd: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const alert = dealAlert(d)
  const money = canSeeMoney ? dealCommission(d) : null
  const phone = d.lead.whatsapp || d.lead.phone

  return (
    <div
      draggable={!editing}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', d.id); onDragStart() }}
      onClick={() => onOpenClient(d.lead.id)}
      className={`bg-white border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all ${
        busy ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {/* The property is the subject of the deal, so it leads. */}
      <div className="flex items-start gap-1.5">
        {d.subject?.ref && (
          <span className="font-mono text-[10px] font-semibold text-slate-400 shrink-0 mt-0.5">
            {d.subject.ref}
          </span>
        )}
        {d.subject?.country && (
          <span className="text-[11px] shrink-0">{countryFlag(d.subject.country)}</span>
        )}
        <span className="text-sm font-medium text-slate-900 leading-snug line-clamp-2 flex-1">
          {d.subject?.title ?? 'Property'}
        </span>
        {busy && <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0 mt-0.5" />}
      </div>

      {d.subject?.subtitle && (
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{d.subject.subtitle}</p>
      )}

      {/* Who it's for */}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-700 truncate flex-1">{d.lead.name}</span>
        <span className="text-[10px] text-slate-400 shrink-0">{TYPE_LABELS[d.lead.type]}</span>
      </div>

      {/* When it's happening */}
      {d.viewingAt && (
        <p className="text-[11px] text-slate-500 mt-1 inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(d.viewingAt).toLocaleString(undefined, {
            weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </p>
      )}

      {alert && (
        <p
          className={`text-[11px] mt-1 inline-flex items-center gap-1 ${
            alert.tone === 'red' ? 'text-red-600' : 'text-amber-600'
          }`}
        >
          <AlertCircle className="h-3 w-3" /> {alert.text}
        </p>
      )}

      {/* What it's worth. Editable in place on a closed deal — chasing the
          commission through a drawer is why so many went unrecorded. */}
      {canSeeMoney && (
        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <CommissionInput
              initial={d.commissionUsd}
              onCancel={() => setEditing(false)}
              onSave={(usd) => { setEditing(false); onSetCommission(d.id, usd) }}
            />
          ) : money ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`text-[11px] font-semibold rounded px-1.5 py-0.5 ${
                money.forecast
                  ? 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
              title={money.forecast ? 'Estimated from the asking price — click to set the real figure' : 'Click to edit'}
            >
              ${money.usd.toLocaleString()}{money.forecast ? ' est.' : ''}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-slate-400 hover:text-slate-700 underline decoration-dotted"
            >
              Set commission
            </button>
          )}
        </div>
      )}

      {/* Reaching them shouldn't need the drawer */}
      <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] text-slate-300 flex-1">{STAGE_LABELS[d.stage]}</span>
        {d.lead.phone && (
          <a
            href={`tel:${d.lead.phone}`}
            className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100"
          >
            <Phone className="h-3 w-3" />
          </a>
        )}
        {phone && (
          <a
            href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100"
          >
            <MessageCircle className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

/** Type a number, press Enter. Nothing else. */
function CommissionInput({
  initial, onCancel, onSave,
}: {
  initial: number | null
  onCancel: () => void
  onSave: (usd: number) => void
}) {
  const [v, setV] = useState(initial?.toString() ?? '')

  function commit() {
    const n = parseFloat(v)
    if (Number.isFinite(n) && n >= 0) onSave(n)
    else onCancel()
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px] text-slate-400">$</span>
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onCancel()
        }}
        onBlur={commit}
        inputMode="decimal"
        className="w-20 px-1 py-0.5 text-[11px] border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900/20"
        placeholder="0"
      />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commit} className="text-emerald-600">
        <Check className="h-3 w-3" />
      </button>
    </div>
  )
}
