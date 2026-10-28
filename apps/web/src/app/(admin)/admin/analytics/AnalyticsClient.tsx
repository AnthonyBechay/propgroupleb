'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Building2, MapPin, MessagesSquare, TrendingUp, Trophy, UserPlus, Users } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'
import { FormSection, PageHeader, StatCard, EmptyState } from '@/components/admin/ui/layout'
import { cn } from '@/lib/utils'
import { BehaviorAnalytics } from './BehaviorAnalytics'
import { AiSourcesPanel } from './AiSourcesPanel'

type Market = 'all' | 'LEBANON' | 'INTERNATIONAL'

interface Analytics {
  days: number
  leads: {
    newInPeriod: number
    wonInPeriod: number
    bySource: Array<{ source: string; count: number }>
    byStatus: Array<{ status: string; count: number }>
  }
  chats: {
    newConversations: Array<{ channel: string; count: number }>
    inboundMessages: number
    replies: Record<string, number>
  }
  monthly: Array<{ label: string; leads: number; inquiries: number }>
  catalogue: {
    listingsByStatus: Array<{ status: string; count: number }>
    activeByIntent: Array<{ intent: string; count: number }>
    salePriceUsd: { min: number; max: number; avg: number }
    regions: Array<{ name: string; count: number }>
  }
}

const RANGES = [7, 30, 90] as const

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Added by the team', INQUIRY: 'Website enquiry', FAVORITE: 'Saved a property',
  SUBMISSION: 'List-your-property', REFERRAL: 'Referral', WHATSAPP: 'WhatsApp',
  PHONE: 'Phone', WALK_IN: 'Walk-in', FACEBOOK_AD: 'Facebook / Instagram ad',
}
const STATUS_ORDER = ['NEW', 'ACTIVE', 'VIEWING', 'NEGOTIATING', 'WON', 'LOST', 'ARCHIVED']
const STATUS_LABEL: Record<string, string> = {
  NEW: 'New', ACTIVE: 'Active', VIEWING: 'Viewing', NEGOTIATING: 'Negotiating',
  WON: 'Won', LOST: 'Lost', ARCHIVED: 'Archived',
  DRAFT: 'Draft', UNDER_OFFER: 'Under offer', CLOSED: 'Closed',
}
const MARKET_SITE: Record<Market, string> = { all: 'Both websites', LEBANON: 'propgrouplb.com', INTERNATIONAL: 'propgrp.com' }

const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`)

/**
 * The trends page. The dashboard says what needs doing today; this says how
 * the business is moving — where clients come from, how many chats turn into
 * clients, what the websites' visitors do, and what the catalogue looks like.
 */
export function AnalyticsClient({ market }: { market: Market }) {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    const qs = new URLSearchParams({ days: String(days), ...(market !== 'all' ? { market } : {}) })
    fetch(`${apiUrl}/api/admin/analytics?${qs}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (!cancelled) setData(j.data) })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [market, days])

  const site = market === 'all' ? null : market
  const chatsTotal = data?.chats.newConversations.reduce((s, c) => s + c.count, 0) ?? 0
  const channelCount = (c: string) => data?.chats.newConversations.find((x) => x.channel === c)?.count ?? 0
  const byAssistant = data?.chats.replies.AI ?? 0
  const byTeam = data ? Object.entries(data.chats.replies).filter(([k]) => k !== 'AI').reduce((s, [, v]) => s + v, 0) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={market === 'all' ? 'Both websites together. Pick one to see it on its own.' : `${MARKET_SITE[market]} only.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {/* The market lives in the URL so a view can be bookmarked or shared. */}
            <nav className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Market">
              {([['all', 'Both'], ['LEBANON', '🇱🇧 Lebanon'], ['INTERNATIONAL', '🌍 International']] as const).map(([v, label]) => (
                <Link
                  key={v}
                  href={v === 'all' ? '/admin/analytics' : `/admin/analytics?market=${v}`}
                  aria-current={market === v ? 'page' : undefined}
                  className={cn('min-h-9 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    market === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Period">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDays(r)}
                  aria-pressed={days === r}
                  className={cn('min-h-9 rounded-md px-3 text-sm font-medium transition-colors',
                    days === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                >
                  {r} days
                </button>
              ))}
            </div>
          </div>
        }
      />

      {failed && (
        <EmptyState icon={<BarChart3 className="h-10 w-10" />} title="Could not load analytics" description="The API did not respond. Refresh to try again." />
      )}

      {loading && !data && !failed && (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-xl border border-slate-200 bg-slate-50" />)}
        </div>
      )}

      {data && (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-50')}>
          {/* Clients */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <StatCard icon={<UserPlus className="h-4 w-4" />} label="New clients" value={data.leads.newInPeriod} hint={`Last ${data.days} days`} href="/admin/crm" />
            <StatCard icon={<Trophy className="h-4 w-4" />} label="Deals won" value={data.leads.wonInPeriod} accent="text-emerald-600" hint={`Last ${data.days} days`} />
            <StatCard icon={<MessagesSquare className="h-4 w-4" />} label="New chats" value={chatsTotal}
              hint={`${channelCount('WHATSAPP')} WhatsApp · ${channelCount('INSTAGRAM')} Instagram`} href="/admin/inbox" />
            <StatCard icon={<Users className="h-4 w-4" />} label="Client messages" value={data.chats.inboundMessages.toLocaleString()} hint="Received in chats" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Replies" value={(byAssistant + byTeam).toLocaleString()}
              hint={`${byAssistant} assistant · ${byTeam} team`} />
          </div>
          {market !== 'all' && (
            <p className="-mt-3 text-xs text-slate-500">Chats are counted for both websites: a conversation has no market until it is linked to a client.</p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <FormSection title="Where new clients come from" description={`Last ${data.days} days.`} icon={<UserPlus className="h-4 w-4" />}>
              <Bars rows={data.leads.bySource.map((r) => ({ label: SOURCE_LABEL[r.source] ?? r.source, count: r.count }))} empty="No new clients in this period." />
            </FormSection>
            <FormSection title="The pipeline now" description="Every client, by where they are." icon={<Trophy className="h-4 w-4" />}>
              <Bars
                rows={[...data.leads.byStatus]
                  .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
                  .map((r) => ({ label: STATUS_LABEL[r.status] ?? r.status, count: r.count, tone: r.status === 'WON' ? 'bg-emerald-600' : r.status === 'LOST' || r.status === 'ARCHIVED' ? 'bg-slate-300' : undefined }))}
                empty="No clients yet."
              />
            </FormSection>
          </div>

          <FormSection title="Six months" description="New clients in the CRM, and enquiries sent from the websites." icon={<TrendingUp className="h-4 w-4" />}>
            <MonthlyChart rows={data.monthly} />
          </FormSection>
        </div>
      )}

      {/* Visitors — their own range controls */}
      <BehaviorAnalytics site={site} />
      <AiSourcesPanel site={site} />

      {data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <FormSection title="Listings" icon={<Building2 className="h-4 w-4" />}>
            <Bars rows={data.catalogue.listingsByStatus.map((r) => ({ label: STATUS_LABEL[r.status] ?? r.status, count: r.count, tone: r.status === 'ACTIVE' ? 'bg-emerald-600' : undefined }))} empty="No listings yet." />
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              {data.catalogue.activeByIntent.map((r) => (
                <div key={r.intent}>
                  <p className="text-xs text-slate-500">{r.intent === 'FOR_RENT' ? 'Live for rent' : 'Live for sale'}</p>
                  <p className="text-lg font-bold text-slate-900">{r.count}</p>
                </div>
              ))}
            </div>
          </FormSection>
          <FormSection title="Sale prices" description="Live listings for sale, in USD." icon={<BarChart3 className="h-4 w-4" />}>
            {data.catalogue.salePriceUsd.avg > 0 ? (
              <dl className="grid grid-cols-3 gap-3 text-center">
                {([['From', data.catalogue.salePriceUsd.min], ['Average', data.catalogue.salePriceUsd.avg], ['Up to', data.catalogue.salePriceUsd.max]] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="mt-0.5 text-lg font-bold text-slate-900">{usd(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-sm text-slate-500">No live listings for sale.</p>}
          </FormSection>
          <FormSection title="Where the stock is" icon={<MapPin className="h-4 w-4" />}>
            <Bars rows={data.catalogue.regions.map((r) => ({ label: r.name, count: r.count }))} empty="No properties yet." />
          </FormSection>
        </div>
      )}
    </div>
  )
}

function Bars({ rows, empty }: { rows: Array<{ label: string; count: number; tone?: string }>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm text-slate-700" title={r.label}>{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full', r.tone ?? 'bg-slate-700')} style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-800">{r.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

function MonthlyChart({ rows }: { rows: Array<{ label: string; leads: number; inquiries: number }> }) {
  const max = Math.max(...rows.flatMap((r) => [r.leads, r.inquiries]), 1)
  return (
    <div>
      <div className="flex h-44 items-end gap-2 sm:gap-4">
        {rows.map((r) => (
          <div key={r.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {([['leads', r.leads, 'bg-slate-800'], ['inquiries', r.inquiries, 'bg-sky-500']] as const).map(([k, v, tone]) => (
                <div key={k} className="flex h-full w-1/2 max-w-7 flex-col items-center justify-end">
                  <span className="mb-0.5 text-[11px] font-semibold tabular-nums text-slate-600">{v || ''}</span>
                  <div className={cn('w-full rounded-t', tone)} style={{ height: `${(v / max) * 85}%`, minHeight: v ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <span className="text-xs text-slate-500">{r.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-800" />New clients</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />Website enquiries</span>
      </div>
    </div>
  )
}
