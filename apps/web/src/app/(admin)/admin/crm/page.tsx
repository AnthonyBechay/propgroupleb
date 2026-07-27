'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  UserSearch, Plus, Search, Loader2, Phone, MessageCircle, Mail, AlertTriangle,
  CalendarClock, Users, Flame, X,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { LeadDrawer } from './LeadDrawer'
import { LeadFormModal } from './LeadFormModal'
import {
  type Lead, type LeadMarket, STATUS_META, TYPE_LABELS, MARKET_META, formatDue,
} from './types'

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'overdue', label: 'Needs follow-up' },
  { key: 'all', label: 'All open' },
  { key: 'NEW', label: 'New' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'VIEWING', label: 'Viewing' },
  { key: 'NEGOTIATING', label: 'Negotiating' },
  { key: 'WON', label: 'Won' },
  { key: 'LOST', label: 'Lost' },
]

interface Stats {
  openLeads: number
  overdue: number
  byMarket: Record<string, number>
}

export default function CrmPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overdue')
  const [market, setMarket] = useState<'all' | LeadMarket>('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ limit: '200' })
      if (tab === 'overdue') p.set('overdue', 'true')
      else if (tab !== 'all') p.set('status', tab)
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
  }, [apiUrl, tab, market, search])

  // Debounce so typing in the search box doesn't refetch per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const openLead = leads.find((l) => l.id === openId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserSearch className="h-6 w-6" /> Client CRM
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Who&apos;s looking for what — across Lebanon and Georgia. Most urgent follow-ups first.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700"
        >
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={<Users className="h-4 w-4" />} label="Open clients" value={stats?.openLeads ?? '—'} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Need follow-up" value={stats?.overdue ?? '—'} accent="text-red-600" />
        <StatCard icon={<span className="text-sm">🇱🇧</span>} label="Lebanon" value={stats?.byMarket?.LEBANON ?? 0} />
        <StatCard icon={<span className="text-sm">🇬🇪</span>} label="Georgia" value={stats?.byMarket?.GEORGIA ?? 0} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, area, notes…"
            className="w-full h-10 pl-9 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['all', 'LEBANON', 'GEORGIA'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                market === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m === 'all' ? 'Both' : MARKET_META[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.key === 'overdue' && (stats?.overdue ?? 0) > 0 && tab !== 'overdue' && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {stats?.overdue}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : leads.length === 0 ? (
        <div className="bg-white border rounded-xl p-16 text-center text-slate-400">
          <UserSearch className="h-10 w-10 mx-auto mb-2 opacity-30" />
          {tab === 'overdue' ? 'Nothing overdue — you’re all caught up.' : 'No clients here yet. Add your first one.'}
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const due = formatDue(l.nextContactAt)
            const meta = STATUS_META[l.status]
            const where = [l.areas.join(', '), l.city, l.caza].filter(Boolean).join(' · ')
            return (
              <div
                key={l.id}
                onClick={() => setOpenId(l.id)}
                className={`bg-white border rounded-xl p-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                  due.tone === 'overdue' ? 'border-red-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{l.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${MARKET_META[l.market].cls}`}>
                        {MARKET_META[l.market].label}
                      </span>
                      <span className="text-xs text-slate-400">{TYPE_LABELS[l.type]}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">
                      {l.askingFor || l.unitKinds.join(', ') || '—'}
                      {where && <span className="text-slate-500"> in {where}</span>}
                      {(l.budgetMin || l.budgetMax) && (
                        <span className="text-slate-500">
                          {' '}· {l.currency} {(l.budgetMin ?? 0).toLocaleString()}–{l.budgetMax ? l.budgetMax.toLocaleString() : '∞'}
                        </span>
                      )}
                    </p>
                    {l.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{l.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ${
                        due.tone === 'overdue' ? 'bg-red-50 text-red-700'
                        : due.tone === 'today' ? 'bg-amber-50 text-amber-700'
                        : due.tone === 'soon' ? 'bg-sky-50 text-sky-700'
                        : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {due.tone === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                      {due.text}
                    </span>
                    {l.phone && (
                      <>
                        <a href={`tel:${l.phone}`} title={l.phone} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={`https://wa.me/${(l.whatsapp || l.phone).replace(/[^0-9]/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
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
      )}

      {openLead && (
        <LeadDrawer
          lead={openLead}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
      {creating && (
        <LeadFormModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load() }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">{icon}{label}</div>
      <div className={`text-xl font-bold mt-0.5 ${accent ?? 'text-slate-900'}`}>{value}</div>
    </div>
  )
}
