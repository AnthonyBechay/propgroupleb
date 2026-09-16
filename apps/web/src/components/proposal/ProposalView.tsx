'use client'

/**
 * The proposal, with the two ways of getting it out: a link, or a PDF.
 *
 * **Why printing rather than a PDF library.** Generating PDFs server-side means
 * a headless browser in the container; client-side means jsPDF plus
 * html2canvas, which renders the page to a bitmap and produces a document with
 * no selectable text and no working links. The browser's own print-to-PDF keeps
 * text as text, embeds the links, handles page breaks from the CSS, and costs
 * no dependency — and `apps/backend`'s Dockerfile installs with
 * `--frozen-lockfile`, so a new dependency is a lockfile change and a deploy
 * risk for something the platform already does well.
 *
 * The print rules use `visibility` rather than `display`. Hiding ancestors with
 * `display: none` removes the document from the page along with them; toggling
 * `visibility` leaves the box tree intact, so a document nested deep inside the
 * admin shell still prints from the top of page one.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Link2, Loader2, Printer, RotateCcw, Trash2 } from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'
import { toast } from '@/components/ui/use-toast'
import { SelectInput } from '@/components/admin/ui/form'
import { buildProposal } from '@/lib/proposal'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANDING, ProposalDocument, type ProposalBranding } from './ProposalDocument'

export function ProposalView({
  building, showShare = true, initialUnitId = null,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  building: any
  /** The public share page has no business minting more share links. */
  showShare?: boolean
  initialUnitId?: string | null
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [unitId, setUnitId] = useState<string | null>(initialUnitId)
  const [branding, setBranding] = useState<ProposalBranding>(DEFAULT_BRANDING)
  const [printing, setPrinting] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const units: any[] = Array.isArray(building?.units) ? building.units : []
  const proposal = useMemo(() => buildProposal(building, { unitId }), [building, unitId])

  // Rendered on the client only: a date baked in on the server would say when
  // the page was built, not when the proposal was prepared.
  const [generatedAt, setGeneratedAt] = useState('')
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  // The logo the agency set in admin, falling back to the bundled one.
  useEffect(() => {
    fetch(`${apiUrl}/api/content/media/branding.logoUrl`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const u = j?.data?.url || j?.url
        if (u) setBranding((b) => ({ ...b, logoUrl: normalizeFileUrl(u) }))
      })
      .catch(() => { /* the bundled logo is a fine fallback */ })
  }, [apiUrl])

  async function exportPdf() {
    setPrinting(true)
    // Give the browser a moment to decode any image that is still loading —
    // printing mid-decode produces a document with gaps where photos should be.
    await new Promise((r) => setTimeout(r, 350))
    const done = () => {
      setPrinting(false)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
    // Safari never fires `afterprint` when the dialog is dismissed.
    setTimeout(() => setPrinting(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div data-pg-no-print className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            {units.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">Covering</span>
                <SelectInput
                  value={unitId ?? 'all'}
                  onChange={(e) => setUnitId(e.target.value === 'all' ? null : e.target.value)}
                  className="w-auto min-w-[12rem]"
                >
                  <option value="all">The whole project ({units.length} units)</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || (u.unitNumber ? `Unit ${u.unitNumber}` : u.id.slice(0, 6))}
                    </option>
                  ))}
                </SelectInput>
              </label>
            )}
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                proposal.profile === 'investment'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-700',
              )}
              title={
                proposal.profile === 'investment'
                  ? 'International stock is sold on returns, so the document leads with them'
                  : 'Lebanese stock is sold as a home, so the document leads with the property'
              }
            >
              {proposal.profile === 'investment' ? 'Investment proposal' : 'Property proposal'}
            </span>
          </div>

          <button
            type="button"
            onClick={exportPdf}
            disabled={printing}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {printing ? 'Preparing…' : 'Export as PDF'}
          </button>
        </div>

        {showShare && <ShareLink buildingId={building?.id} unitId={unitId} />}
      </div>

      {/* The preview, and the thing that prints. */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-4 print:overflow-visible print:border-0 print:bg-white print:p-0">
        <div id="pg-print-root" className="mx-auto bg-white shadow-sm print:shadow-none">
          <ProposalDocument proposal={proposal} branding={branding} generatedAt={generatedAt} />
        </div>
      </div>

      <style>{`
        @page { size: A4; margin: 12mm 0; }
        @media print {
          /* visibility, not display — see the note at the top of this file. */
          body * { visibility: hidden !important; }
          #pg-print-root, #pg-print-root * { visibility: visible !important; }
          #pg-print-root {
            position: absolute !important;
            left: 0; top: 0;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          [data-pg-no-print] { display: none !important; }
          /* Photographs and the price block are the two things worth the ink. */
          #pg-print-root img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}

/**
 * A link a client can open without an account.
 *
 * `POST /api/share` has existed the whole time and nothing in the back office
 * called it — the only way to get one was the CRM's shortlist flow. Scoped to
 * the unit currently selected above, so "send them this apartment" and "send
 * them the project" are the same gesture with a different dropdown.
 */
function ShareLink({ buildingId, unitId }: { buildingId?: string; unitId: string | null }) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  // The token is scoped, so changing the scope invalidates the one on screen.
  useEffect(() => { setToken(null) }, [unitId])

  const url = token ? `${window.location.origin}/share/${token}` : null

  async function create() {
    if (!buildingId) return
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/share`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId, unitId: unitId ?? undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: 'Could not create the link', description: d.message, variant: 'destructive' })
        return
      }
      const t = (d.data ?? d)?.token
      if (!t) { toast({ title: 'Could not create the link', variant: 'destructive' }); return }
      setToken(t)
      // Copy immediately: the reason you pressed the button is to paste it.
      await copy(`${window.location.origin}/share/${t}`)
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Link copied', description: 'Anyone with it can open the proposal.' })
    } catch {
      // Clipboard is blocked outside a secure context or without permission.
      toast({ title: 'Copy it by hand', description: value })
    }
  }

  async function revoke() {
    if (!token) return
    setBusy(true)
    try {
      await fetch(`${apiUrl}/api/share/${token}`, { method: 'DELETE', credentials: 'include' })
      setToken(null)
      toast({ title: 'Link revoked', description: 'It no longer opens for anyone.' })
    } catch {
      toast({ title: 'Could not revoke the link', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
            <Link2 className="h-4 w-4 text-slate-500" /> Share as a link
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            A page the client can open without an account — the same details as this document,
            {unitId ? ' for the selected unit only.' : ' for the whole project.'} Revoke it at any time.
          </p>
        </div>
        {!url ? (
          <button
            type="button"
            onClick={create}
            disabled={busy || !buildingId}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Create link
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={revoke}
              disabled={busy}
              title="Revoke this link"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              title="Create a fresh link"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {url && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 pl-3.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{url}</code>
          <button
            type="button"
            onClick={() => copy(url)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}
