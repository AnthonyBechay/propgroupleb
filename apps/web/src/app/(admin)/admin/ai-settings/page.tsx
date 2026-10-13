'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Loader2, Check, X, ArrowUp, ArrowDown, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * How the chat assistant behaves on WhatsApp and Instagram.
 *
 * The office decides three things here: whether it answers at all, who it
 * answers, and what it should steer an undecided client towards. What it may
 * never do (quote invented prices, discuss owners or commission, negotiate) is
 * fixed in code and is not a setting.
 */

interface Preferred { ref: string; pitch: string }

interface Settings {
  enabled: boolean
  audience: 'ads' | 'all'
  preferred: Preferred[]
  guidance: string
}

interface Status {
  masterSwitch: boolean
  aiKey: boolean
  whatsappSending: boolean
  instagramSending: boolean
  budget: { dailyUsd: number; dailyLimitUsd: number; monthlyUsd: number; monthlyLimitUsd: number; exhausted: boolean }
}

interface Option { ref: string; title: string; location: string; market: string; isProject: boolean; price: string }

const MAX_PREFERRED = 10

export default function AiSettingsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [catalogue, setCatalogue] = useState<Option[]>([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/crm/ai-settings`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) { setDenied(true); return }
    const data = (await res.json()).data
    setSettings(data.settings)
    setStatus(data.status)
    setCatalogue(data.catalogue ?? [])
  }, [apiUrl])
  useEffect(() => { load() }, [load])

  const byRef = useMemo(() => new Map(catalogue.map((o) => [o.ref.toUpperCase(), o])), [catalogue])

  const update = (patch: Partial<Settings>) => {
    setSaved(false)
    setSettings((s) => (s ? { ...s, ...patch } : s))
  }

  const move = (index: number, by: -1 | 1) => {
    if (!settings) return
    const next = [...settings.preferred]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ preferred: next })
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm/ai-settings`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.message || 'The settings were not saved.')
        return
      }
      setSettings((await res.json()).data.settings)
      setSaved(true)
    } finally { setSaving(false) }
  }

  if (denied) {
    return <p className="text-sm text-slate-600 p-6">These settings are available to administrators only.</p>
  }
  if (!settings || !status) {
    return <div className="flex justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  const chosen = new Set(settings.preferred.map((p) => p.ref.toUpperCase()))
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? catalogue
        .filter((o) => !chosen.has(o.ref.toUpperCase()))
        .filter((o) => `${o.title} ${o.ref} ${o.location}`.toLowerCase().includes(needle))
        .slice(0, 8)
    : []

  // In the order somebody would fix them.
  const blockers = [
    !status.aiKey ? 'No Gemini key is set on the server (GEMINI_API_KEY).' : null,
    !status.masterSwitch ? 'The master switch is off on the server (AUTO_REPLY_ENABLED is not "true").' : null,
    !status.whatsappSending ? 'WhatsApp sending is not configured (YCLOUD_API_KEY and YCLOUD_WHATSAPP_FROM).' : null,
    status.budget.exhausted ? 'The AI budget is used up, so all AI is paused.' : null,
  ].filter((b): b is string => Boolean(b))
  const running = settings.enabled && blockers.length === 0

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="h-5 w-5 text-slate-500" /> Chat assistant
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Replies to clients on WhatsApp and Instagram, in their language, until one of the team takes over.
        </p>
      </div>

      {/* Is it actually answering right now? */}
      <section className={`rounded-xl border p-4 ${running ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
        <p className={`text-sm font-semibold flex items-center gap-2 ${running ? 'text-emerald-800' : 'text-slate-800'}`}>
          {running ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
          {running ? 'The assistant is answering clients.' : 'The assistant is not answering clients.'}
        </p>
        {!settings.enabled && blockers.length === 0 && (
          <p className="text-sm text-slate-600 mt-1">It is switched off below.</p>
        )}
        {blockers.length > 0 && (
          <ul className="text-sm text-slate-700 mt-2 space-y-1 list-disc pl-5">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        <p className="text-xs text-slate-600 mt-2">
          Spend: ${status.budget.dailyUsd.toFixed(2)} of ${status.budget.dailyLimitUsd} in the last 24 hours ·
          ${status.budget.monthlyUsd.toFixed(2)} of ${status.budget.monthlyLimitUsd} this month. All AI stops at either limit.
        </p>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="mt-1 h-5 w-5 rounded border-slate-300"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Answer clients automatically</span>
            <span className="block text-sm text-slate-600">
              It stops on a conversation as soon as you reply from your phone or the CRM, or when the client asks for a person.
            </span>
          </span>
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900 mb-2">Who it answers</legend>
          <div className="space-y-2">
            {([
              ['ads', 'Only people who came from an ad or a lead form', 'Suppliers, friends and existing clients are left to you.'],
              ['all', 'Everyone who messages', 'Including people who are not enquiring about property.'],
            ] as const).map(([value, title, hint]) => (
              <label key={value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio" name="audience" checked={settings.audience === value}
                  onChange={() => update({ audience: value })}
                  className="mt-1 h-4 w-4 border-slate-300"
                />
                <span>
                  <span className="block text-sm text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-600">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900">Projects to recommend first</h2>
        <p className="text-sm text-slate-600 mt-1">
          When a client hasn&apos;t said which project they want, and the ad didn&apos;t name one, the assistant asks their budget and
          preferred location, then recommends from this list — top of the list first, and only those that fit the budget.
        </p>

        <ol className="mt-3 space-y-2">
          {settings.preferred.map((p, i) => {
            const o = byRef.get(p.ref.toUpperCase())
            return (
              <li key={p.ref} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-semibold text-slate-500 w-5 shrink-0">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{o?.title ?? p.ref}</p>
                    <p className="text-xs text-slate-600 truncate">
                      <span className="font-mono">{p.ref}</span>
                      {o ? ` · ${o.location || o.market} · ${o.price}` : ' · no longer public or available'}
                    </p>
                  </div>
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === settings.preferred.length - 1} aria-label="Move down" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => update({ preferred: settings.preferred.filter((x) => x.ref !== p.ref) })} aria-label="Remove" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><X className="h-4 w-4" /></button>
                </div>
                <input
                  value={p.pitch}
                  maxLength={300}
                  onChange={(e) => update({ preferred: settings.preferred.map((x) => (x.ref === p.ref ? { ...x, pitch: e.target.value } : x)) })}
                  placeholder="Why recommend it — e.g. sea view, delivery next summer, 30% down payment"
                  className="mt-2 w-full min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </li>
            )
          })}
          {settings.preferred.length === 0 && (
            <li className="text-sm text-slate-500">Nothing yet. Without a list, the assistant searches all available stock.</li>
          )}
        </ol>

        {settings.preferred.length < MAX_PREFERRED && (
          <div className="mt-3">
            <div className="relative">
              <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add a project — search by name, code or area"
                className="w-full min-h-11 rounded-lg border border-slate-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
            {matches.length > 0 && (
              <ul className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100">
                {matches.map((o) => (
                  <li key={o.ref}>
                    <button
                      onClick={() => { update({ preferred: [...settings.preferred, { ref: o.ref, pitch: '' }] }); setQuery('') }}
                      className="w-full min-h-11 text-left px-3 py-2 hover:bg-slate-50"
                    >
                      <span className="block text-sm text-slate-900">{o.title}</span>
                      <span className="block text-xs text-slate-600"><span className="font-mono">{o.ref}</span> · {o.location || o.market} · {o.price}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {needle && matches.length === 0 && <p className="text-sm text-slate-500 mt-2">No public, available project matches.</p>}
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900">Anything else it should know</h2>
        <p className="text-sm text-slate-600 mt-1">
          In your own words — what to mention, what to avoid, when to pass the client to you. It never overrides the fixed rules:
          no invented prices, nothing about owners or commission, no negotiating.
        </p>
        <textarea
          value={settings.guidance}
          maxLength={1500}
          onChange={(e) => update({ guidance: e.target.value })}
          rows={5}
          placeholder="e.g. Mention that payment plans are available. If they ask about residency, say a colleague will explain."
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="min-h-11 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save settings
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved.</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  )
}
