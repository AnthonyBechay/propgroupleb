'use client'

import { useMemo, useState } from 'react'
import { Plus, Building2, Search, Edit, Trash2, Tag, Eye, EyeOff, Star, ArrowUpDown, Layers, ListChecks } from 'lucide-react'
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
  const [sort, setSort] = useState<SortKey>('newest')
  const [deleting, setDeleting] = useState<string | null>(null)

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
      return matchSearch && matchKind && matchStatus
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
  }, [buildings, search, kindFilter, statusFilter, sort])

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation()
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await apiClient.deleteBuilding(id)
      setBuildings(prev => prev.filter(b => b.id !== id))
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

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
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All kinds" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="STANDALONE">Standalone</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="COMMUNITY">Community</SelectItem>
            <SelectItem value="MIXED_USE">Mixed Use</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="OFF_PLAN">Off-Plan</SelectItem>
            <SelectItem value="NEW_BUILD">New Build</SelectItem>
            <SelectItem value="RESALE">Resale</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
          <SelectTrigger className="w-[150px]"><ArrowUpDown className="h-3.5 w-3.5 mr-1 text-slate-400" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="views">Most viewed</SelectItem>
            <SelectItem value="units">Most units</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length !== buildings.length && (
        <p className="text-xs text-slate-400 -mt-2">Showing {filtered.length} of {buildings.length}</p>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
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
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No properties found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(b => {
                const hidden = b.visibility === 'HIDDEN'
                const mix = unitMix(b.units)
                return (
                  <TableRow
                    key={b.id}
                    className={`group cursor-pointer hover:bg-slate-50 ${hidden ? 'opacity-60' : ''}`}
                    onClick={() => router.push(`/admin/buildings/${b.id}`)}
                  >
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
                      {(b._count?.listings ?? 0) > 0 ? (
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
                          onClick={(e) => handleDelete(e, b.id, b.title)}
                          disabled={deleting === b.id}
                          title="Delete"
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
