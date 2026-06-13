'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bot, Sparkles, Settings, MessageSquare, Zap, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react'
import { normalizeApiUrl } from '@/lib/utils/api-url'

interface AiSettings {
  aiSearchEnabled: boolean
  aiFabEnabled: boolean
  aiDefaultSearchMode: boolean
  aiMaxResults: number
  aiResponseTimeout: number
}

const DEFAULTS: AiSettings = {
  aiSearchEnabled: true,
  aiFabEnabled: true,
  aiDefaultSearchMode: false,
  aiMaxResults: 50,
  aiResponseTimeout: 10,
}

export default function AISettingsPage() {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [settings, setSettings] = useState<AiSettings>(DEFAULTS)
  const [searchesThisMonth, setSearchesThisMonth] = useState(0)
  const [topQueries, setTopQueries] = useState<Array<{ query: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${apiUrl}/api/settings`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        const d = json.data ?? json
        setSettings({ ...DEFAULTS, ...(d.settings ?? {}) })
        setSearchesThisMonth(d.stats?.searchesThisMonth ?? 0)
        setTopQueries(d.stats?.topQueries ?? [])
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  useEffect(() => { load() }, [load])

  const set = <K extends keyof AiSettings>(k: K, v: AiSettings[K]) =>
    setSettings((p) => ({ ...p, [k]: v }))

  async function save(next: AiSettings = settings) {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`${apiUrl}/api/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      })
      if (!res.ok) throw new Error()
      setMsg({ type: 'success', text: 'Settings saved' })
      setTimeout(() => setMsg(null), 3000)
    } catch {
      setMsg({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const aiConfigured = settings.aiSearchEnabled

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md">
            <Bot className="h-6 w-6 text-white" />
          </div>
          AI Search Settings
        </h1>
        <p className="text-slate-600 mt-1">Configure and manage the AI-powered property search assistant.</p>
      </div>

      {msg && (
        <div className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
          msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="font-medium">{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Real status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              icon={<MessageSquare className="w-6 h-6 text-white" />}
              iconBg="bg-slate-800"
              value={searchesThisMonth.toLocaleString()}
              title="AI Searches"
              sub="This month"
            />
            <StatCard
              icon={<Zap className={`w-6 h-6 ${aiConfigured ? 'text-emerald-600' : 'text-slate-400'}`} />}
              iconBg={aiConfigured ? 'bg-emerald-100' : 'bg-slate-100'}
              value={aiConfigured ? 'Enabled' : 'Disabled'}
              title="AI Search Status"
              sub={aiConfigured ? 'Live on the site' : 'Hidden from visitors'}
            />
            <StatCard
              icon={<Bot className="w-6 h-6 text-violet-600" />}
              iconBg="bg-violet-100"
              value="Haiku 4.5"
              title="Model"
              sub="Anthropic Claude"
            />
          </div>

          {/* Configuration */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-lg mb-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">AI Configuration</h2>
            </div>
            <div className="p-6 space-y-6">
              <Toggle
                title="Enable AI Search"
                desc="Allow users to search properties using natural language"
                checked={settings.aiSearchEnabled}
                onChange={(v) => set('aiSearchEnabled', v)}
              />
              <Toggle
                title="Floating AI Assistant"
                desc="Display the floating AI chat button on public pages"
                checked={settings.aiFabEnabled}
                onChange={(v) => set('aiFabEnabled', v)}
              />
              <Toggle
                title="AI Search as Default"
                desc="Make AI search the default mode on the homepage"
                checked={settings.aiDefaultSearchMode}
                onChange={(v) => set('aiDefaultSearchMode', v)}
              />
              <div className="pb-6 border-b border-slate-100">
                <label className="block mb-2">
                  <span className="font-semibold text-slate-900">Maximum Results</span>
                  <p className="text-sm text-slate-600">Limit the number of properties returned per search</p>
                </label>
                <select
                  value={settings.aiMaxResults}
                  onChange={(e) => set('aiMaxResults', Number(e.target.value))}
                  className="mt-2 block w-full max-w-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800/15"
                >
                  {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} properties</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2">
                  <span className="font-semibold text-slate-900">Response Timeout</span>
                  <p className="text-sm text-slate-600">Maximum time to wait for AI processing (seconds)</p>
                </label>
                <select
                  value={settings.aiResponseTimeout}
                  onChange={(e) => set('aiResponseTimeout', Number(e.target.value))}
                  className="mt-2 block w-full max-w-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800/15"
                >
                  {[5, 10, 15, 30].map((n) => <option key={n} value={n}>{n} seconds</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setSettings(DEFAULTS); save(DEFAULTS) }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Reset to Defaults
              </button>
              <button
                onClick={() => save()}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* Real popular queries */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-lg">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Popular Search Queries</h2>
            </div>
            <div className="p-6">
              {topQueries.length === 0 ? (
                <p className="text-sm text-slate-400">No AI searches recorded yet. Queries will appear here as visitors use AI search.</p>
              ) : (
                <div className="space-y-3">
                  {topQueries.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-medium text-slate-400">#{i + 1}</span>
                        <span className="text-sm text-slate-900 truncate">{item.query}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 shrink-0 ml-3">{item.count} <span className="text-xs text-slate-400 font-normal">searches</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, iconBg, value, title, sub }: { icon: React.ReactNode; iconBg: string; value: string; title: string; sub: string }) {
  return (
    <div className="bg-white border-2 border-slate-100 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center shadow-sm`}>{icon}</div>
        <span className="text-2xl font-black text-slate-900">{value}</span>
      </div>
      <h3 className="font-bold text-slate-900 mb-0.5">{title}</h3>
      <p className="text-sm text-slate-600">{sub}</p>
    </div>
  )
}

function Toggle({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between pb-6 border-b border-slate-100">
      <div className="pr-4">
        <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-slate-800' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
