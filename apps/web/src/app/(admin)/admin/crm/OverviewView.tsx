'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, TrendingUp, Users, CalendarCheck, MessageSquareWarning, Zap,
  Snowflake, Building2, Trophy, AlertTriangle,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { SUB_STATUS_META, TYPE_LABELS, type LeadSubStatus, type LeadType } from './types'
import { countryFlag } from '@/lib/market'

/**
 * The state of the business on one screen.
 *
 * Distinct from Today, which is a to-do list. This answers "how are we doing"
 * — what's in motion, where clients are stuck, what's selling.
 * Every number is either something to act on or something you'd be asked
 * about; nothing is here because it was easy to count.
 */

interface Overview {
  pipeline: Record<string, number>
  byMarket: Record<string, number>
  byType: Record<string, number>
  waitingOn: Record<string, number>
  inMotion: { liveDeals: number; viewingsBooked: number; feedbackOwed: number }
  needsAttention: { neverCalled: number; goingCold: number }
  wonThisMonth: number
  projectStock: Array<{
    buildingId: string; ref: string | null; title: string; country: string
    kind: string; name: string | null; sold: number
  }>
}

export function OverviewView({ onFocus }: { onFocus: (view: 'today' | 'board') => void }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [d, setD] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/crm/overview`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) setD((await res.json()).data ?? null)
    } finally { setLoading(false) }
  }, [apiUrl])
  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }
  if (!d) return null

  const openClients = Object.entries(d.pipeline)
    .filter(([k]) => !['WON', 'LOST', 'ARCHIVED'].includes(k))
    .reduce((t, [, n]) => t + n, 0)

  const attention =
    d.needsAttention.neverCalled + d.needsAttention.goingCold

  return (
    <div className="space-y-3">
      {/* The four numbers worth knowing before anything else */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Open clients" value={openClients}
          hint={`${d.byMarket.LEBANON ?? 0} 🇱🇧 · ${d.byMarket.GEORGIA ?? 0} 🇬🇪`}
          icon={<Users className="h-4 w-4" />} tone="slate"
        />
        <Stat
          label="Deals in motion" value={d.inMotion.liveDeals}
          hint={`${d.inMotion.viewingsBooked} viewing${d.inMotion.viewingsBooked === 1 ? '' : 's'} booked`}
          icon={<TrendingUp className="h-4 w-4" />} tone="sky"
        />
        <Stat
          label="Closed this month" value={d.wonThisMonth}
          hint="deals won"
          icon={<Trophy className="h-4 w-4" />} tone="emerald"
        />
        <Stat
          label="Needs attention" value={attention}
          hint={attention === 0 ? 'all clear' : 'uncalled or going cold'}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={attention > 0 ? 'red' : 'slate'}
          onClick={() => onFocus('today')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* What's slipping */}
        <Panel title="What's slipping" hint="Left alone, these become lost business">
          <Row
            label="Never called" value={d.needsAttention.neverCalled}
            icon={<Zap className="h-3.5 w-3.5 text-red-600" />} onClick={() => onFocus('today')}
          />
          <Row
            label="Going cold (3+ weeks)" value={d.needsAttention.goingCold}
            icon={<Snowflake className="h-3.5 w-3.5 text-slate-400" />} onClick={() => onFocus('today')}
          />
          <Row
            label="Viewing feedback owed" value={d.inMotion.feedbackOwed}
            icon={<MessageSquareWarning className="h-3.5 w-3.5 text-amber-600" />} onClick={() => onFocus('today')}
          />
        </Panel>

        {/* Why open clients are still open */}
        <Panel title="What clients are waiting on" hint="Why they haven't closed yet">
          {Object.entries(d.waitingOn)
            .filter(([k, n]) => k !== 'NONE' && n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <Row
                key={k}
                label={SUB_STATUS_META[k as LeadSubStatus]?.label ?? k}
                value={n}
                onClick={() => onFocus('board')}
              />
            ))}
          {d.waitingOn.NONE > 0 && (
            <Row label="Not set" value={d.waitingOn.NONE} muted onClick={() => onFocus('board')} />
          )}
        </Panel>

        {/* Who we're working with */}
        <Panel title="Who's on the books" hint="Open clients by side of the deal">
          {Object.entries(d.byType)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <Row key={k} label={TYPE_LABELS[k as LeadType] ?? k} value={n} onClick={() => onFocus('board')} />
            ))}
        </Panel>

        {/* Repeatable types — the shape of a development we broker */}
        <Panel
          title="Unit types you sell"
          hint="Templates many clients buy, and how many have closed on each"
        >
          {d.projectStock.length === 0 ? (
            <p className="text-xs text-slate-400 px-3.5 py-3">
              None yet. Tick &ldquo;This is a unit type&rdquo; on a unit in a development, and
              every client can be matched to it.
            </p>
          ) : (
            d.projectStock.slice(0, 10).map((p) => (
              <div key={p.buildingId + p.kind} className="flex items-center gap-1.5 px-3.5 py-2">
                <span className="text-[11px]">{countryFlag(p.country)}</span>
                {p.ref && <span className="font-mono text-[10px] font-semibold text-slate-400">{p.ref}</span>}
                <span className="text-sm text-slate-800 truncate flex-1">
                  {p.title}
                  <span className="text-slate-400"> · {p.name || p.kind}</span>
                </span>
                <span className={`text-xs font-semibold ${p.sold > 0 ? 'text-emerald-700' : 'text-slate-300'}`}>
                  {p.sold} sold
                </span>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  )
}

const TONES: Record<string, string> = {
  slate: 'text-slate-600 bg-slate-100',
  sky: 'text-sky-700 bg-sky-100',
  emerald: 'text-emerald-700 bg-emerald-100',
  red: 'text-red-700 bg-red-100',
}

function Stat({
  label, value, hint, icon, tone, onClick,
}: {
  label: string; value: number; hint?: string
  icon: React.ReactNode; tone: keyof typeof TONES; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-white border border-slate-200 rounded-xl p-3.5 ${
        onClick ? 'hover:border-slate-300 hover:shadow-sm transition-all' : 'cursor-default'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`p-1.5 rounded-lg ${TONES[tone]}`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-1.5">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </button>
  )
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-slate-300" /> {title}
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </section>
  )
}

function Row({
  label, value, icon, muted, onClick,
}: {
  label: string; value: number; icon?: React.ReactNode; muted?: boolean; onClick?: () => void
}) {
  // Zero is good news here, so it's dimmed rather than shouting.
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-slate-50 text-left"
    >
      {icon}
      <span className={`text-sm flex-1 ${muted ? 'text-slate-400' : 'text-slate-700'}`}>{label}</span>
      <span className={`text-sm font-semibold ${value === 0 ? 'text-slate-300' : 'text-slate-900'}`}>
        {value}
      </span>
    </button>
  )
}
