'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup, Polygon } from 'leaflet'
import { AlertTriangle, Building2, Check, ChevronRight, Info, X } from 'lucide-react'
import { adminGetAllBuildings } from '@/lib/api/use-admin-data'
import { cn } from '@/lib/utils'
import {
  POINT_COLOUR, POINT_LABEL, VERDICT_COLOUR, VERDICT_LABEL, ZONE_COLOUR, ZONE_LABEL,
  projectsIn, regionOf,
  type CityMap, type CityRegion, type OurProject, type PointKind, type Verdict, type ZoneType,
} from '@/lib/city-maps'

type ColourBy = 'verdict' | 'type'
type LayerKey = PointKind | 'projects'

const LAYERS: LayerKey[] = ['airport', 'transport', 'landmark', 'opportunity', 'risk', 'projects']
const PROJECT_COLOUR = '#c2410c'

/** What a pin is drawn with — one glyph per kind, readable at 22px. */
const GLYPH: Record<LayerKey, string> = {
  airport: '✈', transport: '⇄', landmark: '★', opportunity: '＋', risk: '!', projects: 'PG',
}

const colourOf = (r: CityRegion, by: ColourBy) => (by === 'verdict' ? VERDICT_COLOUR[r.verdict] : ZONE_COLOUR[r.type])

function pinHtml(kind: LayerKey, colour: string): string {
  const wide = kind === 'projects'
  return `<span style="display:flex;align-items:center;justify-content:center;width:${wide ? 30 : 24}px;height:24px;border-radius:12px;background:${colour};color:#fff;font:700 ${wide ? 10 : 13}px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.45)">${GLYPH[kind]}</span>`
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

export function CityMapView({ city }: { city: CityMap }) {
  const holder = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const shapes = useRef(new Map<string, Polygon>())
  const groups = useRef(new Map<LayerKey, LayerGroup>())
  const [ready, setReady] = useState(false)

  const [colourBy, setColourBy] = useState<ColourBy>('verdict')
  const [selected, setSelected] = useState<string | null>(null)
  const [shown, setShown] = useState<Record<LayerKey, boolean>>({
    airport: true, transport: true, landmark: true, opportunity: true, risk: true, projects: true,
  })
  const [projects, setProjects] = useState<OurProject[]>([])

  // Our own stock in this city. A failure here is not worth an error screen:
  // the map is the point, the pins are a bonus.
  useEffect(() => {
    let alive = true
    adminGetAllBuildings()
      .then((rows) => { if (alive) setProjects(projectsIn(city, rows as OurProject[])) })
      .catch(() => {})
    return () => { alive = false }
  }, [city])

  const byRegion = useMemo(() => {
    const out = new Map<string, OurProject[]>()
    for (const p of projects) {
      const id = regionOf(city, p)
      if (id) out.set(id, [...(out.get(id) ?? []), p])
    }
    return out
  }, [city, projects])

  const region = city.regions.find((r) => r.id === selected) ?? null

  // ── Build the map once ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let created: LeafletMap | null = null
    void import('leaflet').then((mod) => {
      const L = mod.default ?? mod
      if (cancelled || !holder.current || map.current) return

      created = L.map(holder.current, { center: city.centre, zoom: city.zoom, scrollWheelZoom: true, zoomControl: true })
      map.current = created
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(created)

      for (const r of city.regions) {
        const shape = L.polygon(r.outline, { color: '#fff', weight: 2, fillOpacity: 0.42 }).addTo(created)
        shape.bindTooltip(r.name, { sticky: true, direction: 'top' })
        shape.on('click', () => setSelected(r.id))
        shapes.current.set(r.id, shape)
      }

      for (const kind of LAYERS) groups.current.set(kind, L.layerGroup().addTo(created))
      for (const p of city.points) {
        L.marker(p.at, {
          icon: L.divIcon({ html: pinHtml(p.kind, POINT_COLOUR[p.kind]), className: '', iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: p.name,
        })
          .bindPopup(
            `<div style="max-width:250px"><div style="font:600 13px system-ui;color:#0f172a">${escapeHtml(p.name)}</div>` +
            `<div style="font:500 10px system-ui;letter-spacing:.04em;text-transform:uppercase;color:${POINT_COLOUR[p.kind]};margin:2px 0 6px">${POINT_LABEL[p.kind]}</div>` +
            `<div style="font:13px/1.45 system-ui;color:#334155">${escapeHtml(p.note)}</div></div>`,
          )
          .addTo(groups.current.get(p.kind) as LayerGroup)
      }
      setReady(true)
    })
    return () => {
      cancelled = true
      created?.remove()
      map.current = null
      shapes.current.clear()
      groups.current.clear()
    }
  }, [city])

  // ── Colours and the selected outline ─────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    for (const r of city.regions) {
      const on = r.id === selected
      shapes.current.get(r.id)?.setStyle({
        fillColor: colourOf(r, colourBy),
        color: on ? '#0f172a' : '#ffffff',
        weight: on ? 3 : 2,
        fillOpacity: on ? 0.6 : 0.42,
      })
    }
    const shape = selected ? shapes.current.get(selected) : null
    if (shape && map.current) {
      shape.bringToFront()
      map.current.fitBounds(shape.getBounds(), { padding: [60, 60], maxZoom: 14 })
    }
  }, [ready, city, colourBy, selected])

  // ── Our projects ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return
    const group = groups.current.get('projects')
    if (!group) return
    let cancelled = false
    void import('leaflet').then((mod) => {
      if (cancelled) return
      const L = mod.default ?? mod
      group.clearLayers()
      for (const p of projects) {
        const lat = Number(p.latitude)
        const lng = Number(p.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) continue
        L.marker([lat, lng], {
          icon: L.divIcon({ html: pinHtml('projects', PROJECT_COLOUR), className: '', iconSize: [30, 24], iconAnchor: [15, 12] }),
          title: p.title,
          zIndexOffset: 500,
        })
          .bindPopup(
            `<div style="max-width:230px"><div style="font:600 13px system-ui;color:#0f172a">${escapeHtml(p.title)}</div>` +
            `<div style="font:12px system-ui;color:#64748b;margin:2px 0 6px">${escapeHtml([p.ref, p.neighborhood].filter(Boolean).join(' · '))}</div>` +
            `<a href="/admin/buildings/${encodeURIComponent(p.id)}" style="font:600 12px system-ui;color:#c2410c">Open the property →</a></div>`,
          )
          .addTo(group)
      }
    })
    return () => { cancelled = true }
  }, [ready, projects])

  // ── Layer switches ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !map.current) return
    for (const kind of LAYERS) {
      const group = groups.current.get(kind)
      if (!group) continue
      if (shown[kind]) group.addTo(map.current)
      else group.remove()
    }
  }, [ready, shown])

  const unplaced = projects.filter((p) => !Number(p.latitude) || !Number(p.longitude)).length
  const legend = colourBy === 'verdict'
    ? (Object.keys(VERDICT_LABEL) as Verdict[]).map((k) => ({ key: k, label: VERDICT_LABEL[k], colour: VERDICT_COLOUR[k] }))
    : (Object.keys(ZONE_LABEL) as ZoneType[])
        .filter((k) => city.regions.some((r) => r.type === k))
        .map((k) => ({ key: k, label: ZONE_LABEL[k], colour: ZONE_COLOUR[k] }))

  return (
    <div className="space-y-5">
      {/* The city in five sentences, before any detail. */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="max-w-3xl text-sm leading-relaxed text-slate-700">{city.intro}</p>
        <ol className="mt-4 grid gap-x-8 gap-y-2.5 text-sm text-slate-600 md:grid-cols-2">
          {city.howItWorks.map((line, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">{i + 1}</span>
              <span className="leading-relaxed">{line}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Colour the regions by">
          {([['verdict', 'Where to invest'], ['type', 'Type of area']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={colourBy === key}
              onClick={() => setColourBy(key)}
              className={cn(
                'min-h-11 rounded-md px-3.5 text-sm font-medium transition-colors sm:min-h-9',
                colourBy === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show on the map">
          {LAYERS.map((kind) => {
            const colour = kind === 'projects' ? PROJECT_COLOUR : POINT_COLOUR[kind]
            const label = kind === 'projects' ? `Our projects${projects.length ? ` (${projects.length})` : ''}` : POINT_LABEL[kind]
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={shown[kind]}
                onClick={() => setShown((s) => ({ ...s, [kind]: !s[kind] }))}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:min-h-8',
                  shown[kind] ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-400',
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: shown[kind] ? colour : '#cbd5e1' }} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Map */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* isolate: Leaflet's panes use z-index up to 1000 and would otherwise sit over the admin header and menus. */}
          <div ref={holder} className="isolate h-[58vh] min-h-[380px] w-full lg:h-[72vh]" aria-label={`Map of ${city.city}`} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-200 px-4 py-2.5">
            {legend.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-3 w-3 rounded-sm" style={{ background: l.colour, opacity: 0.75 }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        {/* Detail */}
        <aside className="rounded-xl border border-slate-200 bg-white lg:max-h-[calc(72vh+46px)] lg:overflow-y-auto">
          {region ? (
            <RegionDetail
              region={region}
              ours={byRegion.get(region.id) ?? []}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-slate-900">Pick a region</h2>
              <p className="mt-1 text-sm text-slate-500">Tap an area on the map, or choose one here.</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {city.regions.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.id)}
                      className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colourOf(r, colourBy) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{r.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {colourBy === 'verdict' ? VERDICT_LABEL[r.verdict] : ZONE_LABEL[r.type]}
                          {byRegion.get(r.id)?.length ? ` · ${byRegion.get(r.id)?.length} of ours` : ''}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <p className="flex max-w-3xl gap-2 text-xs leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Region outlines are drawn by hand to show where each district sits — they are not legal boundaries.
          Landmarks, the airport and the stations are placed from OpenStreetMap. The notes are our working brief,
          last reviewed {city.reviewed}; they carry no prices or yields on purpose — take those from the developer’s
          current list.
          {unplaced > 0 && ` ${unplaced} of our ${city.city} projects have no coordinates yet, so they are counted by district name but have no pin — add latitude and longitude on the property to place them.`}
        </span>
      </p>
    </div>
  )
}

function RegionDetail({ region, ours, onClose }: { region: CityRegion; ours: OurProject[]; onClose: () => void }) {
  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{region.name}</h2>
          {region.alsoCalled && region.alsoCalled.length > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">Also: {region.alsoCalled.join(' · ')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to all regions"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: VERDICT_COLOUR[region.verdict] }}>
          {VERDICT_LABEL[region.verdict]}
        </span>
        <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: ZONE_COLOUR[region.type], color: ZONE_COLOUR[region.type] }}>
          {ZONE_LABEL[region.type]}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium leading-relaxed text-slate-900">{region.summary}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{region.about}</p>

      <Block title="Best for">
        <ul className="space-y-1">
          {region.bestFor.map((t) => <li key={t} className="text-sm text-slate-700">{t}</li>)}
        </ul>
      </Block>

      <Block title="Why it sells">
        <ul className="space-y-1.5">
          {region.strengths.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />{t}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Watch out for">
        <ul className="space-y-1.5">
          {region.watchOuts.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-slate-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />{t}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="What is for sale"><p className="text-sm text-slate-700">{region.stock}</p></Block>
      <Block title="Who rents it"><p className="text-sm text-slate-700">{region.rental}</p></Block>

      <Block title={`Our projects here${ours.length ? ` (${ours.length})` : ''}`}>
        {ours.length === 0 ? (
          <p className="text-sm text-slate-500">None in the catalogue for this region.</p>
        ) : (
          <ul className="space-y-1">
            {ours.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/buildings/${p.id}`}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-800 hover:bg-slate-50"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {p.ref && <span className="shrink-0 font-mono text-xs text-slate-500">{p.ref}</span>}
                  {p.visibility === 'HIDDEN' && <span className="shrink-0 text-xs text-slate-400">hidden</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}
