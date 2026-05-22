'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MOHAFAZAT } from '@propgroup/config'

const UNIT_KINDS = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'DUPLEX', label: 'Duplex' },
  { value: 'PENTHOUSE', label: 'Penthouse' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'TOWNHOUSE', label: 'Townhouse' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'LAND_PARCEL', label: 'Land' },
]

interface Props {
  currentParams: Record<string, string | undefined>
}

export function ListingFilters({ currentParams }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const update = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams()
    Object.entries({ ...currentParams, [key]: value, page: '1' }).forEach(([k, v]) => {
      if (v && v !== 'all' && v !== '') params.set(k, v)
    })
    router.push(`${pathname}?${params}`, { scroll: false })
  }, [currentParams, pathname, router])

  return (
    <div className="space-y-5">
      {/* Intent */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Type</Label>
        <div className="flex gap-2">
          {[
            { value: '', label: 'All' },
            { value: 'FOR_SALE', label: 'For Sale' },
            { value: 'FOR_RENT', label: 'For Rent' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => update('intent', opt.value || undefined)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                (currentParams.intent ?? '') === opt.value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mohafazat */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Governorate</Label>
        <Select
          value={currentParams.mohafazat ?? 'all'}
          onValueChange={v => update('mohafazat', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All governorates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All governorates</SelectItem>
            {MOHAFAZAT.map(m => (
              <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Property kind */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Property type</Label>
        <Select
          value={currentParams.kind ?? 'all'}
          onValueChange={v => update('kind', v === 'all' ? undefined : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {UNIT_KINDS.map(k => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bedrooms */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Bedrooms</Label>
        <div className="flex gap-2">
          {['Studio', '1', '2', '3', '4+'].map((opt, i) => {
            const val = i === 0 ? '0' : i === 4 ? '4' : String(i)
            return (
              <button
                key={opt}
                onClick={() => update('minBeds', currentParams.minBeds === val ? undefined : val)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  currentParams.minBeds === val
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Price range */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Price (USD)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Min"
            className="h-8 text-xs"
            defaultValue={currentParams.minPrice}
            onBlur={e => update('minPrice', e.target.value || undefined)}
          />
          <Input
            type="number"
            placeholder="Max"
            className="h-8 text-xs"
            defaultValue={currentParams.maxPrice}
            onBlur={e => update('maxPrice', e.target.value || undefined)}
          />
        </div>
      </div>

      {/* Clear */}
      {Object.values(currentParams).some(v => v) && (
        <button
          onClick={() => router.push(pathname)}
          className="w-full py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 rounded-lg transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
