'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive, ArrowUpDown, Building2, CircleDollarSign, Edit, Eye, EyeOff, Layers,
  ListChecks, Plus, Search, Star, Tag, Trash2, X,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'
import { normalizeFileUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/admin/ui/ConfirmDialog'
import { EmptyState, PageHeader, StatCard } from '@/components/admin/ui/layout'
import { SelectInput, TextInput } from '@/components/admin/ui/form'
import { countryFlag, inMarket, MARKET_OPTIONS, type MarketScope } from '@/lib/market'
import { typeLabel } from '@/lib/property-types'
import { cn } from '@/lib/utils'

const KIND_LABELS: Record<string, string> = {
  STANDALONE: 'Standalone',
  PROJECT: 'Project',
  COMMUNITY: 'Community',
  MIXED_USE: 'Mixed use',
}

const STATUS_LABELS: Record<string, string> = {
  OFF_PLAN: 'Off-plan',
  NEW_BUILD: 'New build',
  RESALE: 'Resale',
}

const STATUS_COLORS: Record<string, string> = {
  OFF_PLAN: 'bg-violet-100 text-violet-700',
  NEW_BUILD: 'bg-sky-100 text-sky-700',
  RESALE: 'bg-zinc-100 text-zinc-600',
}

// Short labels for the compact unit-mix line; anything else falls back to the
// shared registry so new types show up automatically.
const SHORT_LABELS: Record<string, string> = { APARTMENT: 'apt', LAND_PARCEL: 'land', PARKING: 'parking' }
const unitKindLabel = (k: string) => SHORT_LABELS[k] ?? typeLabel(k).toLowerCase()

type SortKey = 'newest' | 'oldest' | 'views' | 'units' | 'title'
type BulkAction = 'delete' | 'archive' | 'sold'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialBuildings: any[]
}

function relativeDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** Summarise a building's units into a compact "2 apt · 1 land" string. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unitMix(units: any[] = []): string {
  if (!units.length) return ''
  const counts = new Map<string, number>()
  for (const u of units) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1)
  return Array.from(counts.entries()).map(([k, n]) => `${n} ${unitKindLabel(k)}`).join(' · ')
}

const ACTION_META: Record<BulkAction, { title: string; verb: string; note: string; danger: boolean }> = {
  delete: {
    title: 'Delete',
    verb: 'permanently delete',
    note: 'Their units, listings and photos go too. This cannot be undone.',
    danger: true,
  },
  archive: {
    title: 'Archive',
    verb: 'archive',
    note: 'They come off the website and their listings are archived. Nothing is lost.',
    danger: false,
  },
  sold: {
    title: 'Mark sold',
    verb: 'mark as sold',
    note: 'Every unit becomes sold and all their listings close. They stay in your records.',
    danger: false,
  },
}

export function BuildingsAdminClient({ initialBuildings }: Props) {
  const router = useRouter()
  const [buildings, setBuildings] = useState(initialBuildings)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  // One back office holds both markets, so it needs a way to look at one.
  const [market, setMarket] = useState<MarketScope>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [actionTarget, setActionTarget] = useState<any | null>(null)
  const [pending, setPending] = useState<null | { action: BulkAction; ids: string[]; label: string }>(null)

  const stats = useMemo(() => ({
    total: buildings.length,
    listed: buildings.filter((b) => (b._count?.listings ?? 0) > 0).length,
    units: buildings.reduce((s, b) => s + (b._count?.units ?? b.units?.length ?? 0), 0),
    views: buildings.reduce((s, b) => s + (b.views ?? 0), 0),
  }), [buildings])

  const activeFilters = [
    market !== 'all', sourceFilter !== 'all', kindFilter !== 'all', statusFilter !== 'all',
  ].filter(Boolean).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out = buildings.filter((b) => {
      // Ref is first so pasting "PG-1042" finds it instantly.
      const matchSearch = !q
        || b.ref?.toLowerCase().includes(q)
        || b.title?.toLowerCase().includes(q)
        || b.city?.toLowerCase().includes(q)
        || b.caza?.toLowerCase().includes(q)
      return matchSearch
        && (kindFilter === 'all' || b.kind === kindFilter)
        && (statusFilter === 'all' || b.status === statusFilter)
        && (sourceFilter === 'all' || (b.source ?? 'ADMIN') === sourceFilter)
        && inMarket(b.country, market)
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const time = (b: any) => new Date(b.createdAt ?? 0).getTime()
    out.sort((a, b) => {
      switch (sort) {
        case 'oldest': return time(a) - time(b)
        case 'views': return (b.views ?? 0) - (a.views ?? 0)
        case 'units': return (b._count?.units ?? 0) - (a._count?.units ?? 0)
        case 'title': return (a.title ?? '').localeCompare(b.title ?? '')
        default: return time(b) - time(a)
      }
    })
    return out
  }, [buildings, search, kindFilter, statusFilter, sourceFilter, market, sort])

  // Only keep selections that are still visible under the current filters —
  // acting on a row you can't see is how the wrong property gets archived.
  const visibleSelected = useMemo(() => filtered.filter((b) => selected.has(b.id)), [filtered, selected])
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length
  const selectedIds = visibleSelected.map((b) => b.id)

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) filtered.forEach((b) => next.delete(b.id))
      else filtered.forEach((b) => next.add(b.id))
      return next
    })
  }

  function clearFilters() {
    setSearch(''); setMarket('all'); setSourceFilter('all'); setKindFilter('all'); setStatusFilter('all')
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function applyAction(ids: string[], action: BulkAction) {
    setBusy(true)
    const failures: string[] = []
    for (const id of ids) {
      try {
        if (action === 'delete') await apiClient.deleteBuilding(id)
        else if (action === 'archive') await apiClient.archiveBuilding(id)
        else await apiClient.markBuildingSold(id)
      } catch {
        failures.push(id)
      }
    }
    setBuildings((prev) => {
      if (action === 'delete') return prev.filter((b) => !ids.includes(b.id) || failures.includes(b.id))
      return prev.map((b) => {
        if (!ids.includes(b.id) || failures.includes(b.id)) return b
        if (action === 'archive') return { ...b, visibility: 'HIDDEN' }
        return { ...b, _sold: true, _count: { ...(b._count ?? {}), listings: 0 } }
      })
    })
    setSelected(new Set())
    setBusy(false)
    setPending(null)
    setActionTarget(null)

    const done = ids.length - failures.length
    toast({
      title: failures.length
        ? `${done} of ${ids.length} updated`
        : `${done} propert${done === 1 ? 'y' : 'ies'} ${action === 'delete' ? 'deleted' : action === 'archive' ? 'archived' : 'marked sold'}`,
      description: failures.length ? `${failures.length} could not be updated — try again.` : undefined,
      variant: failures.length ? 'destructive' : 'default',
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Properties"
        description="Every building, land plot and project across both websites."
        actions={
          <Link
            href="/admin/buildings/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" /> Add property
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Properties" value={stats.total} />
        <StatCard
          icon={<ListChecks className="h-4 w-4" />}
          label="On the market"
          value={stats.listed}
          accent="text-emerald-600"
          hint={stats.total ? `${stats.total - stats.listed} not listed` : undefined}
        />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Units" value={stats.units} />
        <StatCard icon={<Eye className="h-4 w-4" />} label="Views" value={stats.views.toLocaleString()} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a reference, title or city…"
            className="pl-9"
          />
        </div>
        <SelectInput value={market} onChange={(e) => setMarket(e.target.value as MarketScope)} className="w-auto min-w-[9rem]">
          {MARKET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectInput>
        <SelectInput value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-auto min-w-[9rem]">
          <option value="all">Any source</option>
          <option value="ADMIN">Posted by us</option>
          <option value="OWNER">Owner submitted</option>
        </SelectInput>
        <SelectInput value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="w-auto min-w-[8rem]">
          <option value="all">Any structure</option>
          {Object.entries(KIND_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectInput>
        <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[8rem]">
          <option value="all">Any status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectInput>
        <SelectInput value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto min-w-[8.5rem]">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="views">Most viewed</option>
          <option value="units">Most units</option>
          <option value="title">Title A–Z</option>
        </SelectInput>
      </div>

      {(activeFilters > 0 || search) && (
        <div className="-mt-2 flex items-center gap-2 text-xs text-slate-400">
          <ArrowUpDown className="h-3 w-3" />
          Showing {filtered.length} of {buildings.length}
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-slate-500 underline transition-colors hover:text-slate-800"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-white">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <span className="h-4 w-px bg-white/20" />
          <BulkButton icon={<Archive className="h-3.5 w-3.5" />} onClick={() => setPending({ action: 'archive', ids: selectedIds, label: '' })} disabled={busy}>
            Archive
          </BulkButton>
          <BulkButton icon={<CircleDollarSign className="h-3.5 w-3.5" />} onClick={() => setPending({ action: 'sold', ids: selectedIds, label: '' })} disabled={busy}>
            Mark sold
          </BulkButton>
          <BulkButton icon={<Trash2 className="h-3.5 w-3.5" />} danger onClick={() => setPending({ action: 'delete', ids: selectedIds, label: '' })} disabled={busy}>
            Delete
          </BulkButton>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title={buildings.length === 0 ? 'No properties yet' : 'Nothing matches those filters'}
          description={
            buildings.length === 0
              ? 'Add your first building, villa or land plot.'
              : 'Try a different search, or clear the filters.'
          }
          action={
            buildings.length === 0 ? (
              <Link
                href="/admin/buildings/new"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus className="h-4 w-4" /> Add property
              </Link>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop table. `overflow-hidden` on a wrapper clips rather than
              scrolls, so the horizontal scroll lives on the same element. */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && visibleSelected.length > 0 }}
                      onChange={toggleAllVisible}
                      className="cursor-pointer rounded border-slate-300"
                      aria-label="Select all shown"
                    />
                  </th>
                  <th className="px-3 py-2.5">Property</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-center">Units</th>
                  <th className="px-3 py-2.5 text-center">Views</th>
                  <th className="px-3 py-2.5">Added</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => {
                  const hidden = b.visibility === 'HIDDEN'
                  const isSelected = selected.has(b.id)
                  return (
                    <tr
                      key={b.id}
                      onClick={() => router.push(`/admin/buildings/${b.id}`)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-slate-50',
                        hidden && 'opacity-60',
                        isSelected && 'bg-sky-50/60',
                      )}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(b.id)}
                          className="cursor-pointer rounded border-slate-300"
                          aria-label={`Select ${b.title}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <PropertyCell b={b} hidden={hidden} />
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-600">
                        {[b.city, b.caza].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn(
                          'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                          STATUS_COLORS[b.status] ?? 'bg-slate-100 text-slate-700',
                        )}>
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="text-sm font-medium text-slate-900">{b._count?.units ?? b.units?.length ?? 0}</div>
                        <ListedHint b={b} />
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm text-slate-600">
                        {b.views?.toLocaleString() ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-500">
                        {relativeDate(b.createdAt)}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <RowActions b={b} onRemove={() => setActionTarget(b)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Phone: a table of eight columns in a side-scroller is unreadable,
              so the same rows become cards with what matters folded in. */}
          <ul className="space-y-2.5 md:hidden">
            {filtered.map((b) => {
              const hidden = b.visibility === 'HIDDEN'
              const isSelected = selected.has(b.id)
              return (
                <li
                  key={b.id}
                  className={cn(
                    'rounded-xl border bg-white p-3',
                    isSelected ? 'border-slate-800 ring-1 ring-slate-800/10' : 'border-slate-200',
                    hidden && 'opacity-60',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(b.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                      aria-label={`Select ${b.title}`}
                    />
                    <Link href={`/admin/buildings/${b.id}`} className="min-w-0 flex-1">
                      <PropertyCell b={b} hidden={hidden} />
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{[b.city, b.caza].filter(Boolean).join(', ') || 'No location'}</span>
                        <span className={cn(
                          'rounded px-1.5 py-0.5 font-medium',
                          STATUS_COLORS[b.status] ?? 'bg-slate-100 text-slate-700',
                        )}>
                          {STATUS_LABELS[b.status] ?? b.status}
                        </span>
                        <span>{b._count?.units ?? 0} units</span>
                        <span>{b.views ?? 0} views</span>
                        <span>{relativeDate(b.createdAt)}</span>
                      </div>
                    </Link>
                    <RowActions b={b} onRemove={() => setActionTarget(b)} />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* One property: which way do you want it gone? */}
      {actionTarget && (
        <RemovePropertyDialog
          building={actionTarget}
          busy={busy}
          onClose={() => setActionTarget(null)}
          onPick={(action) => {
            setActionTarget(null)
            setPending({ action, ids: [actionTarget.id], label: actionTarget.title })
          }}
        />
      )}

      <ConfirmDialog
        open={!!pending}
        tone={pending && ACTION_META[pending.action].danger ? 'danger' : 'default'}
        busy={busy}
        title={
          pending
            ? pending.ids.length === 1 && pending.label
              ? `${ACTION_META[pending.action].title} “${pending.label}”?`
              : `${ACTION_META[pending.action].title} ${pending?.ids.length} properties?`
            : ''
        }
        description={pending ? ACTION_META[pending.action].note : undefined}
        // Deleting is the one that cannot be walked back, so it asks you to
        // type the name — a mis-tap in a bulk bar shouldn't erase a catalogue.
        requireText={
          pending?.action === 'delete'
            ? (pending.ids.length === 1 && pending.label ? pending.label : `delete ${pending.ids.length}`)
            : undefined
        }
        confirmLabel={pending ? ACTION_META[pending.action].title : 'Confirm'}
        onConfirm={() => pending && applyAction(pending.ids, pending.action)}
        onClose={() => !busy && setPending(null)}
      />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PropertyCell({ b, hidden }: { b: any; hidden: boolean }) {
  const mix = unitMix(b.units)
  return (
    <div className="flex items-center gap-3">
      {b.images?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={normalizeFileUrl(b.images[0])} alt="" className="h-11 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-slate-100">
          <Building2 className="h-4 w-4 text-slate-400" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-[11px]" title={b.country ?? 'LEBANON'}>{countryFlag(b.country)}</span>
          {b.ref && (
            <span className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
              {b.ref}
            </span>
          )}
          <p className="truncate text-sm font-medium text-slate-900">{b.title}</p>
          {b.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
          {hidden && <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
          {b.source === 'OWNER' && (
            <span
              className="shrink-0 rounded border border-teal-200 bg-teal-50 px-1.5 text-[10px] font-semibold text-teal-700"
              title="Came in through the public owner-submission form"
            >
              Owner
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="rounded border border-slate-200 px-1.5 text-[10px] text-slate-500">
            {KIND_LABELS[b.kind] ?? b.kind}
          </span>
          {mix && <span className="truncate text-xs text-slate-400">{mix}</span>}
        </div>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ListedHint({ b }: { b: any }) {
  if (b._sold) return <div className="text-xs font-medium text-slate-400">sold</div>
  if ((b._count?.listings ?? 0) > 0) {
    return <div className="text-xs font-medium text-emerald-600">{b._count.listings} listed</div>
  }
  return <div className="text-xs text-slate-300">not listed</div>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RowActions({ b, onRemove }: { b: any; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Link
        href={`/admin/listings?buildingId=${b.id}`}
        title="Its listings"
        aria-label="Its listings"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-600"
      >
        <Tag className="h-3.5 w-3.5" />
      </Link>
      <Link
        href={`/admin/buildings/${b.id}`}
        title="Edit"
        aria-label="Edit"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <Edit className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={onRemove}
        title="Archive, mark sold or delete"
        aria-label="Archive, mark sold or delete"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function BulkButton({
  icon, children, onClick, disabled, danger,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors disabled:opacity-50',
        danger ? 'text-red-300 hover:bg-red-500/20' : 'hover:bg-white/10',
      )}
    >
      {icon}{children}
    </button>
  )
}

/**
 * Taking a property down is three different decisions that used to share one
 * bin icon. Naming them is the difference between hiding a property for the
 * season and erasing it.
 */
function RemovePropertyDialog({
  building, busy, onClose, onPick,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  building: any
  busy: boolean
  onClose: () => void
  onPick: (action: BulkAction) => void
}) {
  const listings = building._count?.listings ?? 0
  const options = [
    {
      action: 'archive' as const,
      icon: <Archive className="h-5 w-5 text-sky-600" />,
      title: 'Archive it',
      desc: 'Comes off the website, listings archived. Nothing is lost — restore it whenever.',
    },
    {
      action: 'sold' as const,
      icon: <CircleDollarSign className="h-5 w-5 text-emerald-600" />,
      title: 'Mark it sold',
      desc: 'Every unit becomes sold and its listings close. It stays in your records.',
    },
    {
      action: 'delete' as const,
      icon: <Trash2 className="h-5 w-5 text-red-600" />,
      title: 'Delete it for good',
      desc: 'Erases the property, its units, listings and photos. This cannot be undone.',
      danger: true,
    },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900">Take “{building.title}” down</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {listings > 0
                ? `It has ${listings} listing${listings === 1 ? '' : 's'}. Choose what happens to them.`
                : 'Choose what happens to it.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-2.5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          {options.map((o) => (
            <button
              key={o.action}
              type="button"
              onClick={() => onPick(o.action)}
              disabled={busy}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
                o.danger ? 'border-red-100 hover:bg-red-50' : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <span className="mt-0.5 shrink-0">{o.icon}</span>
              <span>
                <span className={cn('block text-sm font-semibold', o.danger ? 'text-red-700' : 'text-slate-900')}>
                  {o.title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
