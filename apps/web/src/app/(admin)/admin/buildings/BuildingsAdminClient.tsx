'use client'

import { useState } from 'react'
import { Plus, Building2, Search, Filter, Eye, Edit, Trash2, ExternalLink } from 'lucide-react'
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
import { apiClient } from '@/lib/api/client'

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

interface Props {
  initialBuildings: any[]
}

export function BuildingsAdminClient({ initialBuildings }: Props) {
  const [buildings, setBuildings] = useState(initialBuildings)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = buildings.filter(b => {
    const matchSearch = !search || b.title?.toLowerCase().includes(search.toLowerCase()) ||
      b.city?.toLowerCase().includes(search.toLowerCase()) ||
      b.caza?.toLowerCase().includes(search.toLowerCase())
    const matchKind = kindFilter === 'all' || b.kind === kindFilter
    return matchSearch && matchKind
  })

  async function handleDelete(id: string, title: string) {
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
          <h1 className="text-2xl font-bold text-slate-900">Buildings</h1>
          <p className="text-slate-500 text-sm mt-0.5">{buildings.length} total buildings</p>
        </div>
        <Link href="/admin/buildings/new">
          <Button className="bg-slate-800 hover:bg-slate-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Building
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="STANDALONE">Standalone</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="COMMUNITY">Community</SelectItem>
            <SelectItem value="MIXED_USE">Mixed Use</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-50">
              <TableHead>Building</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Units / Listings</TableHead>
              <TableHead className="text-center">Views</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  No buildings found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(b => (
                <TableRow key={b.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {b.images?.[0] ? (
                        <img src={b.images[0]} alt="" className="h-10 w-14 object-cover rounded-md" />
                      ) : (
                        <div className="h-10 w-14 bg-slate-100 rounded-md flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-slate-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{b.title}</p>
                        {b.slug && (
                          <p className="text-xs text-slate-400 font-mono">{b.slug}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {KIND_LABELS[b.kind] ?? b.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {[b.city, b.caza, b.mohafazat].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[b.status] ?? 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABELS[b.status] ?? b.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="text-sm font-medium text-zinc-900">{b._count?.units ?? b.units?.length ?? 0}</div>
                    {(b._count?.listings ?? 0) > 0 && (
                      <div className="text-xs text-emerald-600 font-medium">{b._count.listings} listed</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-600">
                    {b.views?.toLocaleString() ?? 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {b.slug && (
                        <Link href={`/listings/${b.slug}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                      <Link href={`/admin/buildings/${b.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDelete(b.id, b.title)}
                        disabled={deleting === b.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
