'use client'

import { useMemo, useState } from 'react'
import {
  Phone, MessageCircle, Calendar, AlertCircle, Handshake,
  TrendingUp, Loader2, Check, Plus, X, ChevronRight,
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
  onRemoveDeal,
  search,
}: {
  deals: Deal[]
  canSeeMoney: boolean
  busyId: string | null
  onMove: (dealId: string, stage: OpportunityStage) => void
  onOpenClient: (leadId: string) => void
  onSetCommission: (dealId: string, usd: number) => void
  /** Start a deal: pick the client, then the property. */
  onNewDeal: () => void
  /** Drop this one deal. Never touches the client. */
  onRemoveDeal: (deal: Deal) => void
  /** The page's single search box — the board doesn't own one. */
  search: string
}) {
  const q = search
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  // Below `lg` the board shows one column at a time. Seven 264px columns in a
  // horizontal scroller is a kanban on paper and a swipe-hunt in practice: on a
  // 390px screen you can see one and a half of them and you cannot tell where
  // the pipeline is without scrolling the whole way across.
  const [mobileColumn, setMobileColumn] = useState<string>(DEAL_COLUMNS[0].key)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = deals
    if (needle) {
      out = out.filter((d) =>
        [d.lead.name, d.lead.phone, d.subject?.title, d.subject?.ref, d.subject?.subtitle]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle))
      )
    }
    // The one filter a deal board actually needs: what is going wrong.
    if (onlyAlerts) out = out.filter((d) => dealAlert(d) !== null)
    return out
  }, [deals, q, onlyAlerts])

  const alertCount = useMemo(() => deals.filter((d) => dealAlert(d) !== null).length, [deals])

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
        <button
          onClick={() => setOnlyAlerts((v) => !v)}
          disabled={alertCount === 0}
          className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 ${
            onlyAlerts
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          Needs attention {alertCount > 0 && <span className="opacity-70">{alertCount}</span>}
        </button>

        <div className="flex-1" />

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

      {/* Phone: pick a column, then read it full width. The chips double as the
          pipeline summary you'd otherwise have to scroll sideways to get. */}
      <div className="lg:hidden pg-scroll-x -mx-1 flex gap-1.5 px-1 pb-1">
        {DEAL_COLUMNS.map((col) => {
          const count = filtered.filter((d) => dealColumnOf(d) === col.key).length
          const active = mobileColumn === col.key
          return (
            <button
              key={col.key}
              onClick={() => setMobileColumn(col.key)}
              className={`pg-snap-start inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${col.accent}`} />
              {col.label}
              <span className={active ? 'text-white/70' : 'text-slate-400'}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2.5 pb-3 max-lg:flex-col lg:pg-scroll-x">
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
              className={`rounded-xl border transition-colors lg:pg-snap-start lg:w-[264px] lg:shrink-0 ${
                mobileColumn === col.key ? 'max-lg:block' : 'max-lg:hidden'
              } ${
                over === col.key ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-slate-50/60'
              }`}
            >
              <div className="p-2.5 border-b border-slate-200 max-lg:hidden">
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

              <p className="px-2.5 pt-2 text-[11px] text-slate-400 lg:hidden">{col.hint}</p>

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
                    onMove={onMove}
                    onRemove={onRemoveDeal}
                  />
                ))}

                {cards.length === 0 && (
                  col.key === 'SUGGESTED' && !q && !onlyAlerts ? (
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
  deal: d, canSeeMoney, busy, onDragStart, onOpenClient, onSetCommission, onMove, onRemove,
}: {
  deal: Deal
  canSeeMoney: boolean
  busy: boolean
  onDragStart: () => void
  onOpenClient: (leadId: string) => void
  onSetCommission: (dealId: string, usd: number) => void
  /** Touch has no drag-and-drop, so a phone moves deals with this instead. */
  onMove: (dealId: string, stage: OpportunityStage) => void
  onRemove: (deal: Deal) => void
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
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0 mt-0.5" />
        ) : (
          // Removing THIS deal. The client is never touched from here.
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(d) }}
            className="shrink-0 -mt-0.5 -mr-0.5 p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
            title="Remove this deal (keeps the client)"
          >
            <X className="h-3 w-3" />
          </button>
        )}
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

      {/* Moving a deal on a phone. HTML5 drag-and-drop emits no events on touch,
          so without this the board is read-only on the device it is most often
          opened on. Desktop keeps dragging and shows the stage as a label. */}
      <div className="mt-1.5 lg:hidden" onClick={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Stage for {d.subject?.title ?? 'this deal'}</span>
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
          <select
            value={d.stage}
            disabled={busy}
            onChange={(e) => onMove(d.id, e.target.value as OpportunityStage)}
            className="min-h-9 w-full rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            {DEAL_COLUMNS.map((c) => (
              <option key={c.key} value={c.stage}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Reaching them shouldn't need the drawer */}
      <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] text-slate-300 flex-1 max-lg:hidden">{STAGE_LABELS[d.stage]}</span>
        <span className="flex-1 lg:hidden" />
        {d.lead.phone && (
          <a
            href={`tel:${d.lead.phone}`}
            aria-label={`Call ${d.lead.name}`}
            className="flex h-9 w-9 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-900 lg:h-auto lg:w-auto lg:p-1"
          >
            <Phone className="h-4 w-4 lg:h-3 lg:w-3" />
          </a>
        )}
        {phone && (
          <a
            href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            aria-label={`WhatsApp ${d.lead.name}`}
            className="flex h-9 w-9 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-emerald-600 lg:h-auto lg:w-auto lg:p-1"
          >
            <MessageCircle className="h-4 w-4 lg:h-3 lg:w-3" />
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
