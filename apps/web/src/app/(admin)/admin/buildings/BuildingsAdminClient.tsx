'use client'

import { useMemo, useState } from 'react'
import { Plus, Building2, Search, Edit, Trash2, Tag, Eye, EyeOff, Star, ArrowUpDown, Layers, ListChecks, Archive, CircleDollarSign, X, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api/client'
import { normalizeFileUrl } from '@/lib/utils/api-url'

const KIND_LABELS: Record<string, string> = {
  STANDALONE: 'Standalone',
  PROJECT: 'Project',
  COMMUNITY: 'Community',
  MIXED_USE: 'Mixed Use',
}

const STATUS_LABELS: Record<string, string> = {
  OFF_PLAN: 'Off-Plan',
  NEW_BUILD: 'New Build',
  RESALE: 'Resale',
}

const STATUS_COLORS: Record<string, string> = {
  OFF_PLAN: 'bg-violet-100 text-violet-700',
  NEW_BUILD: 'bg-sky-100 text-sky-700',
  RESALE:   'bg-zinc-100 text-zinc-600',
}

const UNIT_KIND_LABELS: Record<string, string> = {
  APARTMENT: 'Apt', STUDIO: 'Studio', DUPLEX: 'Duplex', PENTHOUSE: 'Penthouse',
  VILLA: 'Villa', TOWNHOUSE: 'Townhouse', SHOP: 'Shop', OFFICE: 'Office',
  LAND_PARCEL: 'Land', STORAGE: 'Storage', PARKING: 'Parking',
}

type SortKey = 'newest' | 'oldest' | 'views' | 'units' | 'title'

interface Props {
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

/** Summarise a building's units into a compact "2 Apt · 1 Land" string. */
function unitMix(units: any[] = []): string {
  if (!units.length) return ''
  const counts = new Map<string, number>()
  for (const u of units) counts.set(u.kind, (counts.get(u.kind) ?? 0) + 1)
  return Array.from(counts.entries())
    .map(([k, n]) => `${n} ${UNIT_KIND_LABELS[k] ?? k}`)
    .join(' · ')
}

export function BuildingsAdminClient({ initialBuildings }: Props) {
  const router = useRouter()
  const [buildings, setBuildings] = useState(initialBuildings)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('newest')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  // Single-row action dialog: which building + null when closed.
  const [actionTarget, setActionTarget] = useState<any | null>(null)
  // Bulk action confirm dialog: which action, or null.
  const [bulkAction, setBulkAction] = useState<null | 'delete' | 'archive' | 'sold'>(null)

  const stats = useMemo(() => ({
    total: buildings.length,
    listed: buildings.filter(b => (b._count?.listings ?? 0) > 0).length,
    units: buildings.reduce((s, b) => s + (b._count?.units ?? b.units?.length ?? 0), 0),
    views: buildings.reduce((s, b) => s + (b.views ?? 0), 0),
  }), [buildings])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const out = buildings.filter(b => {
      const matchSearch = !q || b.title?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) || b.caza?.toLowerCase().includes(q)
      const matchKind = kindFilter === 'all' || b.kind === kindFilter
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      const matchSource = sourceFilter === 'all' || (b.source ?? 'ADMIN') === sourceFilter
      return matchSearch && matchKind && matchStatus && matchSource
    })
    const time = (b: any) => new Date(b.createdAt ?? 0).getTime()
    out.sort((a, b) => {
      switch (sort) {
        case 'oldest': return time(a) - time(b)
        case 'views': return (b.views ?? 0) - (a.views ?? 0)
        case 'units': return (b._count?.units ?? 0) - (a._count?.units ?? 0)
        case 'title': return (a.title ?? '').localeCompare(b.title ?? '')
        default: return time(b) - time(a) // newest
      }
    })
    return out
  }, [buildings, search, kindFilter, statusFilter, sourceFilter, sort])

  // Only keep selections that are still visible under the current filters.
  const visibleSelected = useMemo(
    () => filtered.filter(b => selected.has(b.id)),
    [filtered, selected],
  )
  const allVisibleSelected = filtered.length > 0 && visibleSelected.length === filtered.length

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) filtered.forEach(b => next.delete(b.id))
      else filtered.forEach(b => next.add(b.id))
      return next
    })
  }
  function clearSelection() { setSelected(new Set()) }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function applyAction(ids: string[], action: 'delete' | 'archive' | 'sold') {
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
    setBuildings(prev => {
      if (action === 'delete') return prev.filter(b => !ids.includes(b.id) || failures.includes(b.id))
      // archive → reflect hidden; sold → mark listings closed locally
      return prev.map(b => {
        if (!ids.includes(b.id) || failures.includes(b.id)) return b
        if (action === 'archive') return { ...b, visibility: 'HIDDEN' }
        return { ...b, _sold: true, _count: { ...(b._count ?? {}), listings: 0 } }
      })
    })
    setSelected(new Set())
    setBusy(false)
    if (failures.length) alert(`${failures.length} propert${failures.length === 1 ? 'y' : 'ies'} could not be updated.`)
  }

  const selectedIds = visibleSelected.map(b => b.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage every building, land plot and project — newest first.</p>
        </div>
        <Link href="/admin/buildings/new">
          <Button className="bg-slate-800 hover:bg-slate-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="Properties" value={stats.total} />
        <StatCard icon={<ListChecks className="h-4 w-4" />} label="Listed for sale/rent" value={stats.listed} accent="text-emerald-600" />
        <StatCard icon={<Layers className="h-4 w-4" />} label="Total units" value={stats.units} />
        <StatCard icon={<Eye className="h-4 w-4" />} label="Total views" value={stats.views.toLocaleString()} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by title, city, caza..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="ADMIN">Posted by us</SelectItem>
            <SelectItem value="OWNER">Owner submitted</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All kinds" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="STANDALONE">Standalone</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="COMMUNITY">Community</SelectItem>
            <SelectItem value="MIXED_USE">Mixed Use</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="OFF_PLAN">Off-Plan</SelectItem>
            <SelectItem value="NEW_BUILD">New Build</SelectItem>
            <SelectItem value="RESALE">Resale</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
          <SelectTrigger className="w-[140px]"><ArrowUpDown className="h-3.5 w-3.5 mr-1 text-slate-400" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="views">Most viewed</SelectItem>
            <SelectItem value="units">Most units</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length !== buildings.length && selectedIds.length === 0 && (
        <p className="text-xs text-slate-400 -mt-2">Showing {filtered.length} of {buildings.length}</p>
      )}

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-slate-900 text-white rounded-xl px-4 py-2.5 -mt-2">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="h-4 w-px bg-white/20" />
          <button onClick={() => setBulkAction('archive')} disabled={busy} className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
            <Archive className="h-3.5 w-3.5" /> Archive
          </button>
          <button onClick={() => setBulkAction('sold')} disabled={busy} className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg hover:bg-white/10 disabled:opacity-50">
            <CircleDollarSign className="h-3.5 w-3.5" /> Mark sold
          </button>
          <button onClick={() => setBulkAction('delete')} disabled={busy} className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-lg text-red-300 hover:bg-red-500/20 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button onClick={clearSelection} className="ml-auto text-sm text-white/70 hover:text-white inline-flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={el => { if (el) el.indeterminate = !allVisibleSelected && visibleSelected.length > 0 }}
                  onChange={toggleAllVisible}
                  className="rounded border-slate-300 cursor-pointer"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Units / Listed</TableHead>
              <TableHead className="text-center">Views</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No properties found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(b => {
                const hidden = b.visibility === 'HIDDEN'
                const isSelected = selected.has(b.id)
                const mix = unitMix(b.units)
                return (
                  <TableRow
                    key={b.id}
                    className={`group cursor-pointer hover:bg-slate-50 ${hidden ? 'opacity-60' : ''} ${isSelected ? 'bg-sky-50/60' : ''}`}
                    onClick={() => router.push(`/admin/buildings/${b.id}`)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(b.id)}
                        className="rounded border-slate-300 cursor-pointer"
                        aria-label={`Select ${b.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {b.images?.[0] ? (
                          <img src={normalizeFileUrl(b.images[0])} alt="" className="h-11 w-16 object-cover rounded-md shrink-0" />
                        ) : (
                          <div className="h-11 w-16 bg-slate-100 rounded-md flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-slate-900 text-sm truncate">{b.title}</p>
                            {b.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                            {hidden && <EyeOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            {b.source === 'OWNER' && (
                              <span className="shrink-0 px-1.5 py-0 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200" title="Came in through the public owner-submission form">
                                Owner
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{KIND_LABELS[b.kind] ?? b.kind}</Badge>
                            {mix && <span className="text-xs text-slate-400 truncate">{mix}</span>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {[b.city, b.caza].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[b.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm font-medium text-zinc-900">{b._count?.units ?? b.units?.length ?? 0}</div>
                      {b._sold ? (
                        <div className="text-xs text-slate-400 font-medium">sold</div>
                      ) : (b._count?.listings ?? 0) > 0 ? (
                        <div className="text-xs text-emerald-600 font-medium">{b._count.listings} listed</div>
                      ) : (
                        <div className="text-xs text-slate-300">not listed</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-slate-600">
                      {b.views?.toLocaleString() ?? 0}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {relativeDate(b.createdAt)}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/listings?buildingId=${b.id}`} title="Manage listings">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-sky-600">
                            <Tag className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/admin/buildings/${b.id}`} title="Edit">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setActionTarget(b)}
                          title="Delete, archive or mark sold"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Single-property action dialog */}
      {actionTarget && (
        <RemovePropertyDialog
          building={actionTarget}
          busy={busy}
          onClose={() => setActionTarget(null)}
          onConfirm={async (action) => {
            await applyAction([actionTarget.id], action)
            setActionTarget(null)
          }}
        />
      )}

      {/* Bulk action confirm dialog */}
      {bulkAction && (
        <BulkConfirmDialog
          count={selectedIds.length}
          action={bulkAction}
          busy={busy}
          onClose={() => setBulkAction(null)}
          onConfirm={async () => {
            await applyAction(selectedIds, bulkAction)
            setBulkAction(null)
          }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">{icon}{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">{children}</div>
    </div>
  )
}

/** Offers the three ways to take a property down: archive, mark sold, or delete. */
function RemovePropertyDialog({
  building, busy, onClose, onConfirm,
}: {
  building: any
  busy: boolean
  onClose: () => void
  onConfirm: (action: 'delete' | 'archive' | 'sold') => void
}) {
  const listings = building._count?.listings ?? 0
  return (
    <Overlay>
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Remove “{building.title}”?</h2>
          <p className="text-sm text-slate-500 mt-0.5">Choose what to do with this property{listings > 0 ? ` and its ${listings} listing${listings === 1 ? '' : 's'}` : ''}.</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-4 space-y-2.5">
        <OptionButton
          icon={<Archive className="h-5 w-5 text-sky-600" />}
          title="Archive"
          desc="Hide it from the website and archive its listings. Nothing is lost — you can restore it later."
          onClick={() => onConfirm('archive')}
          disabled={busy}
        />
        <OptionButton
          icon={<CircleDollarSign className="h-5 w-5 text-emerald-600" />}
          title="Mark as sold"
          desc="Set every unit to sold and close all its listings. It stays in your records."
          onClick={() => onConfirm('sold')}
          disabled={busy}
        />
        <OptionButton
          icon={<Trash2 className="h-5 w-5 text-red-600" />}
          title="Delete permanently"
          desc="Erase the property, its units, listings and photos for good. This cannot be undone."
          danger
          onClick={() => { if (confirm(`Permanently delete “${building.title}”? This cannot be undone.`)) onConfirm('delete') }}
          disabled={busy}
        />
      </div>
      {busy && <div className="px-4 pb-4 text-sm text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Working…</div>}
    </Overlay>
  )
}

function OptionButton({
  icon, title, desc, onClick, disabled, danger,
}: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; disabled?: boolean; danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors disabled:opacity-50 ${
        danger ? 'border-red-100 hover:bg-red-50' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>
        <span className={`block text-sm font-semibold ${danger ? 'text-red-700' : 'text-slate-900'}`}>{title}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
      </span>
    </button>
  )
}

function BulkConfirmDialog({
  count, action, busy, onClose, onConfirm,
}: {
  count: number
  action: 'delete' | 'archive' | 'sold'
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const meta = {
    delete: { title: 'Delete', verb: 'permanently delete', note: 'This erases the properties, their units, listings and photos for good. This cannot be undone.', danger: true },
    archive: { title: 'Archive', verb: 'archive', note: 'They will be hidden from the website and their listings archived. You can restore them later.', danger: false },
    sold: { title: 'Mark sold', verb: 'mark as sold', note: 'Every unit becomes sold and all their listings close.', danger: false },
  }[action]
  return (
    <Overlay>
      <div className="p-5">
        <div className="flex items-center gap-2.5">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta.danger ? 'bg-red-100' : 'bg-slate-100'}`}>
            {meta.danger ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <Archive className="h-5 w-5 text-slate-600" />}
          </div>
          <h2 className="font-semibold text-slate-900">{meta.title} {count} propert{count === 1 ? 'y' : 'ies'}?</h2>
        </div>
        <p className="text-sm text-slate-500 mt-3">Are you sure you want to {meta.verb} the {count} selected propert{count === 1 ? 'y' : 'ies'}? {meta.note}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2 ${meta.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {meta.title}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
