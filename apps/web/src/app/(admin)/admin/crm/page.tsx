'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UserSearch, Plus, Search, Loader2, Phone, MessageCircle, Mail, AlertTriangle,
  CalendarClock, Flame, X, LayoutGrid, List, Download, Upload, MapPin,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { LeadDrawer } from './LeadDrawer'
import { LeadFormModal } from './LeadFormModal'
import { LeadBoard } from './LeadBoard'
import { ImportModal } from './ImportModal'
import {
  type Lead, type LeadMarket, type LeadStatus,
  STATUS_META, TYPE_LABELS, MARKET_META, formatDue,
} from './types'

interface Stats {
  openLeads: number
  overdue: number
  byMarket: Record<string, number>
  byStatus: Record<string, number>
}

type View = 'board' | 'list'

export default function CrmPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('board')
  const [market, setMarket] = useState<'all' | LeadMarket>('all')
  const [search, setSearch] = useState('')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // The board needs every open lead at once, so we always fetch broadly and
      // narrow client-side — keeps drag-and-drop instant.
      const p = new URLSearchParams({ limit: '500' })
      if (market !== 'all') p.set('market', market)
      if (search.trim()) p.set('search', search.trim())

      const [listRes, statsRes] = await Promise.all([
        fetch(`${apiUrl}/api/crm?${p}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`${apiUrl}/api/crm/stats`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (listRes.ok) setLeads((await listRes.json()).data ?? [])
      if (statsRes.ok) setStats((await statsRes.json()).data ?? null)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, market, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const visible = useMemo(
    () => (onlyOverdue ? leads.filter((l) => formatDue(l.nextContactAt).tone === 'overdue') : leads),
    [leads, onlyOverdue],
  )

  // Optimistic move so dragging feels instant; reload reconciles with the server.
  async function moveLead(id: string, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
    try {
      await fetch(`${apiUrl}/api/crm/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    } finally {
      load()
    }
  }

  function exportCsv() {
    const p = new URLSearchParams()
    if (market !== 'all') p.set('market', market)
    // Plain navigation so the browser handles the download + auth cookie.
    window.open(`${apiUrl}/api/crm/export.csv?${p}`, '_blank')
  }

  const openLead = leads.find((l) => l.id === openId) ?? null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserSearch className="h-6 w-6" /> Client CRM
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Who&apos;s looking for what — across Lebanon and Georgia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Export
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

      {/* Toolbar: search · overdue · market · view */}
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

        <button
          onClick={() => setOnlyOverdue((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${
            onlyOverdue ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Flame className="h-4 w-4" />
          Needs follow-up
          {(stats?.overdue ?? 0) > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
              onlyOverdue ? 'bg-white text-red-600' : 'bg-red-500 text-white'
            }`}>
              {stats?.overdue}
            </span>
          )}
        </button>

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
            onClick={() => setView('board')}
            title="Board"
            className={`p-1.5 rounded-md transition-all ${view === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            title="List"
            className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center text-slate-400">
          <UserSearch className="h-10 w-10 mx-auto mb-2 opacity-30" />
          {onlyOverdue ? 'Nothing overdue — you’re all caught up.' : 'No clients yet. Add one, or import your spreadsheet.'}
        </div>
      ) : view === 'board' ? (
        <LeadBoard leads={visible} onOpen={setOpenId} onMove={moveLead} />
      ) : (
        <ListView leads={visible} onOpen={setOpenId} />
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
          <span className="text-slate-400 self-center">Drag a card between columns to move a client through the pipeline.</span>
        </div>
      )}

      {openLead && <LeadDrawer lead={openLead} onClose={() => setOpenId(null)} onChanged={load} />}
      {creating && <LeadFormModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onImported={load} />}
    </div>
  )
}

/** Dense table-style view for scanning or bulk work. */
function ListView({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {leads.map((l) => {
        const due = formatDue(l.nextContactAt)
        const meta = STATUS_META[l.status]
        const where = l.areas.join(', ')
        const phone = l.whatsapp || l.phone
        return (
          <div
            key={l.id}
            onClick={() => onOpen(l.id)}
            className={`bg-white border rounded-xl p-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${
              due.tone === 'overdue' ? 'border-red-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">{l.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${MARKET_META[l.market].cls}`}>{MARKET_META[l.market].label}</span>
                  <span className="text-xs text-slate-400">{TYPE_LABELS[l.type]}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1">
                  {l.askingFor || l.unitKinds.join(', ') || '—'}
                  {(l.budgetMin || l.budgetMax) && (
                    <span className="text-slate-500">
                      {' '}· {l.currency} {(l.budgetMin ?? 0).toLocaleString()}–{l.budgetMax ? l.budgetMax.toLocaleString() : '∞'}
                    </span>
                  )}
                </p>
                {where && (
                  <p className="text-xs text-slate-400 mt-0.5 inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{where}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                  due.tone === 'overdue' ? 'bg-red-50 text-red-700'
                  : due.tone === 'today' ? 'bg-amber-50 text-amber-700'
                  : due.tone === 'soon' ? 'bg-sky-50 text-sky-700'
                  : 'bg-slate-50 text-slate-500'
                }`}>
                  {due.tone === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                  {due.text}
                </span>
                {l.phone && (
                  <>
                    <a href={`tel:${l.phone}`} title={l.phone} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <a href={`https://wa.me/${(phone ?? '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                       className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </>
                )}
                {l.email && (
                  <a href={`mailto:${l.email}`} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
