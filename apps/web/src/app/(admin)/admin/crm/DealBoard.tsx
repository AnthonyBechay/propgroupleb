'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Phone, MessageCircle, Calendar, AlertCircle, Handshake,
  TrendingUp, Loader2, Check, Plus, X, ChevronRight, ChevronDown, MessagesSquare, Instagram, Clock, VolumeX,
} from 'lucide-react'
import {
  type Deal, type OpportunityStage, BOARD_DEAL_COLUMNS, CLIENT_COLUMNS, type PipelineClient, dealColumnOf, stageLabel,
  dealCommission, dealAlert, isLiveDeal, TYPE_LABELS,
} from './types'
import { countryFlag } from '@/lib/market'
import type { StartStage } from './BookViewingModal'

/**
 * Where a person card can go: onto a property deal at a stage (which asks for
 * the property), snoozed for some days, or off the board as noise / not interested.
 */
export type ClientMove = StartStage | 'NOISE' | 'LOST' | `PING:${number}`

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
  clientsWithNoDeal,
  onShowClients,
  onOpenChat,
  clients,
  onBook,
}: {
  /** People at the front of the pipeline, before any viewing or meeting. */
  clients: PipelineClient[]
  /** Start a deal for this client at a stage (picking the property), or mark them not interested. */
  onBook: (leadId: string, to: ClientMove) => void
  /** Jump to this client's conversation in the Inbox. */
  onOpenChat: (leadId: string) => void
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
  /** Clients with no deal at all — invisible on a board made of deals. */
  clientsWithNoDeal: number
  onShowClients: () => void
}) {
  const q = search
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  // Below `lg` the board shows one column at a time. Seven 264px columns in a
  // horizontal scroller is a kanban on paper and a swipe-hunt in practice: on a
  // 390px screen you can see one and a half of them and you cannot tell where
  // the pipeline is without scrolling the whole way across.
  const [mobileColumn, setMobileColumn] = useState<string>(CLIENT_COLUMNS[0].key)

  const visibleClients = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return clients
    return clients.filter((c) =>
      [c.name, c.askingFor, c.adLabel, c.chat?.lastPreview].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
    )
  }, [clients, q])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    // Shortlisted properties are counted on the client's card, not shown as deals.
    let out = deals.filter((d) => BOARD_DEAL_COLUMNS.some((c) => c.stages.includes(d.stage)))
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
        {([['People', CLIENT_COLUMNS], ['Deals', BOARD_DEAL_COLUMNS]] as const).map(([group, cols]) => (
          <span key={group} className="contents">
            <span className="self-center shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group}</span>
            {cols.map((col) => {
              const count = 'stages' in col
                ? filtered.filter((d) => dealColumnOf(d) === col.key).length
                : visibleClients.filter((c) => c.bucket === col.key).length
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
          </span>
        ))}
      </div>

      <div className="flex gap-2.5 pb-3 max-lg:flex-col lg:pg-scroll-x">
        {/* Two halves, said on screen: people (before any property is in play)
            and deals (one card per property). They used to run together as one
            row of ten columns, with nothing saying where one became the other. */}
        <section className="contents lg:flex lg:flex-col lg:gap-1.5 lg:shrink-0">
          <p className="max-lg:hidden px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            People <span className="font-normal normal-case tracking-normal text-slate-400">· who owes the next message</span>
          </p>
          <div className="contents lg:flex lg:gap-2.5">
        {CLIENT_COLUMNS.map((col) => {
          const cards = visibleClients.filter((c) => c.bucket === col.key)
          return (
            <div
              key={col.key}
              // A person dropped on "Ping later" is snoozed for a week.
              {...(col.key === 'PING_LATER' ? {
                onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(col.key) },
                onDragLeave: () => setOver((k) => (k === col.key ? null : k)),
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault()
                  setOver(null)
                  const id = e.dataTransfer.getData('text/plain') || dragging
                  setDragging(null)
                  if (id?.startsWith('client:')) onBook(id.slice(7), 'PING:7')
                },
              } : {})}
              className={`rounded-xl border lg:pg-snap-start lg:w-[264px] lg:shrink-0 ${
                over === col.key ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-slate-50/60'
              } ${
                mobileColumn === col.key ? 'max-lg:block' : 'max-lg:hidden'
              }`}
            >
              <div className="p-2.5 border-b border-slate-200 max-lg:hidden">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                  <span className="text-sm font-semibold text-slate-900">{col.label}</span>
                  <span className="text-xs text-slate-500">{cards.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{col.hint}</p>
              </div>
              <p className="px-2.5 pt-2 text-[11px] text-slate-500 lg:hidden">{col.hint}</p>
              <div className="p-1.5 space-y-1.5 min-h-[120px]">
                {cards.map((c) => (
                  <ClientCard key={c.id} client={c} onOpenClient={onOpenClient} onOpenChat={onOpenChat} onBook={onBook} onDragStart={() => setDragging(`client:${c.id}`)} />
                ))}
                {cards.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Nobody here</p>}
              </div>
            </div>
          )
        })}

          </div>
        </section>

        <div className="max-lg:hidden w-px shrink-0 self-stretch bg-slate-300 my-1" aria-hidden />

        <section className="contents lg:flex lg:flex-col lg:gap-1.5 lg:shrink-0">
          <p className="max-lg:hidden px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Deals <span className="font-normal normal-case tracking-normal text-slate-400">· one card per property</span>
          </p>
          <div className="contents lg:flex lg:gap-2.5">
        {BOARD_DEAL_COLUMNS.map((col) => {
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
                // A person dropped on a deal column: which property is it about?
                if (id.startsWith('client:')) {
                  if (col.stage !== 'WON') onBook(id.slice(7), col.stage as StartStage)
                  return
                }
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
                  <span className="text-xs text-slate-500">{cards.length}</span>
                  {canSeeMoney && value > 0 && (
                    <span className="ml-auto text-[11px] font-medium text-slate-500">
                      ${value.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{col.hint}</p>
              </div>

              <p className="px-2.5 pt-2 text-[11px] text-slate-500 lg:hidden">{col.hint}</p>

              <div className="p-1.5 space-y-1.5 min-h-[120px]">
                {cards.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    canSeeMoney={canSeeMoney}
                    busy={busyId === d.id}
                    onDragStart={() => setDragging(d.id)}
                    onOpenClient={onOpenClient}
                    onOpenChat={onOpenChat}
                    onSetCommission={onSetCommission}
                    onAction={(deal, action) => {
                      if (action === 'DELETE') onRemoveDeal(deal)
                      else if (action === 'CLIENT_LOST') onBook(deal.lead.id, 'LOST')
                      else onMove(deal.id, action)
                    }}
                  />
                ))}

                {cards.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-6">Nothing here</p>
                )}
              </div>
            </div>
          )
        })}
          </div>
        </section>
      </div>
    </div>
  )
}

const sinceLabel = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hours = Math.round(mins / 60)
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

/** A person at the front of the pipeline — before any viewing or meeting. */
function ClientCard({
  client: c, onOpenClient, onOpenChat, onBook, onDragStart,
}: {
  client: PipelineClient
  onOpenClient: (leadId: string) => void
  onOpenChat: (leadId: string) => void
  onBook: (leadId: string, to: ClientMove) => void
  onDragStart: () => void
}) {
  // Abroad, the next step is a meeting at the office; in Lebanon, a viewing.
  const meeting = c.market !== 'LEBANON'
  // "Form 918167797875002" is a Meta id, not something anyone recognises.
  const adName = c.adLabel && !/^form \d+$/i.test(c.adLabel.trim()) ? c.adLabel : null
  const from = c.lastFrom === 'assistant' ? 'Assistant: ' : c.lastFrom === 'team' ? 'You: ' : ''
  return (
    <div
      onClick={() => onOpenClient(c.id)}
      // On a computer a person can be dragged onto a deal column; on a phone, the Move menu below.
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', `client:${c.id}`); onDragStart() }}
      className="bg-white border border-slate-200 rounded-lg p-2.5 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[11px] shrink-0 mt-0.5">{countryFlag(c.market)}</span>
        <span className="text-sm font-medium text-slate-900 leading-snug truncate flex-1">{c.name}</span>
        {c.chat && (
          c.chat.channel === 'INSTAGRAM'
            ? <Instagram className="h-3.5 w-3.5 text-pink-600 shrink-0 mt-0.5" aria-label="Instagram" />
            : <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-label="WhatsApp" />
        )}
        {c.waitingSince && (
          <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-semibold" title="Waiting for a reply">
            {sinceLabel(c.waitingSince)}
          </span>
        )}
      </div>
      {(c.askingFor || adName) && (
        <p className="text-[11px] text-slate-700 truncate mt-0.5">{c.askingFor ?? `From the ad: ${adName}`}</p>
      )}
      {c.chat?.lastPreview ? (
        <p className="text-xs text-slate-600 line-clamp-2 mt-1">
          {from && <span className="font-medium text-slate-700">{from}</span>}
          {c.chat.lastPreview}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500 mt-1">{c.source === 'FACEBOOK_AD' ? 'Lead form — no chat yet' : 'No chat yet'}</p>
      )}
      {c.bucket === 'PING_LATER' && c.pingAt && (
        <p className="text-[11px] text-sky-800 mt-1">
          Ping {new Date(c.pingAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}{c.reason ? ` — ${c.reason}` : ''}
        </p>
      )}
      {c.reason && c.bucket !== 'PING_LATER' && (
        <p className={`text-[11px] mt-1 ${c.bucket === 'TO_ANSWER' ? 'text-red-700 font-medium' : 'text-slate-600'}`}>{c.reason}</p>
      )}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100 flex-wrap">
        {c.shortlisted > 0 && (
          <span className="text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
            {c.shortlisted} {c.shortlisted === 1 ? 'property' : 'properties'} sent
          </span>
        )}
        {c.chat?.detailsToConfirm && (
          <span className="text-[10px] font-medium text-amber-800 bg-amber-50 rounded px-1.5 py-0.5">Details to confirm</span>
        )}
        <span className="flex-1" />
        {c.chat && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChat(c.id) }}
            title={c.chat.unread > 0 ? `${c.chat.unread} unread — open the chat` : 'Open the chat'}
            className={`min-h-7 px-1.5 rounded-md inline-flex items-center gap-1 text-[11px] font-semibold ${
              c.chat.unread > 0 ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            {c.chat.unread > 0 && c.chat.unread}
          </button>
        )}
        <MoveMenu meeting={meeting} supplyOnly={c.supplyOnly} onPick={(to) => onBook(c.id, to)} />
      </div>
    </div>
  )
}

/**
 * The shell every card menu shares. It floats over the page (position: fixed)
 * because the board's columns scroll, and an absolute menu was cut off at their
 * edge. On a phone it is a sheet from the bottom instead: a tap nudges the
 * page's scroll, and a floating menu that closes on scroll was gone before a
 * thumb could reach it.
 */
function MenuShell({
  label, height, children,
}: {
  label: React.ReactNode
  /** Roughly how tall the menu is, to open it upwards when it would not fit below. */
  height: number
  children: (close: () => void) => React.ReactNode
}) {
  const [at, setAt] = useState<{ top: number; left: number } | 'sheet' | null>(null)
  const open = at !== null
  const ref = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const close = () => setAt(null)
  const toggle = () => {
    if (open) { setAt(null); return }
    if (window.innerWidth < 640) { setAt('sheet'); return }
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const width = 256
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8))
    const top = r.bottom + 4 + height < window.innerHeight ? r.bottom + 4 : Math.max(8, r.top - 4 - height)
    setAt({ top, left })
  }
  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAt(null) }
    document.addEventListener('mousedown', outside)
    if (at === 'sheet') return () => document.removeEventListener('mousedown', outside)
    // The floating menu is placed once; if the page moves, it would point at nothing.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', outside)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, at])

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={button}
        onClick={toggle}
        aria-expanded={open}
        className="min-h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
      >
        {label} <ChevronDown className="h-3 w-3" />
      </button>
      {at === 'sheet' && <div className="fixed inset-0 z-50 bg-black/30" onClick={close} />}
      {open && (
        <div
          style={at !== 'sheet' && at ? at : undefined}
          className={at === 'sheet'
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl'
            : 'fixed z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg'}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}

const MENU_ITEM = 'w-full min-h-10 px-2.5 rounded-md text-left text-sm hover:bg-slate-50 flex items-start gap-2 disabled:opacity-60 disabled:hover:bg-transparent'
const MENU_GROUP = 'px-2.5 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 first:pt-1'

function MenuItem({ icon, title, hint, onClick, disabled, current }: {
  icon: React.ReactNode; title: string; hint?: string; onClick: () => void; disabled?: boolean; current?: boolean
}) {
  return (
    <button className={MENU_ITEM} onClick={onClick} disabled={disabled}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1">
        <span className="block font-medium text-slate-900">{title}{current && <span className="ml-1.5 text-[11px] font-normal text-slate-500">· now</span>}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </button>
  )
}

/**
 * What to do next with a person. Three groups, in the order a conversation
 * goes: it becomes a deal, it waits, or it ends. It replaced a dropdown of
 * eleven entries that put "Met / discussed" next to "In 2 weeks".
 */
function MoveMenu({
  meeting, supplyOnly, onPick,
}: {
  /** Abroad the next step is a meeting at the office; in Lebanon, a viewing. */
  meeting: boolean
  supplyOnly: boolean
  onPick: (to: ClientMove) => void
}) {
  return (
    <MenuShell label="Move" height={supplyOnly ? 230 : 400}>
      {(close) => {
        const pick = (to: ClientMove) => { close(); onPick(to) }
        return (
          <>
            {!supplyOnly && (
              <>
                <p className={MENU_GROUP}>Next step</p>
                <MenuItem icon={<Calendar className="h-4 w-4 text-violet-600" />} title={meeting ? 'Book a meeting' : 'Book a viewing'} hint="Pick the property and the date" onClick={() => pick('VIEWING_BOOKED')} />
                <MenuItem icon={<Handshake className="h-4 w-4 text-amber-600" />} title="Negotiating" hint="They want a property — price or terms open" onClick={() => pick('INTERESTED')} />
                <MenuItem icon={<Check className="h-4 w-4 text-teal-600" />} title="Reserved / paying" hint="They committed to a property" onClick={() => pick('RESERVED')} />
              </>
            )}
            <p className={MENU_GROUP}>Not now</p>
            <div className="px-2.5 pb-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900"><Clock className="h-4 w-4 text-sky-600" /> Ping later</span>
              <div className="mt-1.5 flex gap-1">
                {([[3, '3 days'], [7, '1 week'], [30, '1 month']] as const).map(([days, label]) => (
                  <button key={days} onClick={() => pick(`PING:${days}`)} className="flex-1 min-h-8 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-200">
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className={MENU_GROUP}>Close</p>
            <MenuItem icon={<VolumeX className="h-4 w-4 text-slate-500" />} title="Noise" hint="Never replied — hide until they write" onClick={() => pick('NOISE')} />
            <MenuItem icon={<X className="h-4 w-4 text-red-600" />} title="Not interested" hint="They said no" onClick={() => pick('LOST')} />
          </>
        )
      }}
    </MenuShell>
  )
}

/** What a deal card can do — one menu, the same on a computer and a phone. */
export type DealAction = OpportunityStage | 'CLIENT_LOST' | 'DELETE'

/**
 * Moving a deal. It replaced a phone-only dropdown that offered stages the
 * board has no column for (a deal moved to "Details sent" vanished), and a
 * tiny ✕ that deleted the deal — and its history — when the usual meaning was
 * "they did not like this one".
 */
function DealMoveMenu({ deal: d, onPick }: { deal: Deal; onPick: (action: DealAction) => void }) {
  const current = dealColumnOf(d)
  return (
    <MenuShell label="Move" height={420}>
      {(close) => {
        const pick = (a: DealAction) => { close(); onPick(a) }
        return (
          <>
            <p className={MENU_GROUP}>Move to</p>
            {BOARD_DEAL_COLUMNS.map((col) => (
              <MenuItem
                key={col.key}
                icon={<span className={`block h-2.5 w-2.5 mt-1 rounded-full ${col.accent}`} />}
                title={col.key === 'NEGOTIATING' ? 'Negotiating' : stageLabel(col.stage, d.lead.market ?? d.subject?.country)}
                current={current === col.key}
                disabled={current === col.key}
                onClick={() => pick(col.stage)}
              />
            ))}
            <p className={MENU_GROUP}>It did not work out</p>
            <MenuItem icon={<X className="h-4 w-4 text-amber-600" />} title="Not this property" hint="Kept on record. The client stays — back with the people if it was their only deal" onClick={() => pick('REJECTED')} />
            <MenuItem icon={<X className="h-4 w-4 text-red-600" />} title="Client not interested" hint="They said no to everything — off the board" onClick={() => pick('CLIENT_LOST')} />
            <div className="mt-1 border-t border-slate-100 pt-1">
              <MenuItem icon={<X className="h-4 w-4 text-slate-400" />} title="Delete this deal" hint="Only if it was added by mistake — leaves no record" onClick={() => pick('DELETE')} />
            </div>
          </>
        )
      }}
    </MenuShell>
  )
}

function DealCard({
  deal: d, canSeeMoney, busy, onDragStart, onOpenClient, onOpenChat, onSetCommission, onAction,
}: {
  onOpenChat: (leadId: string) => void
  deal: Deal
  canSeeMoney: boolean
  busy: boolean
  onDragStart: () => void
  onOpenClient: (leadId: string) => void
  onSetCommission: (dealId: string, usd: number) => void
  /** Move it (also how a phone moves deals — touch has no drag-and-drop), drop it, or delete it. */
  onAction: (deal: Deal, action: DealAction) => void
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
        <p className="text-[11px] text-slate-500 truncate mt-0.5">{d.subject.subtitle}</p>
      )}

      {/* Who it's for */}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-100">
        <span className="text-xs font-medium text-slate-700 truncate flex-1">{d.lead.name}</span>
        <span className="text-[10px] text-slate-500 shrink-0">{TYPE_LABELS[d.lead.type]}</span>
        {d.chat && (
          // Their conversation — green with a count when they are waiting on us.
          <button
            onClick={(e) => { e.stopPropagation(); onOpenChat(d.lead.id) }}
            title={d.chat.unread > 0 ? `${d.chat.unread} unread — open the chat` : 'Open the chat'}
            className={`shrink-0 min-h-7 px-1.5 rounded-md inline-flex items-center gap-1 text-[11px] font-semibold ${
              d.chat.unread > 0 ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            {d.chat.unread > 0 && d.chat.unread}
          </button>
        )}
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
              className="text-[11px] text-slate-500 hover:text-slate-700 underline decoration-dotted"
            >
              Set commission
            </button>
          )}
        </div>
      )}

      {/* Reaching them shouldn't need the drawer */}
      <div className="flex items-center gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[11px] text-slate-500 flex-1">{stageLabel(d.stage, d.lead.market ?? d.subject?.country)}</span>
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
        <DealMoveMenu deal={d} onPick={(a) => onAction(d, a)} />
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
      <span className="text-[11px] text-slate-500">$</span>
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
