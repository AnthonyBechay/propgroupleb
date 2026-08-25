'use client'

import { useMemo, useState } from 'react'
import {
  Phone, MessageCircle, Mail, MapPin, StickyNote, Home, Handshake,
  Users, CheckCircle2,
} from 'lucide-react'
import {
  type Lead, type LeadType, TYPE_LABELS, TYPE_META, STATUS_META,
  formatLastContact, isSupplyType, isPastClient, isReturningClient, hasClosedBefore,
} from './types'
import { countryFlag } from '@/lib/market'

/**
 * Every client, buyers and sellers together, with what they bought or sold.
 *
 * The board answers "where is this deal"; this answers "who do I know". It's
 * the screen you open to look someone up — so it favours completeness and
 * search over pipeline mechanics, and shows closed business rather than hiding
 * it once a deal is done.
 */
export function ClientDirectory({
  leads,
  canSeeMoney,
  onOpen,
  search,
}: {
  leads: Lead[]
  canSeeMoney: boolean
  onOpen: (id: string) => void
  /** The page's single search box. The directory doesn't own one. */
  search: string
}) {
  const q = search
  const [side, setSide] = useState<'all' | 'demand' | 'supply'>('all')
  // Working with them now, or someone who already bought? Two different jobs.
  const [group, setGroup] = useState<'active' | 'past' | 'all'>('active')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return leads
      .filter((l) => {
        if (side !== 'all') {
          const supply = isSupplyType(l.type)
          if (side === 'supply' ? !supply : supply) return false
        }
        if (group !== 'all') {
          const past = isPastClient(l)
          if (group === 'past' ? !past : past) return false
        }
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
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [leads, q, side, group])

  const pastCount = leads.filter(isPastClient).length
  const activeCount = leads.length - pastCount

  return (
    <div className="space-y-3">
      {/* Directory controls — separate from the board's pipeline filters */}
      <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-2">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([
            ['all', 'Any intent'],
            ['demand', 'Buying / renting'],
            ['supply', 'Selling / letting'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setSide(v)}
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                side === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* The primary split: people you're working with vs people who already
            bought. Mixing them is what made everyone look "active". */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([
            ['active', `Working with (${activeCount})`],
            ['past', `Past clients (${pastCount})`],
            ['all', 'Everyone'],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setGroup(v)}
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                group === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Users className="h-10 w-10 mx-auto text-slate-200 mb-2" />
          <p className="text-sm text-slate-500">
            {q
            ? `Nobody matches “${q}”.`
            : group === 'past'
              ? 'Nobody has bought or sold with you yet.'
              : 'No active clients.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((l) => (
            <ClientRow key={l.id} lead={l} canSeeMoney={canSeeMoney} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClientRow({
  lead: l, canSeeMoney, onOpen,
}: {
  lead: Lead; canSeeMoney: boolean; onOpen: (id: string) => void
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
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_META[l.type].chip}`}>
              {TYPE_LABELS[l.type as LeadType]}
            </span>
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
            <span className="text-[11px]">{countryFlag(l.market === 'GEORGIA' ? 'GEORGIA' : 'LEBANON')}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_META[l.status].cls}`}>
              {STATUS_META[l.status].label}
            </span>
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
          <span className="text-[11px] text-slate-400 hidden sm:block">{last.text}</span>
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
