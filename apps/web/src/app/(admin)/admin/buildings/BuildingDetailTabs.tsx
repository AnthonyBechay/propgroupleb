'use client'

import { useState } from 'react'
import { Settings2, LayoutList, ArrowLeft, Tag } from 'lucide-react'
import Link from 'next/link'
import { BuildingForm } from './BuildingForm'
import { UnitsManager } from './UnitsManager'

type Tab = 'details' | 'units'

interface Props {
  building: any | null
  buildingId: string
}

export function BuildingDetailTabs({ building, buildingId }: Props) {
  const [tab, setTab] = useState<Tab>('details')

  const tabs = [
    { id: 'details' as Tab, label: 'Details', icon: Settings2 },
    { id: 'units'   as Tab, label: 'Units & Listings', icon: LayoutList },
  ]

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Page header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 py-4">
            <Link
              href="/admin/buildings"
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Building</p>
              <h1 className="text-lg font-semibold text-zinc-900 truncate">
                {building?.title ?? 'New Building'}
              </h1>
            </div>
            {building?.id && (
              <Link
                href={`/admin/listings?buildingId=${building.id}`}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors flex-shrink-0"
              >
                <Tag className="h-3.5 w-3.5" />
                All listings
              </Link>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {tab === 'details' && (
          <BuildingForm initialData={building} buildingId={buildingId} embedded />
        )}
        {tab === 'units' && (
          <UnitsManager buildingId={buildingId} buildingImages={building?.images ?? []} />
        )}
      </div>
    </div>
  )
}
