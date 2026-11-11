'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Phone, MessageCircle, Mail, MapPin, StickyNote, Home, Handshake, Users,
} from 'lucide-react'
import {
  type Lead, type LeadType, TYPE_LABELS, TYPE_META, STATUS_META,
  formatLastContact, isPastClient, isReturningClient, formatPlanned, hasAwaitingFeedback, isWaitingOnUs,
} from './types'
import { countryFlag } from '@/lib/market'

/**
 * Every client, buyers and sellers together, with what they bought or sold.
 *
 * The board answers "where is this deal"; this answers "who do I know". It's
 * the screen you open to look someone up. One "Show" row picks the group
 * (active by default, so the 100-odd records nobody has spoken to in months
 * stay out of the way), and two selects narrow and order it. It used to open
 * with four focus chips, an intent toggle and a second toggle all at once.
 */

type Show = 'active' | 'hold' | 'quiet' | 'dormant' | 'past' | 'lost' | 'noise' | 'all'
type Need = 'any' | 'followup' | 'feedback' | 'options' | 'untapped' | 'flagged'
type Sort = 'recent' | 'contact' | 'newest' | 'name'

const CLOSED = ['WON', 'LOST', 'ARCHIVED']
const SHOWS: Array<{ key: Show; label: string; hint: string }> = [
  { key: 'active', label: 'Active', hint: 'Something happening: a live deal, a chat or call in the last 30 days, a follow-up planned, or new' },
  { key: 'hold', label: 'On hold', hint: 'Checking something for them, or parked' },
  { key: 'quiet', label: 'Gone quiet', hint: 'Moved off the board as not answering. They come back when they write' },
  { key: 'dormant', label: 'Dormant', hint: 'Still open, nothing in 30 days' },
  { key: 'past', label: 'Past clients', hint: 'Bought or sold with us' },
  { key: 'lost', label: 'Lost', hint: 'Said no' },
  { key: 'noise', label: 'Noise & parked', hint: 'Never replied. Back by themselves if they write' },
  { key: 'all', label: 'Everyone', hint: 'Every record' },
]

export function ClientDirectory({
  leads, canSeeMoney, onOpen, search, untapped = {}, quietIds, holdIds, initialShow,
}: {
  leads: Lead[]
  canSeeMoney: boolean
  onOpen: (id: string) => void
  /** The page's single search box. The directory doesn't own one. */
  search: string
  /** leadId -> strong matches nobody has shortlisted yet. */
  untapped?: Record<string, number>
  /** Clients in the board's hidden Gone quiet bucket, and those on hold. */
  quietIds: Set<string>
  holdIds: Set<string>
  /** From the URL: ?show=quiet, or the older ?status=LOST / ARCHIVED. */
  initialShow?: string | null
}) {
  const [show, setShow] = useState<Show>('active')
  const [need, setNeed] = useState<Need>('any')
  const [sort, setSort] = useState<Sort>('recent')
  useEffect(() => {
    if (initialShow && SHOWS.some((x) => x.key === initialShow)) setShow(initialShow as Show)
  }, [initialShow])

  const inShow = useMemo(() => {
    const open = (l: Lead) => !CLOSED.includes(l.status)
    const tests: Record<Show, (l: Lead) => boolean> = {
      active: (l) => open(l) && l.active !== false,
      hold: (l) => holdIds.has(l.id) || Boolean(l.holdAt && open(l)),
      quiet: (l) => quietIds.has(l.id),
      dormant: (l) => open(l) && l.active === false,
      past: (l) => isPastClient(l),
      lost: (l) => l.status === 'LOST',
      noise: (l) => l.status === 'ARCHIVED',
      all: () => true,
    }
    return tests
  }, [quietIds, holdIds])

  const showCounts = useMemo(
    () => Object.fromEntries(SHOWS.map((x) => [x.key, leads.filter(inShow[x.key]).length])) as Record<Show, number>,
    [leads, inShow],
  )

  const needTests: Record<Need, (l: Lead) => boolean> = {
    any: () => true,
    followup: (l) => Boolean(formatPlanned(l.nextContactAt)?.due),
    feedback: hasAwaitingFeedback,
    options: isWaitingOnUs,
    untapped: (l) => (untapped[l.id] ?? 0) > 0,
    flagged: (l) => Boolean(l.flaggedAt),
  }
  const grouped = useMemo(() => leads.filter(inShow[show]), [leads, inShow, show])
  const needCounts = Object.fromEntries(
    (Object.keys(needTests) as Need[]).map((k) => [k, grouped.filter(needTests[k]).length]),
  ) as Record<Need, number>

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const out = grouped.filter((l) => {
      if (!needTests[need](l)) return false
      if (!needle) return true
      // Searching a directory means name, number, area, or what they wanted.
      return [
        l.name, l.phone, l.whatsapp, l.email, l.askingFor, l.notes,
        ...(l.areas ?? []),
        ...(l.deals ?? []).map((d) => `${d.ref ?? ''} ${d.title} ${d.unitRef ?? ''}`),
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    })
    const time = (v?: string | null) => (v ? new Date(v).getTime() : 0)
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'newest') out.sort((a, b) => time(b.createdAt) - time(a.createdAt))
    else if (sort === 'contact') out.sort((a, b) => time(b.lastContactAt) - time(a.lastContactAt))
    // 'recent': the API's order — last touched first.
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, search, need, sort, untapped])

  const sel = 'min-h-11 sm:min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10'

  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-2">
        {/* Which group. Scrolls sideways on a phone rather than wrapping into four rows. */}
        <div className="pg-scroll-x flex gap-1 [&>*]:shrink-0">
          {SHOWS.map((x) => (
            <button
              key={x.key}
              onClick={() => setShow(x.key)}
              title={x.hint}
              className={`min-h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                show === x.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {x.label}{' '}
              <span className={show === x.key ? 'text-white/70' : 'text-slate-400'}>{showCounts[x.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          <p className="flex-1 min-w-[12rem] px-1 text-[11px] text-slate-500">{SHOWS.find((x) => x.key === show)?.hint}</p>
          <select value={need} onChange={(e) => setNeed(e.target.value as Need)} className={sel} aria-label="Needs">
            <option value="any">Any</option>
            <option value="followup">Follow-up due ({needCounts.followup})</option>
            <option value="feedback">Viewing feedback owed ({needCounts.feedback})</option>
            <option value="options">Needs new options ({needCounts.options})</option>
            <option value="untapped">Matches to explore ({needCounts.untapped})</option>
            <option value="flagged">Flagged ({needCounts.flagged})</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={sel} aria-label="Sort">
            <option value="recent">Recently touched</option>
            <option value="contact">Last contact</option>
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Users className="h-10 w-10 mx-auto text-slate-200 mb-2" />
          <p className="text-sm text-slate-500">
            {search ? `Nobody matches “${search}” here.` : need !== 'any' ? 'Nobody here needs that.' : 'Nobody here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] text-slate-500">{rows.length} {rows.length === 1 ? 'client' : 'clients'}</p>
          {rows.map((l) => (
            <ClientRow key={l.id} lead={l} canSeeMoney={canSeeMoney} onOpen={onOpen} held={holdIds.has(l.id) || Boolean(l.holdAt)} quiet={quietIds.has(l.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientRow({
  lead: l, canSeeMoney, onOpen, held = false, quiet = false,
}: {
  lead: Lead; canSeeMoney: boolean; onOpen: (id: string) => void; held?: boolean; quiet?: boolean
}) {
  const last = formatLastContact(l.lastContactAt)
  const phone = l.whatsapp || l.phone
  const deals = l.deals ?? []
  const sold = l.soldProperties ?? []
  const earned = canSeeMoney
    ? [...deals, ...sold].reduce((t, d) => t + (d.commissionUsd ?? 0), 0)
    : 0

  return (
    <div
      onClick={() => onOpen(l.id)}
      className="bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{l.name}</span>
            {/* Every intent, not just the primary one — somebody selling a flat
                and hunting a smaller one is one client with two jobs. */}
            {(l.intents?.length ? l.intents : [l.type]).map((t) => (
              <span key={t} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_META[t].chip}`}>
                {TYPE_LABELS[t as LeadType]}
              </span>
            ))}
            {isReturningClient(l) && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                Returning
              </span>
            )}
            {l.isInvestor && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Investor
              </span>
            )}
            <span className="text-[11px]">{l.market === 'LEBANON' ? '🇱🇧' : '🌍'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_META[l.status].cls}`}>
              {STATUS_META[l.status].label}
            </span>
            {held && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200" title={l.holdNote ?? undefined}>
                {l.holdKind === 'PARKED' ? 'Parked' : 'Checking'}{l.holdNote ? `: ${l.holdNote}` : ''}
              </span>
            )}
            {quiet && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Gone quiet</span>}
            {l.active === false && !['WON', 'LOST', 'ARCHIVED'].includes(l.status) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200">Dormant</span>
            )}
            {l.flaggedAt && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Flagged</span>}
          </div>

          <p className="text-sm text-slate-600 mt-0.5">
            {l.askingFor || l.unitKinds.join(', ') || '—'}
            {l.areas.length > 0 && (
              <span className="text-slate-400 inline-flex items-center gap-1 ml-2">
                <MapPin className="h-3 w-3" />{l.areas.slice(0, 3).join(', ')}
              </span>
            )}
          </p>

          {/* What they actually bought or sold — the thing you look up */}
          {(deals.length > 0 || sold.length > 0) && (
            <div className="mt-1.5 space-y-0.5">
              {deals.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5 text-xs">
                  <Home className="h-3 w-3 text-emerald-600 shrink-0" />
                  {d.ref && <span className="font-mono text-[10px] font-semibold text-slate-400">{d.ref}</span>}
                  <span className="text-slate-700 truncate">{d.title}</span>
                  {d.unitRef && <span className="text-slate-500">· {d.unitRef}</span>}
                  {canSeeMoney && d.soldPrice != null && (
                    <span className="text-emerald-700 font-medium">
                      {d.soldCurrency} {d.soldPrice.toLocaleString()}
                    </span>
                  )}
                  {d.closedAt && (
                    <span className="text-slate-400">
                      {new Date(d.closedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
              {sold.map((p) => (
                <div key={p.id} className="flex items-center gap-1.5 text-xs">
                  <Handshake className="h-3 w-3 text-amber-600 shrink-0" />
                  <span className="text-slate-700 truncate">Sold {p.title || p.kind}</span>
                  {canSeeMoney && p.soldPrice != null && (
                    <span className="text-emerald-700 font-medium">
                      ${p.soldPrice.toLocaleString()}
                    </span>
                  )}
                  {p.soldAt && (
                    <span className="text-slate-400">
                      {new Date(p.soldAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Your own note about them, at a glance */}
          {l.notes && (
            <p className="text-xs text-slate-500 mt-1.5 flex items-start gap-1.5">
              <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-amber-400" />
              <span className="line-clamp-2">{l.notes}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {earned > 0 && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              ${earned.toLocaleString()}
            </span>
          )}
          <span className="text-[11px] text-slate-500 hidden sm:block">{last.text}</span>
          {l.phone && (
            <a href={`tel:${l.phone}`} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900">
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {phone && (
            <a
              href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
              target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-600"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          {l.email && (
            <a href={`mailto:${l.email}`} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900">
              <Mail className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
