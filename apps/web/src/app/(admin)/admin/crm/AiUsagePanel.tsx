'use client'

import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/** What the AI features have cost, so spend is read here and not on an invoice. */

interface Usage {
  days: number
  autoReplyOn: boolean
  budget: { dailyUsd: number; dailyLimitUsd: number; monthlyUsd: number; monthlyLimitUsd: number; exhausted: boolean }
  last24h: { messages: number; messageLimit: number }
  totalUsd: number
  byFeature: Array<{ feature: string; model: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>
}

const FEATURE_LABEL: Record<string, string> = { 'chat-reply': 'Chat assistant', seo: 'SEO writing' }

const usd = (n: number) => (n > 0 && n < 0.01 ? '< $0.01' : `$${n.toFixed(2)}`)

export function AiUsagePanel() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [u, setU] = useState<Usage | null>(null)

  useEffect(() => {
    fetch(`${apiUrl}/api/crm/ai-usage?days=30`, { credentials: 'include', cache: 'no-store' })
      // 403 for a role that may not see spend — the panel simply isn't shown.
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setU(json?.data ?? null))
      .catch(() => setU(null))
  }, [apiUrl])

  if (!u) return null
  const bars = [
    { label: 'Last 24 hours', used: u.budget.dailyUsd, limit: u.budget.dailyLimitUsd },
    { label: 'This month', used: u.budget.monthlyUsd, limit: u.budget.monthlyLimitUsd },
  ]

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-slate-300" /> AI usage
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Model spend over the last {u.days} days</p>
        </div>
        <p className="text-lg font-bold text-slate-900 tabular-nums">{usd(u.totalUsd)}</p>
      </div>

      {u.budget.exhausted && (
        <p className="text-sm font-medium text-red-700 bg-red-50 px-3.5 py-2.5 border-b border-red-100">
          The AI budget is used up, so all AI is paused. It resumes when the period resets or the budget is raised.
        </p>
      )}
      <div className="px-3.5 py-3 border-b border-slate-100 space-y-2.5">
        {bars.map((b) => {
          const pct = Math.min(100, Math.round((b.used / b.limit) * 100))
          return (
            <div key={b.label}>
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{b.label} — hard stop at ${b.limit}</span>
                <span className="tabular-nums">{usd(b.used)}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-slate-700'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        <p className="text-xs text-slate-500">
          Chat assistant {u.autoReplyOn ? 'on' : 'off'} · {u.last24h.messages} of {u.last24h.messageLimit} messages in the last 24 hours
        </p>
      </div>

      {u.byFeature.length === 0 ? (
        <p className="text-sm text-slate-500 px-3.5 py-5 text-center">No AI calls in this period.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {u.byFeature.map((f) => (
            <div key={f.feature + f.model} className="flex items-center gap-2 px-3.5 py-2">
              <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                {FEATURE_LABEL[f.feature] ?? f.feature}
                <span className="text-slate-400"> · {f.model}</span>
              </span>
              <span className="text-xs text-slate-500 tabular-nums hidden sm:inline">{f.calls} calls</span>
              <span className="text-sm font-semibold text-slate-900 tabular-nums w-16 text-right">{usd(f.costUsd)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
