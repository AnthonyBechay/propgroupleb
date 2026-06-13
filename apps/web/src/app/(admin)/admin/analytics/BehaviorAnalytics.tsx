'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Eye, MousePointerClick, Users, MessageSquare, Phone, Search as SearchIcon,
  TrendingUp, Loader2, Activity,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface Dashboard {
  rangeDays: number
  totals: {
    totalEvents: number
    uniqueVisitors: number
    pageViews: number
    listingViews: number
    listingClicks: number
    inquiryClicks: number
    phoneClicks: number
    whatsappClicks: number
    searches: number
    favorites: number
    contactClicks: number
    viewToContactRate: number
  }
  byType: Record<string, number>
  series: Array<{ date: string; pageViews: number; listingViews: number }>
  topListings: Array<{ listingId: string; slug: string | null; label: string; intent: string | null; status: string | null; views: number }>
}

const RANGES = [7, 30, 90]

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Page views',
  listing_view: 'Listing views',
  listing_click: 'Listing card clicks',
  inquiry_click: 'Contact form opened',
  phone_click: 'Phone clicks',
  whatsapp_click: 'WhatsApp clicks',
  search: 'Searches',
  favorite: 'Favorites',
}

export function BehaviorAnalytics() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
      const res = await fetch(`${apiUrl}/api/analytics/dashboard?days=${days}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.data ?? json)
    } catch {
      setError('Could not load behaviour analytics')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const t = data?.totals
  const maxBar = Math.max(1, ...(data?.series.map((s) => s.pageViews) ?? [1]))

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-600" /> User Behaviour
          </h2>
          <p className="text-sm text-slate-500">How visitors browse and engage — first-party, cookie-free.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                days === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
      ) : !t || t.totalEvents === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Activity className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium">No activity yet</p>
          <p className="text-slate-400 text-sm mt-1">Visitor behaviour will appear here as people browse the site.</p>
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={<Users className="w-4 h-4" />} label="Unique Visitors" value={t.uniqueVisitors} accent="text-sky-600" />
            <MetricCard icon={<Eye className="w-4 h-4" />} label="Page Views" value={t.pageViews} accent="text-violet-600" />
            <MetricCard icon={<MousePointerClick className="w-4 h-4" />} label="Listing Views" value={t.listingViews} accent="text-emerald-600" />
            <MetricCard
              icon={<MessageSquare className="w-4 h-4" />}
              label="Contact Clicks"
              value={t.contactClicks}
              accent="text-amber-600"
              sub={`${t.viewToContactRate}% of listing views`}
            />
          </div>

          {/* Daily trend */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" /> Views over time
            </h3>
            {data!.series.length === 0 ? (
              <p className="text-sm text-slate-400">No views in this period.</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {data!.series.map((s) => (
                  <div key={s.date} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                    <div className="w-full flex flex-col justify-end items-stretch gap-px" style={{ height: '100%' }}>
                      <div
                        className="bg-violet-500 rounded-t-sm min-h-[2px] transition-all"
                        style={{ height: `${(s.pageViews / maxBar) * 100}%` }}
                        title={`${s.date}: ${s.pageViews} page views, ${s.listingViews} listing views`}
                      />
                    </div>
                    <span className="absolute -bottom-5 text-[9px] text-slate-400 rotate-0 hidden sm:block">
                      {s.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-7 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-500" /> Page views</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Event breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Event breakdown</h3>
              <div className="space-y-2.5">
                {Object.entries(data!.byType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const max = Math.max(...Object.values(data!.byType))
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600">{EVENT_LABELS[type] ?? type}</span>
                          <span className="font-semibold text-slate-900">{count.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-700 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100 text-center">
                <MiniStat icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={t.phoneClicks} />
                <MiniStat icon={<MessageSquare className="w-3.5 h-3.5" />} label="WhatsApp" value={t.whatsappClicks} />
                <MiniStat icon={<SearchIcon className="w-3.5 h-3.5" />} label="Searches" value={t.searches} />
              </div>
            </div>

            {/* Top listings */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Most viewed listings</h3>
              {data!.topListings.length === 0 ? (
                <p className="text-sm text-slate-400">No listing views yet.</p>
              ) : (
                <ol className="space-y-2">
                  {data!.topListings.map((l, i) => (
                    <li key={l.listingId} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-400 w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        {l.slug ? (
                          <Link href={`/listings/${l.slug}`} target="_blank" className="text-sm text-slate-800 hover:text-slate-900 hover:underline line-clamp-1">
                            {l.label}
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-800 line-clamp-1">{l.label}</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-slate-400" /> {l.views}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function MetricCard({ icon, label, value, accent, sub }: { icon: React.ReactNode; label: string; value: number; accent: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${accent}`}>{icon}{label}</div>
      <p className="text-2xl font-bold text-slate-900 mt-1.5">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-center text-slate-400 mb-1">{icon}</div>
      <p className="text-sm font-semibold text-slate-900">{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}
