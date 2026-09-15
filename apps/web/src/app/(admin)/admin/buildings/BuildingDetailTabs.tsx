'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, LayoutList, Settings2 } from 'lucide-react'
import { countryFlag, siteFor } from '@/lib/market'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/admin/ui/layout'
import { BuildingForm } from './BuildingForm'
import { UnitsManager } from './UnitsManager'

type Tab = 'details' | 'units'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  building: any | null
  buildingId: string
}

/**
 * One property, two tabs.
 *
 * This page used to open with `min-h-screen bg-zinc-50` and a `max-w-5xl`
 * container of its own — inside the admin shell, which already supplies a page
 * background and a `max-w-[1600px]` container with its own padding. The result
 * was a page rendered inside a page: doubled gutters, a title that didn't line
 * up with the title on any other screen, and a second full-height background
 * scrolling against the first. It now uses the shell it is already inside.
 */
export function BuildingDetailTabs({ building, buildingId }: Props) {
  const [tab, setTab] = useState<Tab>('details')

  const tabs = [
    { id: 'details' as Tab, label: 'Details', icon: Settings2 },
    {
      id: 'units' as Tab,
      label: 'Units & listings',
      icon: LayoutList,
      count: building?._count?.units ?? building?.units?.length,
    },
  ]

  const hidden = building?.visibility === 'HIDDEN'

  return (
    <div>
      <PageHeader
        title={building?.title ?? 'Property'}
        description={
          building
            ? <>{countryFlag(building.country)} {[building.city, building.caza].filter(Boolean).join(', ') || 'No location set'} · shows on {siteFor(building.country)}</>
            : undefined
        }
        backHref="/admin/buildings"
        crumbs={[{ label: 'Properties', href: '/admin/buildings' }, { label: building?.title ?? 'Property' }]}
        meta={
          <>
            {building?.ref && (
              <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-500">
                {building.ref}
              </span>
            )}
            {hidden && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                Hidden
              </span>
            )}
            {building?.featured && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                Featured
              </span>
            )}
          </>
        }
        actions={
          building?.slug && !hidden ? (
            <a
              href={`/listings/${building.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on site
            </a>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div className="mb-5 border-b border-slate-200">
        <div className="-mb-px flex items-center gap-1">
          {tabs.map((t) => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors sm:px-4',
                  on
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900',
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                      on ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
          {building?.id && (
            <Link
              href={`/admin/listings?buildingId=${building.id}`}
              className="ml-auto hidden min-h-11 items-center gap-1.5 px-3 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 sm:flex"
            >
              All its listings <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Both tabs stay mounted and the inactive one is hidden, rather than
          unmounted. Switching to Units used to tear the details form down with
          whatever had been typed into it — no warning, no way back — and it is
          a natural thing to do half-way through editing a property. Keeping
          them alive also means the units list is already loaded when you get
          there. */}
      <div className={tab === 'details' ? undefined : 'hidden'}>
        <BuildingForm initialData={building} buildingId={buildingId} embedded />
      </div>
      <div className={tab === 'units' ? undefined : 'hidden'}>
        <UnitsManager
          buildingId={buildingId}
          buildingImages={building?.images ?? []}
          buildingTitle={building?.title}
        />
      </div>
    </div>
  )
}
