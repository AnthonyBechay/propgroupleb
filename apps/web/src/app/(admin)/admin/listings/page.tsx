'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Search, ExternalLink, Edit, Trash2, Tag, Building2 } from 'lucide-react'
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
import { normalizeApiUrl } from '@/lib/utils/api-url'

const INTENT_COLORS: Record<string, string> = {
  FOR_SALE: 'bg-emerald-100 text-emerald-800',
  FOR_RENT: 'bg-sky-100 text-sky-800',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  ACTIVE: 'bg-green-100 text-green-700',
  UNDER_OFFER: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-red-100 text-red-700',
  ARCHIVED: 'bg-zinc-200 text-zinc-500',
}

function formatPrice(price: number, currency: string) {
  if (currency === 'LBP') {
    return `${(price / 1_000_000).toFixed(1)}M LBP`
  }
  return `$${price.toLocaleString()}`
}

export default function AdminListingsPage() {
  const searchParams = useSearchParams()
  const initialBuildingId = searchParams.get('buildingId') ?? 'all'

  const [listings, setListings] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [intentFilter, setIntentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [buildingFilter, setBuildingFilter] = useState(initialBuildingId)
  const [buildings, setBuildings] = useState<any[]>([])

  // Load building list once for the filter dropdown
  useEffect(() => {
    const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    fetch(`${apiUrl}/api/buildings?limit=200&visibility=all`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBuildings(d.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { limit: '200' }
    if (intentFilter !== 'all') params.intent = intentFilter
    if (statusFilter !== 'all') params.status = statusFilter
    // When 'all', don't pass status — the backend admin branch returns everything

    apiClient.getListings(params as any)
      .then((res: any) => {
        setListings(res.data ?? [])
        setTotal(res.pagination?.total ?? 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [intentFilter, statusFilter])

  const filtered = listings.filter(l => {
    if (buildingFilter !== 'all') {
      const listingBuildingId = l.building?.id ?? l.unit?.buildingId ?? null
      if (listingBuildingId !== buildingFilter) return false
    }
    if (!search) return true
    const title = l.building?.title ?? l.unit?.name ?? l.headline ?? ''
    return title.toLowerCase().includes(search.toLowerCase())
  })

  async function handleArchive(id: string) {
    if (!confirm('Archive this listing?')) return
    try {
      await apiClient.deleteListing(id)
      setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'ARCHIVED' } : l))
    } catch (e: any) {
      alert(e.message || 'Failed')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Listings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {buildingFilter !== 'all' ? `${filtered.length} of ` : ''}{total} total listings
          </p>
        </div>
        <Link href="/admin/listings/new">
          <Button className="bg-slate-800 hover:bg-slate-700">
            <Plus className="h-4 w-4 mr-2" />
            New Listing
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={buildingFilter} onValueChange={setBuildingFilter}>
          <SelectTrigger className="w-[180px]">
            <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
            <SelectValue placeholder="All buildings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buildings</SelectItem>
            {buildings.map(b => (
              <SelectItem key={b.id} value={b.id}>
                {b.title}{b.city ? ` — ${b.city}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={intentFilter} onValueChange={setIntentFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Intent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="FOR_SALE">For Sale</SelectItem>
            <SelectItem value="FOR_RENT">For Rent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="UNDER_OFFER">Under Offer</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Subject</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No listings found
                </TableCell>
              </TableRow>
            ) : filtered.map(l => {
              const title = l.building?.title ?? l.unit?.name ?? l.headline ?? 'Untitled'
              const location = l.building
                ? [l.building.city, l.building.caza].filter(Boolean).join(', ')
                : '—'
              const unitInfo = l.unit
                ? `${l.unit.kind} · ${l.unit.bedrooms != null ? `${l.unit.bedrooms}BR` : ''} ${l.unit.areaSqm ? `${l.unit.areaSqm}m²` : ''}`.trim()
                : `${l.building?.kind ?? ''} building`

              return (
                <TableRow key={l.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{title}</p>
                      <p className="text-xs text-slate-400">{unitInfo}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${INTENT_COLORS[l.intent] ?? ''}`}>
                      {l.intent === 'FOR_SALE' ? 'For Sale' : 'For Rent'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-900">
                    {formatPrice(l.price, l.currency)}
                    {l.rentPeriod && <span className="text-xs text-slate-400 ml-1">/{l.rentPeriod === 'MONTHLY' ? 'mo' : 'yr'}</span>}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{location}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[l.status] ?? ''}`}>
                      {l.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {l.publishedAt ? new Date(l.publishedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {l.slug && (
                        <Link href={`/listings/${l.slug}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                      <Link href={`/admin/listings/${l.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {l.status !== 'ARCHIVED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleArchive(l.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
