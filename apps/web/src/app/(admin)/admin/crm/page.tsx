'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UserSearch, Plus, Search, Loader2, Phone, MessageCircle, Mail, Clock,
  CalendarPlus, X, LayoutGrid, List, Download, Upload, MapPin,
  MessageSquareWarning, Sparkles, Target, DollarSign, Sun, BarChart3, Gauge,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { useAuth } from '@/contexts/AuthContext'
import { LeadDrawer } from './LeadDrawer'
import { LeadFormModal } from './LeadFormModal'
import { DealBoard } from './DealBoard'
import { ImportModal } from './ImportModal'
import { BookViewingModal } from './BookViewingModal'
import { TodayView } from './TodayView'
import { OverviewView } from './OverviewView'
import { ClientDirectory } from './ClientDirectory'
import {
  type Lead, type LeadMarket, type LeadType,
  type Deal, type OpportunityStage,
  STATUS_META, TYPE_LABELS, MARKET_META, formatLastContact, formatPlanned,
  isWaitingOnUs, hasAwaitingFeedback, SUB_STATUS_META,
} from './types'

interface ChannelRow {
  source: string
  leads: number
  won: number
  commissionUsd: number
  conversionPct: number
  commissionPerLead: number
}

interface Earnings {
  totalCommissionUsd: number
  buyerSide: { count: number; commissionUsd: number }
  sellerSide: { count: number; commissionUsd: number }
  bySource: ChannelRow[]
}

interface Stats {
  openLeads: number
  dueFollowUps: number
  byMarket: Record<string, number>
  byStatus: Record<string, number>
}

type View = 'overview' | 'today' | 'board' | 'list'

export default function CrmPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [leads, setLeads] = useState<Lead[]>([])
  // The pipeline is a list of deals, not of people — see DealBoard.
  const [deals, setDeals] = useState<Deal[]>([])
  const [movingDeal, setMovingDeal] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('today')
  const [market, setMarket] = useState<'all' | LeadMarket>('all')
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState<'none' | 'planned' | 'feedback' | 'options' | 'untapped'>('none')
  // leadId -> number of matches nobody has shortlisted yet (computed server-side)
  const [untapped, setUntapped] = useState<Record<string, number>>({})
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const { user } = useAuth()
  // A CRM_MANAGER gets 403 from /earnings by design — don't even ask.
  const canSeeMoney = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const [typeFilter, setTypeFilter] = useState<'all' | LeadType>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [bookingFor, setBookingFor] = useState<Lead | null>(null)
  // Starting a deal is "which client, then which property" — the client step.
  const [pickingClient, setPickingClient] = useState(false)
  // Carries the name typed in the picker straight into the new-client form.
  const [prefillName, setPrefillName] = useState('')
  const [showChannels, setShowChannels] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The board needs every open lead at once, so we always fetch broadly and
      // narrow client-side — keeps drag-and-drop instant.
      const p = new URLSearchParams({ limit: '500' })
      if (market !== 'all') p.set('market', market)
      if (search.trim()) p.set('search', search.trim())

      const [listRes, statsRes, untappedRes, earnRes, dealsRes] = await Promise.all([
        fetch(`${apiUrl}/api/crm?${p}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/stats`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/untapped`, { credentials: 'include', cache: 'no-store' }),
        canSeeMoney
          ? fetch(`${apiUrl}/api/crm/earnings?months=12`, { credentials: 'include', cache: 'no-store' })
          : Promise.resolve(null),
        fetch(`${apiUrl}/api/crm/deals?${p}`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (listRes.ok) setLeads((await listRes.json()).data ?? [])
      if (statsRes.ok) setStats((await statsRes.json()).data ?? null)
      if (untappedRes.ok) setUntapped((await untappedRes.json()).data?.counts ?? {})
      if (earnRes?.ok) setEarnings((await earnRes.json()).data ?? null)
      if (dealsRes.ok) setDeals((await dealsRes.json()).data ?? [])
    } finally {
      setLoading(false)
    }
  }, [apiUrl, market, search, canSeeMoney])

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const visible = useMemo(() => {
    let out = leads
    if (typeFilter !== 'all') out = out.filter((l) => l.type === typeFilter)
    if (focus === 'planned') out = out.filter((l) => formatPlanned(l.nextContactAt)?.due)
    else if (focus === 'feedback') out = out.filter(hasAwaitingFeedback)
    else if (focus === 'options') out = out.filter(isWaitingOnUs)
    else if (focus === 'untapped') out = out.filter((l) => (untapped[l.id] ?? 0) > 0)
    return out
  }, [leads, focus, typeFilter, untapped])

  // Live counts for the focus chips, computed from what's loaded.
  const counts = useMemo(() => ({
    planned: leads.filter((l) => formatPlanned(l.nextContactAt)?.due).length,
    feedback: leads.filter(hasAwaitingFeedback).length,
    options: leads.filter(isWaitingOnUs).length,
    untapped: leads.filter((l) => (untapped[l.id] ?? 0) > 0).length,
  }), [leads, untapped])

  /**
   * Move a deal to another stage. Optimistic, and it rolls back on failure —
   * a board that lies about where a deal is, is worse than a slow one.
   */
  async function moveDeal(dealId: string, stage: OpportunityStage) {
    const before = deals
    setMovingDeal(dealId)
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage } : d)))
    try {
      const res = await fetch(`${apiUrl}/api/crm/opportunities/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      if (!res.ok) throw new Error('rejected')
      const saved = (await res.json()).data
      if (saved) setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, ...saved } : d)))
      // Closing a deal changes the client's standing, so the other views need
      // the fresh figures.
      if (stage === 'WON') load()
    } catch {
      setDeals(before)
    } finally {
      setMovingDeal(null)
    }
  }

  /**
   * Drop one deal. Explicitly scoped to the deal — deleting the client is a
   * separate, louder action in the drawer.
   */
  async function removeDeal(deal: Deal) {
    const what = deal.subject?.title ?? 'this property'
    if (!confirm(`Remove ${what} from ${deal.lead.name}'s list?\n\nThe client and their other deals are not affected.`)) return
    const before = deals
    setDeals((prev) => prev.filter((d) => d.id !== deal.id))
    try {
      const res = await fetch(`${apiUrl}/api/crm/opportunities/${deal.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('rejected')
    } catch {
      setDeals(before)
    }
  }

  /** Record what we made, straight from the card. */
  async function setCommission(dealId: string, usd: number) {
    const before = deals
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, commissionUsd: usd } : d)))
    try {
      const res = await fetch(`${apiUrl}/api/crm/opportunities/${dealId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionUsd: usd }),
      })
      if (!res.ok) throw new Error('rejected')
    } catch {
      setDeals(before)
    }
  }

  const [exporting, setExporting] = useState(false)

  // Fetch + save as a blob rather than opening a tab: the auth cookie is sent
  // reliably, and a failure surfaces as a message instead of a blank tab
  // showing raw JSON.
  async function exportCsv() {
    setExporting(true)
    try {
      const p = new URLSearchParams()
      if (market !== 'all') p.set('market', market)
      const res = await fetch(`${apiUrl}/api/crm/export.csv?${p}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.message || j.error || `Export failed (${res.status})`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `propgroup-crm-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed — check your connection and try again.')
    } finally {
      setExporting(false)
    }
  }

  const openLead = leads.find((l) => l.id === openId) ?? null

  return (
    <div className="space-y-3">
      {/* One row: what needs attention on the left, actions on the right. The
          page title used to eat a whole row saying what the sidebar says. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className={`flex gap-2 flex-wrap ${['today', 'overview', 'board'].includes(view) ? 'invisible pointer-events-none' : ''}`}>
          <FocusChip
            active={focus === 'planned'} count={counts.planned}
            onClick={() => setFocus((f) => (f === 'planned' ? 'none' : 'planned'))}
            icon={<CalendarPlus className="h-4 w-4" />} tone="sky"
          >
            Follow-up due
          </FocusChip>
          <FocusChip
            active={focus === 'feedback'} count={counts.feedback}
            onClick={() => setFocus((f) => (f === 'feedback' ? 'none' : 'feedback'))}
            icon={<MessageSquareWarning className="h-4 w-4" />} tone="amber"
          >
            Viewing feedback
          </FocusChip>
          <FocusChip
            active={focus === 'options'} count={counts.options}
            onClick={() => setFocus((f) => (f === 'options' ? 'none' : 'options'))}
            icon={<Sparkles className="h-4 w-4" />} tone="indigo"
          >
            Needs new options
          </FocusChip>
          <FocusChip
            active={focus === 'untapped'} count={counts.untapped}
            onClick={() => setFocus((f) => (f === 'untapped' ? 'none' : 'untapped'))}
            icon={<Target className="h-4 w-4" />} tone="emerald"
          >
            Matches to explore
          </FocusChip>
          {focus !== 'none' && (
            <button onClick={() => setFocus('none')} className="text-xs text-slate-400 hover:text-slate-700 self-center inline-flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
          </button>
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Toolbar: search · type · market · view */}
      <div className="flex gap-2 flex-wrap items-center bg-white border border-slate-200 rounded-xl p-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, area, notes…"
            className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="all">Any intent</option>
          <option value="BUYER">Buying</option>
          <option value="SELLER">Selling</option>
          <option value="RENTER">Looking to rent</option>
          <option value="LANDLORD">Renting out</option>
        </select>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'LEBANON', 'GEORGIA'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                market === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m === 'all' ? `All (${stats?.openLeads ?? 0})` : `${MARKET_META[m].label} (${stats?.byMarket?.[m] ?? 0})`}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('overview')}
            title="Overview — how the business is doing"
            className={`px-2 py-1.5 rounded-md transition-all inline-flex items-center gap-1 text-sm font-medium ${view === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Gauge className="h-4 w-4" /> Overview
          </button>
          <button
            onClick={() => setView('today')}
            title="Today — what needs you now"
            className={`px-2 py-1.5 rounded-md transition-all inline-flex items-center gap-1 text-sm font-medium ${view === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Sun className="h-4 w-4" /> Today
          </button>
          <button
            onClick={() => setView('board')}
            title="Pipeline board"
            className={`p-1.5 rounded-md transition-all ${view === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            title="All clients"
            className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'overview' ? (
        <OverviewView onFocus={(v) => setView(v)} />
      ) : view === 'today' ? (
        <TodayView market={market} onOpen={setOpenId} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : view === 'board' ? (
        <DealBoard
          deals={deals}
          canSeeMoney={canSeeMoney}
          busyId={movingDeal}
          onMove={moveDeal}
          onOpenClient={setOpenId}
          onSetCommission={setCommission}
          onNewDeal={() => setPickingClient(true)}
          onRemoveDeal={removeDeal}
          search={search}
        />
      ) : visible.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center text-slate-400">
          <UserSearch className="h-10 w-10 mx-auto mb-2 opacity-30" />
          {focus === 'planned' ? 'No follow-ups due — you’re all caught up.'
            : focus === 'feedback' ? 'No viewings waiting on feedback.'
            : focus === 'options' ? 'Nobody is stuck waiting for new options.'
            : focus === 'untapped' ? 'No untapped matches — everything promising has been shortlisted.'
            : 'No clients yet. Add one, or import your spreadsheet.'}
        </div>
      ) : (
        <ClientDirectory leads={visible} canSeeMoney={canSeeMoney} onOpen={setOpenId} search={search} />
      )}

      {/* Closed deals summary — off-board so the pipeline stays focused */}
      {!loading && view === 'board' && (
        <div className="flex gap-2 text-xs text-slate-500">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">
            Lost: <strong className="text-slate-700">{stats?.byStatus?.LOST ?? 0}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">
            Archived: <strong className="text-slate-700">{stats?.byStatus?.ARCHIVED ?? 0}</strong>
          </span>
          {earnings && earnings.bySource?.some((r) => r.leads > 0) && (
            <button
              onClick={() => setShowChannels((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {showChannels ? 'Hide' : 'Where leads come from'}
            </button>
          )}
          {earnings && earnings.totalCommissionUsd > 0 && (
            <span
              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 inline-flex items-center gap-1"
              title={`Buyer side: $${earnings.buyerSide.commissionUsd.toLocaleString()} across ${earnings.buyerSide.count} deals · Seller side: $${earnings.sellerSide.commissionUsd.toLocaleString()} across ${earnings.sellerSide.count} properties`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Earned (12mo): <strong>${earnings.totalCommissionUsd.toLocaleString()}</strong>
            </span>
          )}
          <span className="text-slate-400 self-center">Drag a deal between columns to move it along.</span>
        </div>
      )}

      {showChannels && earnings && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Where leads come from</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Last 12 months. Commission per lead is the number that decides where the ad budget goes.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Channel</th>
                  <th className="text-right font-medium px-4 py-2">Leads</th>
                  <th className="text-right font-medium px-4 py-2">Won</th>
                  <th className="text-right font-medium px-4 py-2">Conversion</th>
                  <th className="text-right font-medium px-4 py-2">Commission</th>
                  <th className="text-right font-medium px-4 py-2">Per lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {earnings.bySource.filter((r) => r.leads > 0).map((r) => (
                  <tr key={r.source} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {r.source.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">{r.leads}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{r.won}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{r.conversionPct}%</td>
                    <td className="px-4 py-2 text-right font-medium text-emerald-700">
                      {r.commissionUsd > 0 ? `$${r.commissionUsd.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {r.commissionPerLead > 0 ? `$${r.commissionPerLead.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openLead && <LeadDrawer lead={openLead} onClose={() => setOpenId(null)} onChanged={load} />}
      {creating && (
        <LeadFormModal
          initialName={prefillName}
          onClose={() => { setCreating(false); setPrefillName('') }}
          onSaved={(saved) => {
            setCreating(false)
            setPrefillName('')
            load()
            // Came here from "New deal"? Carry straight on to the property,
            // instead of dropping the user back on the board to start again.
            if (prefillName && saved) setBookingFor(saved)
          }}
        />
      )}
      {importing && <ImportModal onClose={() => setImporting(false)} onImported={load} />}
      {pickingClient && (
        <ClientPicker
          leads={leads}
          onClose={() => setPickingClient(false)}
          onPick={(l) => { setPickingClient(false); setBookingFor(l) }}
          onCreate={(name) => { setPickingClient(false); setPrefillName(name); setCreating(true) }}
        />
      )}

      {bookingFor && (
        <BookViewingModal
          lead={bookingFor}
          onClose={() => setBookingFor(null)}
          onBooked={() => { setBookingFor(null); load() }}
        />
      )}
    </div>
  )
}

/** A one-click "what needs me now" filter with a live count. */
function FocusChip({
  children, count, active, onClick, icon, tone,
}: {
  children: React.ReactNode; count: number; active: boolean; onClick: () => void
  icon: React.ReactNode; tone: 'amber' | 'sky' | 'emerald' | 'indigo'
}) {
  const on = {
    amber: 'bg-amber-500 text-white border-amber-500',
    sky: 'bg-sky-600 text-white border-sky-600',
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    indigo: 'bg-indigo-600 text-white border-indigo-600',
  }[tone]
  const badge = {
    amber: 'bg-amber-500 text-white',
    sky: 'bg-sky-500 text-white',
    emerald: 'bg-emerald-500 text-white',
    indigo: 'bg-indigo-500 text-white',
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${
        active ? on : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      } ${count === 0 && !active ? 'opacity-60' : ''}`}
    >
      {icon}
      {children}
      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
        active ? 'bg-white/25 text-white' : count > 0 ? badge : 'bg-slate-100 text-slate-400'
      }`}>
        {count}
      </span>
    </button>
  )
}

/**
 * Which client is this deal for?
 *
 * Reads the already-loaded list rather than hitting the API — the clients are
 * on screen anyway, and a spinner between "New deal" and picking a name is pure
 * friction.
 */
function ClientPicker({
  leads, onClose, onPick, onCreate,
}: {
  leads: Lead[]
  onClose: () => void
  onPick: (lead: Lead) => void
  onCreate: (name: string) => void
}) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const base = needle
      ? leads.filter((l) =>
          [l.name, l.phone, l.whatsapp, l.email, l.askingFor]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle))
        )
      : leads
    return base.slice(0, 40)
  }, [leads, q])

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 sm:p-10" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">New deal — for which client?</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Someone who just messaged you? Add them here, then pick the property.
          </p>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone or what they want…"
            className="mt-2 w-full h-9 px-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="overflow-y-auto p-2 space-y-1">
          {rows.map((l) => (
            <button
              key={l.id}
              onClick={() => onPick(l)}
              className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{l.name}</span>
                <span className="text-[10px] text-slate-400">{TYPE_LABELS[l.type]}</span>
              </span>
              {(l.askingFor || l.phone) && (
                <span className="block text-[11px] text-slate-400 truncate">
                  {l.askingFor || l.phone}
                </span>
              )}
            </button>
          ))}
          {/* The WhatsApp case: they're not in the CRM yet, and making the user
              leave this flow to add them is how enquiries get lost. */}
          <button
            onClick={() => onCreate(q.trim())}
            className="w-full text-left inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {q.trim() ? `Add “${q.trim()}” as a new client` : 'Add someone new'}
          </button>

          {rows.length === 0 && q.trim() && (
            <p className="text-sm text-slate-400 text-center py-6">Nobody matches “{q.trim()}”.</p>
          )}
        </div>
      </div>
    </div>
  )
}
