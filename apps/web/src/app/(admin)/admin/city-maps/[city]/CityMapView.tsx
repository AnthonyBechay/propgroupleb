'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, LayerGroup, Marker, Polygon } from 'leaflet'
import { AlertTriangle, Building2, Check, ChevronDown, ChevronLeft, Layers, Lightbulb, LocateFixed, Search, X } from 'lucide-react'
import { adminGetAllBuildings } from '@/lib/api/use-admin-data'
import { cn } from '@/lib/utils'
import {
  POINT_COLOUR, POINT_LABEL, VERDICT_COLOUR, VERDICT_LABEL, ZONE_COLOUR, ZONE_LABEL,
  coordsOf, projectsIn, regionOf,
  type CityMap, type CityRegion, type LatLng, type OurProject, type PointKind, type Verdict, type ZoneType,
} from '@/lib/city-maps'

type ColourBy = 'verdict' | 'type'
type LayerKey = PointKind | 'projects'

const LAYERS: LayerKey[] = ['projects', 'airport', 'transport', 'landmark', 'opportunity', 'risk']
const PROJECT_COLOUR = '#c2410c'
const GLYPH: Record<LayerKey, string> = {
  airport: '✈', transport: '⇄', landmark: '★', opportunity: '＋', risk: '!', projects: 'PG',
}
/** One or two words: these sit on a chip, not in a sentence. */
const SHORT_VERDICT: Record<Verdict, string> = {
  strong: 'Recommend', selective: 'Pick well', caution: 'Right buyer only', avoid: 'Avoid',
}

const colourOf = (r: CityRegion, by: ColourBy) => (by === 'verdict' ? VERDICT_COLOUR[r.verdict] : ZONE_COLOUR[r.type])
const layerColour = (k: LayerKey) => (k === 'projects' ? PROJECT_COLOUR : POINT_COLOUR[k])
const layerLabel = (k: LayerKey) => (k === 'projects' ? 'Our projects' : POINT_LABEL[k])
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

function pinHtml(kind: LayerKey): string {
  const wide = kind === 'projects'
  return `<span style="display:flex;align-items:center;justify-content:center;width:${wide ? 32 : 24}px;height:${wide ? 26 : 24}px;border-radius:13px;background:${layerColour(kind)};color:#fff;font:700 ${wide ? 11 : 13}px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 5px rgba(15,23,42,.5)">${GLYPH[kind]}</span>`
}

/** Middle of an outline — where its name is written. */
function middle(outline: LatLng[]): LatLng {
  return [
    outline.reduce((s, p) => s + p[0], 0) / outline.length,
    outline.reduce((s, p) => s + p[1], 0) / outline.length,
  ]
}

interface Found { key: string; label: string; hint: string; colour: string; go: () => void }

export function CityMapView({ city }: { city: CityMap }) {
  const holder = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const shapes = useRef(new Map<string, Polygon>())
  const groups = useRef(new Map<LayerKey, LayerGroup>())
  const pins = useRef(new Map<string, Marker>())
  const [ready, setReady] = useState(false)

  const [colourBy, setColourBy] = useState<ColourBy>('verdict')
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [shown, setShown] = useState<Record<LayerKey, boolean>>({
    projects: true, airport: true, transport: true, landmark: false, opportunity: true, risk: true,
  })
  const [layersOpen, setLayersOpen] = useState(false)
  const [basicsOpen, setBasicsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [projects, setProjects] = useState<OurProject[]>([])
  const [loadNote, setLoadNote] = useState<string | null>(null)

  // Our own stock in this city — read live, never copied. A property saved
  // with a Google Maps link is on the map the next time this screen is looked
  // at: on open, and again whenever the tab comes back into view.
  useEffect(() => {
    let alive = true
    const load = () => {
      adminGetAllBuildings()
        .then((rows) => { if (alive) { setProjects(projectsIn(city, rows as OurProject[])); setLoadNote(null) } })
        .catch(() => { if (alive) setLoadNote('Could not load our projects — the map still works.') })
    }
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
    }
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
  const unpinned = projects.filter((p) => !coordsOf(p))

  const flyTo = (at: LatLng, zoom = 15) => map.current?.flyTo(at, Math.max(map.current.getZoom(), zoom), { duration: 0.6 })
  const openPin = (key: string, at: LatLng) => {
    flyTo(at)
    window.setTimeout(() => pins.current.get(key)?.openPopup(), 650)
  }

  // ── Build the map once ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let created: LeafletMap | null = null
    void import('leaflet').then((mod) => {
      const L = mod.default ?? mod
      if (cancelled || !holder.current || map.current) return

      created = L.map(holder.current, { center: city.centre, zoom: city.zoom, zoomControl: false })
      map.current = created
      L.control.zoom({ position: 'bottomright' }).addTo(created)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(created)
      // A click on empty map closes whatever is open.
      created.on('click', () => setSelected(null))

      for (const r of city.regions) {
        const shape = L.polygon(r.outline, { color: '#fff', weight: 2, fillOpacity: 0.4 }).addTo(created)
        shape.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelected(r.id) })
        shape.on('mouseover', () => setHovered(r.id))
        shape.on('mouseout', () => setHovered((h) => (h === r.id ? null : h)))
        shapes.current.set(r.id, shape)
        // The name, written on the region itself.
        L.marker(middle(r.outline), {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: '',
            iconSize: [0, 0],
            html: `<span style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font:600 11px/1 system-ui,sans-serif;color:#0f172a;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;pointer-events:none">${esc(r.name.split(' — ')[0].split(' – ')[0])}</span>`,
          }),
        }).addTo(created)
      }

      for (const kind of LAYERS) groups.current.set(kind, L.layerGroup())
      for (const p of city.points) {
        const m = L.marker(p.at, {
          icon: L.divIcon({ html: pinHtml(p.kind), className: '', iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: p.name,
        }).bindPopup(
          `<div style="max-width:240px"><div style="font:600 10px system-ui;letter-spacing:.05em;text-transform:uppercase;color:${POINT_COLOUR[p.kind]}">${POINT_LABEL[p.kind]}</div>` +
          `<div style="font:600 14px/1.3 system-ui;color:#0f172a;margin:2px 0 5px">${esc(p.name)}</div>` +
          `<div style="font:13px/1.45 system-ui;color:#475569">${esc(p.note)}</div></div>`,
        )
        m.addTo(groups.current.get(p.kind) as LayerGroup)
        pins.current.set(`point:${p.id}`, m)
      }
      setReady(true)
    })
    const pinStore = pins.current
    const shapeStore = shapes.current
    const groupStore = groups.current
    return () => {
      cancelled = true
      created?.remove()
      map.current = null
      shapeStore.clear()
      groupStore.clear()
      pinStore.clear()
    }
  }, [city])

  // ── Colours, hover and the selected outline ──────────────────────────────
  useEffect(() => {
    if (!ready) return
    for (const r of city.regions) {
      const on = r.id === selected
      const over = r.id === hovered
      shapes.current.get(r.id)?.setStyle({
        fillColor: colourOf(r, colourBy),
        color: on ? '#0f172a' : '#ffffff',
        weight: on ? 3 : over ? 3 : 2,
        fillOpacity: on ? 0.6 : over ? 0.55 : selected ? 0.25 : 0.4,
      })
    }
  }, [ready, city, colourBy, selected, hovered])

  useEffect(() => {
    const shape = selected ? shapes.current.get(selected) : null
    if (!ready || !shape || !map.current) return
    shape.bringToFront()
    // Leave room for the panel that covers the right of the map on a wide screen.
    const wide = window.matchMedia('(min-width: 1024px)').matches
    map.current.flyToBounds(shape.getBounds(), {
      paddingTopLeft: [40, 80], paddingBottomRight: [wide ? 420 : 40, 40], maxZoom: 15, duration: 0.6,
    })
  }, [ready, selected])

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
        const at = coordsOf(p)
        if (!at) continue
        const r = city.regions.find((x) => x.id === regionOf(city, p))
        const m = L.marker(at, {
          icon: L.divIcon({ html: pinHtml('projects'), className: '', iconSize: [32, 26], iconAnchor: [16, 13] }),
          title: p.title,
          zIndexOffset: 500,
        }).bindPopup(
          `<div style="max-width:240px"><div style="font:600 10px system-ui;letter-spacing:.05em;text-transform:uppercase;color:${PROJECT_COLOUR}">Our project${p.ref ? ` · ${esc(p.ref)}` : ''}</div>` +
          `<div style="font:600 14px/1.3 system-ui;color:#0f172a;margin:2px 0 6px">${esc(p.title)}</div>` +
          (r
            ? `<div style="font:12px system-ui;color:#475569;margin-bottom:8px">${esc(r.name)} · <b style="color:${VERDICT_COLOUR[r.verdict]}">${SHORT_VERDICT[r.verdict]}</b></div>`
            : '') +
          `<a href="/admin/buildings/${encodeURIComponent(p.id)}" style="font:600 13px system-ui;color:${PROJECT_COLOUR}">Open the property →</a></div>`,
        )
        m.addTo(group)
        pins.current.set(`project:${p.id}`, m)
      }
    })
    return () => { cancelled = true }
  }, [ready, city, projects])

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

  // ── Search: a region, a landmark, or one of our projects ─────────────────
  const found: Found[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: Found[] = []
    for (const r of city.regions) {
      if ([r.name, ...(r.alsoCalled ?? [])].join(' ').toLowerCase().includes(q)) {
        out.push({ key: `r:${r.id}`, label: r.name, hint: SHORT_VERDICT[r.verdict], colour: VERDICT_COLOUR[r.verdict], go: () => setSelected(r.id) })
      }
    }
    for (const p of projects) {
      if (`${p.title} ${p.ref ?? ''} ${p.neighborhood ?? ''}`.toLowerCase().includes(q)) {
        const at = coordsOf(p)
        out.push({
          key: `p:${p.id}`, label: p.title, hint: p.ref ?? 'Our project', colour: PROJECT_COLOUR,
          go: () => {
            setShown((s) => ({ ...s, projects: true }))
            if (at) openPin(`project:${p.id}`, at)
            else { const id = regionOf(city, p); if (id) setSelected(id) }
          },
        })
      }
    }
    for (const p of city.points) {
      if (p.name.toLowerCase().includes(q)) {
        out.push({
          key: `l:${p.id}`, label: p.name, hint: POINT_LABEL[p.kind], colour: POINT_COLOUR[p.kind],
          go: () => { setShown((s) => ({ ...s, [p.kind]: true })); openPin(`point:${p.id}`, p.at) },
        })
      }
    }
    return out.slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, city, projects])

  const count = (k: LayerKey) => (k === 'projects' ? projects.filter((p) => coordsOf(p)).length : city.points.filter((p) => p.kind === k).length)
  const legend = colourBy === 'verdict'
    ? (Object.keys(VERDICT_LABEL) as Verdict[]).map((k) => ({ key: k, label: SHORT_VERDICT[k], colour: VERDICT_COLOUR[k] }))
    : (Object.keys(ZONE_LABEL) as ZoneType[])
        .filter((k) => city.regions.some((r) => r.type === k))
        .map((k) => ({ key: k, label: ZONE_LABEL[k], colour: ZONE_COLOUR[k] }))

  const float = 'rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur'

  return (
    <div className="-mx-4 sm:mx-0">
      {/* The map is the screen. Everything else floats on it. */}
      <div className="relative isolate overflow-hidden border-y border-slate-200 bg-slate-100 sm:rounded-xl sm:border">
        <div ref={holder} className="h-[calc(100dvh-12.5rem)] min-h-[440px] w-full" aria-label={`Map of ${city.city}`} />

        {/* Top-left: search, colour mode, layers */}
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex flex-wrap items-start gap-2 lg:right-[412px]">
          <div className={cn(float, 'pointer-events-auto relative w-full sm:w-72')}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a project, area or landmark"
              aria-label="Find on the map"
              className="h-11 w-full rounded-xl bg-transparent pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            )}
            {found.length > 0 && (
              <ul className="max-h-72 overflow-y-auto border-t border-slate-100 py-1">
                {found.map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      onClick={() => { f.go(); setQuery('') }}
                      className="flex min-h-11 w-full items-center gap-2.5 px-3 text-left hover:bg-slate-50"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.colour }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{f.label}</span>
                      <span className="shrink-0 text-xs text-slate-500">{f.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim().length >= 2 && found.length === 0 && (
              <p className="border-t border-slate-100 px-3 py-2.5 text-xs text-slate-500">Nothing by that name on this map.</p>
            )}
          </div>

          <div className={cn(float, 'pointer-events-auto inline-flex p-0.5')} role="group" aria-label="Colour the regions by">
            {([['verdict', 'Where to invest'], ['type', 'Type of area']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={colourBy === key}
                onClick={() => setColourBy(key)}
                className={cn('h-10 rounded-[10px] px-3 text-sm font-medium', colourBy === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pointer-events-auto relative">
            <button
              type="button"
              aria-expanded={layersOpen}
              onClick={() => setLayersOpen((o) => !o)}
              className={cn(float, 'inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium text-slate-700')}
            >
              <Layers className="h-4 w-4" /> Show
              <ChevronDown className={cn('h-4 w-4 transition-transform', layersOpen && 'rotate-180')} />
            </button>
            {layersOpen && (
              <div className={cn(float, 'absolute left-0 top-12 w-64 p-1.5')}>
                {LAYERS.map((kind) => (
                  <label key={kind} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={shown[kind]}
                      onChange={() => setShown((s) => ({ ...s, [kind]: !s[kind] }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: layerColour(kind) }}>
                      {kind === 'projects' ? 'P' : GLYPH[kind]}
                    </span>
                    <span className="flex-1 text-sm text-slate-800">{layerLabel(kind)}</span>
                    <span className="text-xs tabular-nums text-slate-400">{count(kind)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom-left: legend and reset */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-5rem)] flex-wrap items-end gap-2">
          <div className={cn(float, 'pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2')}>
            {legend.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                <span className="h-3 w-3 rounded-sm" style={{ background: l.colour, opacity: 0.8 }} />
                {l.label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setSelected(null); map.current?.flyTo(city.centre, city.zoom, { duration: 0.6 }) }}
            className={cn(float, 'pointer-events-auto inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium text-slate-700')}
          >
            <LocateFixed className="h-3.5 w-3.5" /> Whole city
          </button>
        </div>

        {/* Right: the panel. Over the map on a wide screen, under it on a phone. */}
        <aside className={cn(float, 'z-[1000] m-3 lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:m-0 lg:w-[388px] lg:overflow-y-auto')}>
          {region ? (
            <RegionCard region={region} ours={byRegion.get(region.id) ?? []} onBack={() => setSelected(null)} onProject={(p) => { const at = coordsOf(p); if (at) openPin(`project:${p.id}`, at) }} />
          ) : (
            <div className="p-3">
              <button
                type="button"
                aria-expanded={basicsOpen}
                onClick={() => setBasicsOpen((o) => !o)}
                className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-amber-50 px-3 text-left text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                <Lightbulb className="h-4 w-4 shrink-0" />
                <span className="flex-1">{city.city} in {city.howItWorks.length} points</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', basicsOpen && 'rotate-180')} />
              </button>
              {basicsOpen && (
                <ol className="mt-2 space-y-2 px-1">
                  {city.howItWorks.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-snug text-slate-700">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">{i + 1}</span>
                      {line}
                    </li>
                  ))}
                </ol>
              )}

              <h2 className="mb-1 mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Regions</h2>
              <ul>
                {city.regions.map((r) => {
                  const ours = byRegion.get(r.id)?.length ?? 0
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(r.id)}
                        onMouseEnter={() => setHovered(r.id)}
                        onMouseLeave={() => setHovered(null)}
                        className={cn('flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left', hovered === r.id ? 'bg-slate-100' : 'hover:bg-slate-50')}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: colourOf(r, colourBy) }} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{r.name}</span>
                        {ours > 0 && (
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: PROJECT_COLOUR }}>{ours}</span>
                        )}
                        <span className="shrink-0 text-xs text-slate-500">{colourBy === 'verdict' ? SHORT_VERDICT[r.verdict] : ZONE_LABEL[r.type]}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {unpinned.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <p className="text-xs font-medium text-amber-900">
                    {unpinned.length} project{unpinned.length === 1 ? ' has' : 's have'} no pin — paste a Google Maps link on the property:
                  </p>
                  <ul className="mt-1">
                    {unpinned.map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/buildings/${p.id}`} className="flex min-h-9 items-center gap-2 text-xs text-amber-900 underline-offset-2 hover:underline">
                          <span className="truncate">{p.title}</span>
                          {p.ref && <span className="shrink-0 font-mono">{p.ref}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {loadNote && <p className="mt-3 px-1 text-xs text-slate-500">{loadNote}</p>}
              <p className="mt-3 px-1 text-[11px] leading-snug text-slate-400">
                Outlines are approximate, not legal boundaries. Notes reviewed {city.reviewed}; prices and yields come from the developer, not from here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

/** A region in a glance: verdict, who it suits, three reasons, three cautions. */
function RegionCard({
  region, ours, onBack, onProject,
}: {
  region: CityRegion
  ours: OurProject[]
  onBack: () => void
  onProject: (p: OurProject) => void
}) {
  const [more, setMore] = useState(false)
  // A different region starts collapsed again.
  useEffect(() => setMore(false), [region.id])
  const strengths = more ? region.strengths : region.strengths.slice(0, 3)
  const watchOuts = more ? region.watchOuts : region.watchOuts.slice(0, 3)
  const hidden = region.strengths.length + region.watchOuts.length - 6

  return (
    <div className="p-3">
      <button type="button" onClick={onBack} className="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        <ChevronLeft className="h-4 w-4" /> All regions
      </button>

      <h2 className="mt-1 text-lg font-semibold leading-tight text-slate-900">{region.name}</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: VERDICT_COLOUR[region.verdict] }}>
          {VERDICT_LABEL[region.verdict]}
        </span>
        <span className="rounded-full border px-2.5 py-1 text-xs font-medium" style={{ borderColor: ZONE_COLOUR[region.type], color: ZONE_COLOUR[region.type] }}>
          {ZONE_LABEL[region.type]}
        </span>
      </div>
      <p className="mt-2.5 text-sm leading-snug text-slate-700">{region.summary}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {region.bestFor.map((t) => (
          <span key={t} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{t}</span>
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {strengths.map((t) => (
          <li key={t} className="flex gap-2 text-[13px] leading-snug text-slate-800">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />{t}
          </li>
        ))}
      </ul>
      <ul className="mt-2.5 space-y-1.5">
        {watchOuts.map((t) => (
          <li key={t} className="flex gap-2 text-[13px] leading-snug text-slate-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />{t}
          </li>
        ))}
      </ul>

      {more && (
        <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-[13px] leading-snug">
          <div><dt className="text-xs font-semibold text-slate-500">For sale</dt><dd className="text-slate-700">{region.stock}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Who rents</dt><dd className="text-slate-700">{region.rental}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Background</dt><dd className="text-slate-700">{region.about}</dd></div>
          {region.alsoCalled && region.alsoCalled.length > 0 && (
            <div><dt className="text-xs font-semibold text-slate-500">Also called</dt><dd className="text-slate-700">{region.alsoCalled.join(' · ')}</dd></div>
          )}
        </dl>
      )}
      <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
        {more ? 'Less' : `More${hidden > 0 ? ` (${hidden} more points, stock, rentals)` : ' (stock, rentals, background)'}`}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', more && 'rotate-180')} />
      </button>

      <div className="mt-2 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Our projects here{ours.length ? ` · ${ours.length}` : ''}</h3>
        {ours.length === 0 ? (
          <p className="mt-1 text-[13px] text-slate-500">None in the catalogue.</p>
        ) : (
          <ul className="mt-1">
            {ours.map((p) => (
              <li key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onProject(p)}
                  title="Show on the map"
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                >
                  <Building2 className="h-4 w-4 shrink-0" style={{ color: PROJECT_COLOUR }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {p.ref && <span className="shrink-0 font-mono text-xs text-slate-500">{p.ref}</span>}
                </button>
                <Link href={`/admin/buildings/${p.id}`} className="flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
