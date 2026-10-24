'use client'

import { useEffect, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * Where visitors come from — with AI assistants (ChatGPT, Perplexity, Gemini…)
 * counted on their own, so it is visible whether being cited by them works.
 *
 * Built from each visit's first page, which records the page that linked to
 * the site and any utm tags. Visits from before that was recorded are not in it.
 */

interface Sources {
  days: number
  visits: number
  channels: Array<{ channel: string; visits: number }>
  aiAssistants: Array<{ name: string; visits: number; topPages: Array<{ path: string; visits: number }> }>
}

const RANGES = [30, 90, 365] as const

export function AiSourcesPanel({ site }: { site: 'LEBANON' | 'INTERNATIONAL' | null }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [data, setData] = useState<Sources | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    setLoading(true)
    const p = new URLSearchParams({ days: String(days) })
    if (site) p.set('site', site)
    fetch(`${apiUrl}/api/analytics/sources?${p}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setData(j?.data ?? null) })
      .catch(() => { if (live) setData(null) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [apiUrl, days, site])

  const aiTotal = data?.aiAssistants.reduce((t, a) => t + a.visits, 0) ?? 0
  const share = data && data.visits > 0 ? Math.round((aiTotal / data.visits) * 1000) / 10 : 0

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Bot className="h-4 w-4 text-slate-400" /> Where visitors come from
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">AI assistants counted on their own — the measure of being cited by them</p>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)}
              className={`min-h-9 px-2.5 rounded-md text-xs font-medium ${days === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {r === 365 ? '1 year' : `${r} days`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !data || data.visits === 0 ? (
        <p className="text-sm text-slate-600 px-4 py-8 text-center">
          No visits recorded with their source yet. Sources are recorded from now on, for every new visit.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{data.visits.toLocaleString()} visits</p>
            <ul className="space-y-2">
              {data.channels.map((c) => {
                const pct = Math.round((c.visits / data.visits) * 100)
                return (
                  <li key={c.channel}>
                    <div className="flex justify-between text-sm">
                      <span className={c.channel === 'AI assistants' ? 'font-semibold text-slate-900' : 'text-slate-700'}>{c.channel}</span>
                      <span className="tabular-nums text-slate-700">{c.visits.toLocaleString()} · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${c.channel === 'AI assistants' ? 'bg-emerald-600' : 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              From AI assistants · {aiTotal} visit{aiTotal === 1 ? '' : 's'} ({share}%)
            </p>
            {data.aiAssistants.length === 0 ? (
              <p className="text-sm text-slate-600">None yet in this period.</p>
            ) : (
              <ul className="space-y-3">
                {data.aiAssistants.map((a) => (
                  <li key={a.name}>
                    <p className="text-sm font-medium text-slate-900 flex justify-between">
                      <span>{a.name}</span><span className="tabular-nums">{a.visits}</span>
                    </p>
                    <ul className="mt-0.5">
                      {a.topPages.map((p) => (
                        <li key={p.path} className="text-xs text-slate-600 flex justify-between gap-2">
                          <span className="truncate">{p.path}</span><span className="tabular-nums shrink-0">{p.visits}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
