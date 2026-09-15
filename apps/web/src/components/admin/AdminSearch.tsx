'use client'

/**
 * Jump to anything — ⌘K / Ctrl+K.
 *
 * The back office had no search of its own. Finding the property a client just
 * quoted over WhatsApp meant: open Properties, wait for two hundred rows, type
 * into the table filter. Three navigations to answer "what is PG-1042?".
 *
 * A reference-shaped query is the common case and is handled first: the
 * backend turns `PG-1042` into an exact lookup, and a unit code (`PG-1042-2`)
 * resolves to its parent property, which is what someone reading a code off a
 * message actually wants.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CornerDownLeft, Loader2, Search, X } from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { canAccessAdminPath, type Role } from '@/lib/permissions'
import { useAuth } from '@/contexts/AuthContext'
import { countryFlag } from '@/lib/market'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_ITEMS } from './Sidebar'

interface BuildingHit {
  id: string
  ref?: string | null
  title: string
  city?: string | null
  country?: string | null
  images?: string[]
  _count?: { units?: number; listings?: number }
}

export function AdminSearch() {
  const router = useRouter()
  const { user } = useAuth()
  const role = (user?.role ?? 'USER') as Role

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<BuildingHit[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const pages = ADMIN_NAV_ITEMS.filter((p) => canAccessAdminPath(role, p.href))
  const q = query.trim()

  const pageHits = q
    ? pages.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4)
    : pages.slice(0, 6)

  // Properties are only searched by an admin — a CRM_MANAGER has no inventory
  // pages to land on, so offering them rows they can't open would be a lie.
  const canSearchProperties = canAccessAdminPath(role, '/admin/buildings')

  const results: Array<{ kind: 'page'; href: string; label: string; icon: React.ComponentType<{ className?: string }> }
    | { kind: 'building'; href: string; building: BuildingHit }> = [
    ...pageHits.map((p) => ({ kind: 'page' as const, href: p.href, label: p.name, icon: p.icon })),
    ...hits.map((b) => ({ kind: 'building' as const, href: `/admin/buildings/${b.id}`, building: b })),
  ]

  // ── Open / close ────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) { setQuery(''); setHits([]); setCursor(0); return }
    const t = setTimeout(() => inputRef.current?.focus(), 20)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { clearTimeout(t); document.body.style.overflow = previous }
  }, [open])

  // ── Search ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !canSearchProperties || q.length < 2) { setHits([]); setLoading(false); return }
    setLoading(true)
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
        // `visibility=all` and `country=all` because an admin owns both markets
        // and hidden stock is exactly what you go looking for by reference.
        const res = await fetch(
          `${apiUrl}/api/buildings?search=${encodeURIComponent(q)}&limit=6&visibility=all&country=all`,
          { credentials: 'include', signal: controller.signal, cache: 'no-store' },
        )
        const d = await res.json()
        setHits(d.data ?? [])
      } catch {
        // Aborted, or the API is down. An empty property list still leaves the
        // page shortcuts usable, which is the more common reason this is open.
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => { clearTimeout(t); controller.abort() }
  }, [q, open, canSearchProperties])

  useEffect(() => { setCursor(0) }, [q])

  const go = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); const r = results[cursor]; if (r) go(r.href) }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 sm:w-64"
        aria-label="Search the back office"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:block">Search PG-1042, a page…</span>
        <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:block">
          ⌘K
        </kbd>
      </button>

      {!open ? null : (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[8vh]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              {loading
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
                : <Search className="h-4 w-4 shrink-0 text-slate-400" />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={canSearchProperties ? 'Search a reference, a property, or a page…' : 'Search pages…'}
                className="min-h-12 flex-1 bg-transparent py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="max-h-[55vh] overflow-y-auto overscroll-contain p-2">
              {results.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-slate-400">
                  {q.length < 2 ? 'Type to search' : loading ? 'Searching…' : 'Nothing found'}
                </li>
              )}
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.href}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r.href)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      cursor === i ? 'bg-slate-100' : 'hover:bg-slate-50',
                    )}
                  >
                    {r.kind === 'page' ? (
                      <>
                        <r.icon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="flex-1 truncate text-sm text-slate-700">{r.label}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">Page</span>
                      </>
                    ) : (
                      <>
                        {r.building.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={normalizeFileUrl(r.building.images[0])}
                            alt=""
                            className="h-8 w-11 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded bg-slate-100">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          </div>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            {r.building.ref && (
                              <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1 font-mono text-[10px] font-semibold text-slate-500">
                                {r.building.ref}
                              </span>
                            )}
                            <span className="truncate text-sm text-slate-800">{r.building.title}</span>
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {countryFlag(r.building.country)} {r.building.city ?? '—'}
                            {r.building._count?.units ? ` · ${r.building._count.units} units` : ''}
                          </span>
                        </span>
                      </>
                    )}
                    {cursor === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
              <span>↑↓ to move</span>
              <span>↵ to open</span>
              <span>esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
