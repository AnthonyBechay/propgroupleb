'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bot, Loader2, Check, X, ArrowUp, ArrowDown, Plus, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react'
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

interface Knowledge { question: string; answer: string }

interface Settings {
  enabled: boolean
  audience: 'ads' | 'all'
  marketWhenUnknown: 'ask' | 'LEBANON' | 'GEORGIA'
  handover: 'step_aside' | 'return_after_quiet' | 'always'
  quietHours: 1 | 3 | 6 | 12 | 20
  preferred: Preferred[]
  maxListings: 1 | 2 | 3
  replyStyle: 'match' | 'latin' | 'latin_always'
  modelTier: 'quality' | 'economy'
  office: { name: string; address: string; mapsUrl: string }
  knowledge: Knowledge[]
  guidance: string
  followUp: FollowUp
}

interface FollowUp {
  enabled: boolean
  afterDays: 3 | 5 | 7 | 14
  templateName: string
  language: string
  text: string
  useName: boolean
  dailyLimit: number
}

const field = 'w-full min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400'

/** A set of radio choices, each with a line saying what it means. */
function Choice<T extends string | number>({
  legend, name, value, options, onChange,
}: {
  legend: string
  name: string
  value: T
  options: ReadonlyArray<readonly [T, string, string]>
  onChange: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-900 mb-2">{legend}</legend>
      <div className="space-y-2">
        {options.map(([v, title, hint]) => (
          <label key={String(v)} className="flex items-start gap-3 cursor-pointer">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="mt-1 h-4 w-4 border-slate-300" />
            <span>
              <span className="block text-sm text-slate-900">{title}</span>
              <span className="block text-xs text-slate-600">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface Status {
  masterSwitch: boolean
  aiKey: boolean
  whatsappSending: boolean
  instagramSending: boolean
  instagramToken?: { configured: boolean; refreshedAt: string | null; expiresAt: string | null; error: string | null }
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
        // Half-filled questions are dropped rather than refused.
        body: JSON.stringify({
          ...settings,
          knowledge: settings.knowledge.filter((k) => k.question.trim() && k.answer.trim()),
        }),
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
        {status.instagramToken?.configured && (
          <p className={`text-xs mt-2 ${status.instagramToken.error ? 'text-red-700' : 'text-slate-600'}`}>
            {status.instagramToken.error
              ? `Instagram token could not be renewed: ${status.instagramToken.error}. Generate a new one in the Meta app and put it in INSTAGRAM_ACCESS_TOKEN.`
              : status.instagramToken.expiresAt
                ? `Instagram token renews itself weekly — good until ${new Date(status.instagramToken.expiresAt).toLocaleDateString()}.`
                : 'Instagram token renews itself weekly; the first renewal happens within a day of the server starting.'}
          </p>
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

        <Choice
          legend="When someone from the team replies, or the assistant hands over"
          name="handover"
          value={settings.handover}
          onChange={(v) => update({ handover: v })}
          options={[
            ['return_after_quiet', 'Step aside, and take over if the team goes quiet', 'It stays out while you are talking. If a client is waiting and nobody from the team has replied for the time below, it picks the conversation up again from its summary.'],
            ['step_aside', 'Step aside until switched back on', 'It stays out until someone picks a mode again from the Assistant button on that conversation.'],
            ['always', 'Always answer', 'It answers every message on every conversation, even while you are talking too — clients may get two replies. Switching it off on a chat stops it there. When it hands a client to the team, it waits for the quiet period below.'],
          ] as const}
        />

        {/* Also how long a hand-off holds on an "always on" chat. */}
        {settings.handover !== 'step_aside' && (
          <Choice
            legend="Take over after the team has been quiet for"
            name="quietHours"
            value={settings.quietHours}
            onChange={(v) => update({ quietHours: v })}
            options={[
              [1, '1 hour', 'Clients are never left long.'],
              [3, '3 hours', ''],
              [6, '6 hours', ''],
              [12, '12 hours', ''],
              [20, '20 hours', 'The longest possible: WhatsApp allows a reply only within 24 hours of the client\'s last message.'],
            ] as const}
          />
        )}

        <Choice
          legend="When nobody has said which country"
          name="market"
          value={settings.marketWhenUnknown}
          onChange={(v) => update({ marketWhenUnknown: v })}
          options={[
            ['ask', 'Ask the client first', 'Lebanon or abroad — one short question before it searches anything. Someone from an ad is always taken to mean the ad\'s country.'],
            ['GEORGIA', 'Assume Georgia', 'Investment property abroad, without asking.'],
            ['LEBANON', 'Assume Lebanon', 'Homes in Lebanon, without asking.'],
          ] as const}
        />

        <Choice
          legend="Properties in one reply"
          name="maxListings"
          value={settings.maxListings}
          onChange={(v) => update({ maxListings: v })}
          options={[
            [1, 'One', 'The single best match. Shortest message.'],
            [2, 'Up to two', 'A choice without a long message.'],
            [3, 'Up to three', 'More to choose from.'],
          ] as const}
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900 mb-2">How it writes</legend>
          <div className="space-y-2">
            {([
              ['match', 'Match the client (recommended)', 'Arabic letters get Arabic letters. Arabic typed in English letters, and Arabic voice notes, get Lebanese in English letters ("Ahla w sahla, 2addeh l budget?"). English and French as they are.'],
              ['latin', 'Lebanese in English letters for Arabic speakers', 'Anyone writing or speaking Arabic, even in Arabic letters, gets Lebanese in English letters. English and French speakers get their own language.'],
              ['latin_always', 'Lebanese in English letters for everyone', 'Whatever language the client writes in.'],
            ] as const).map(([value, title, hint]) => (
              <label key={value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio" name="replyStyle" checked={settings.replyStyle === value}
                  onChange={() => update({ replyStyle: value })}
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

        <Choice
          legend="Quality or cost"
          name="modelTier"
          value={settings.modelTier}
          onChange={(v) => update({ modelTier: v })}
          options={[
            ['quality', 'Best replies', 'The stronger model first. About one cent per reply.'],
            ['economy', 'Lowest cost', 'The cheapest model first. About a fifth of the cost; plainer replies.'],
          ] as const}
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900">Priority projects</h2>
        <p className="text-sm text-slate-600 mt-1">
          What you most want to sell, top first. Whenever one fits what the client asked for — budget, area, size — the assistant
          recommends it before anything else and says why, using your note. When a client hasn&apos;t named a project, it asks their
          budget and location and starts from this list. It never pushes one that doesn&apos;t fit.
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

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Office</h2>
          <p className="text-sm text-slate-600 mt-1">Given when a client asks where you are, for the address, or to come by.</p>
        </div>
        <input value={settings.office.name} maxLength={120} placeholder="Office name — e.g. PropGroup"
          onChange={(e) => update({ office: { ...settings.office, name: e.target.value } })} className={field} />
        <input value={settings.office.address} maxLength={300} placeholder="Address — e.g. Fanar, Lebanon"
          onChange={(e) => update({ office: { ...settings.office, address: e.target.value } })} className={field} />
        <input value={settings.office.mapsUrl} maxLength={500} placeholder="Google Maps link — paste it from Maps → Share"
          onChange={(e) => update({ office: { ...settings.office, mapsUrl: e.target.value } })} className={field} />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900">Questions and answers</h2>
        <p className="text-sm text-slate-600 mt-1">
          Questions clients ask, answered the way you want. The assistant uses your answer whenever it is asked one of these, in the
          client&apos;s language. Good for payment plans, residency, fees, how buying abroad works.
        </p>
        <ul className="mt-3 space-y-3">
          {settings.knowledge.map((k, i) => (
            <li key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input value={k.question} maxLength={300} placeholder="The question — e.g. Can I get residency if I buy in Batumi?"
                  onChange={(e) => update({ knowledge: settings.knowledge.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })}
                  className={field} />
                <button onClick={() => update({ knowledge: settings.knowledge.filter((_, j) => j !== i) })} aria-label="Remove this question"
                  className="min-h-11 min-w-11 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <textarea value={k.answer} maxLength={1000} rows={2} placeholder="How to answer it"
                onChange={(e) => update({ knowledge: settings.knowledge.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </li>
          ))}
        </ul>
        {settings.knowledge.length < 40 && (
          <button onClick={() => update({ knowledge: [...settings.knowledge, { question: '', answer: '' }] })}
            className="mt-3 min-h-11 px-3 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 inline-flex items-center gap-1.5 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add a question
          </button>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-900">Memory — things to keep in mind</h2>
        <p className="text-sm text-slate-600 mt-1">
          Anything it should always remember, in your own words: what to mention, what to avoid, when to pass the client to you.
          It never overrides the fixed rules — no invented prices, nothing about owners or commission, no negotiating.
        </p>
        <textarea
          value={settings.guidance}
          maxLength={3000}
          onChange={(e) => update({ guidance: e.target.value })}
          rows={5}
          placeholder="e.g. Mention that payment plans are available. If they ask about residency, say a colleague will explain."
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Follow-up after silence</h2>
          <p className="text-sm text-slate-600 mt-1">
            One short, friendly WhatsApp message to a client who has gone quiet, so they are not lost once nobody can reply.
            After 24 hours without a message from the client, WhatsApp only accepts a template Meta has approved in advance,
            and charges for each one. If they answer, the assistant carries on as usual.
          </p>
        </div>

        <details className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-900">How to set up the template (once)</summary>
          <ol className="mt-2 list-decimal pl-5 space-y-1">
            <li>In YCloud, go to WhatsApp → Templates → Create.</li>
            <li>Category <b>Marketing</b>, a name like <code>propgroup_checkin</code>, language English (or Arabic).</li>
            <li>Paste the text below as the body. Keep <code>{'{{1}}'}</code> where the client&apos;s first name goes, with &ldquo;Rami&rdquo; as the sample.</li>
            <li>Submit. Approval usually takes minutes to a day. Then put the same name and language here and switch it on.</li>
          </ol>
        </details>

        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.followUp.enabled}
            onChange={(e) => update({ followUp: { ...settings.followUp, enabled: e.target.checked } })}
            className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            <span className="block text-sm text-slate-900">Send it automatically</span>
            <span className="block text-xs text-slate-600">
              Once per silence, to clients only (not suppliers or unknown numbers), between 10:00 and 19:00 Beirut time.
              Never to closed, lost or parked clients, to chats where the assistant is switched off, or to anyone who asked to stop.
              The <b>Send follow-up</b> button on a chat works whether or not this is on.
            </span>
          </span>
        </label>

        <Choice
          legend="After how long without any message"
          name="afterDays"
          value={settings.followUp.afterDays}
          onChange={(v) => update({ followUp: { ...settings.followUp, afterDays: v } })}
          options={[
            [3, '3 days', ''],
            [5, '5 days', ''],
            [7, '7 days', 'Recommended.'],
            [14, '14 days', ''],
          ] as const}
        />

        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="block">
            <span className="block text-sm font-medium text-slate-900 mb-1">Template name, exactly as approved</span>
            <input value={settings.followUp.templateName} maxLength={512} placeholder="propgroup_checkin"
              onChange={(e) => update({ followUp: { ...settings.followUp, templateName: e.target.value.trim().toLowerCase() } })}
              className={field} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-900 mb-1">Language code</span>
            <input value={settings.followUp.language} maxLength={6} placeholder="en"
              onChange={(e) => update({ followUp: { ...settings.followUp, language: e.target.value.trim() } })}
              className={field} />
          </label>
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-slate-900 mb-1">The template&apos;s text</span>
          <span className="block text-xs text-slate-600 mb-1.5">
            Exactly as approved — this is what the conversation will show was sent. {'{{1}}'} is the client&apos;s first name.
          </span>
          <textarea value={settings.followUp.text} maxLength={1024} rows={3}
            onChange={(e) => update({ followUp: { ...settings.followUp, text: e.target.value } })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
        </label>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.followUp.useName}
              onChange={(e) => update({ followUp: { ...settings.followUp, useName: e.target.checked } })}
              className="h-4 w-4 rounded border-slate-300" />
            <span className="text-sm text-slate-900">The template has {'{{1}}'} for the first name</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-slate-900">At most</span>
            <input type="number" min={1} max={200} value={settings.followUp.dailyLimit}
              onChange={(e) => update({ followUp: { ...settings.followUp, dailyLimit: Math.max(1, Math.min(200, Number(e.target.value) || 1)) } })}
              className="w-20 min-h-11 rounded-lg border border-slate-300 px-3 text-sm" />
            <span className="text-sm text-slate-900">a day</span>
          </label>
        </div>
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
