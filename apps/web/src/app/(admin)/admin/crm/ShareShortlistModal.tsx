'use client'

import { useMemo, useState } from 'react'
import { X, MessageCircle, Copy, Check, Building2, Globe, Handshake } from 'lucide-react'
import { type Lead, type Opportunity, LIVE_STAGES } from './types'

/**
 * Send a client the properties on their list, over WhatsApp.
 *
 * This is the single most repeated action in the job — the broker retypes the
 * same three properties into WhatsApp several times a day, and the reference
 * codes exist precisely so the client can quote one back. Composing it here
 * means the refs are always right and the links always work.
 *
 * Nothing is sent automatically: the message opens in WhatsApp for the broker
 * to read and send themselves.
 */
export function ShareShortlistModal({
  lead, siteUrl, onClose,
}: {
  lead: Lead
  /** Public site origin, for building listing links. */
  siteUrl: string
  onClose: () => void
}) {
  const shortlist = (lead.opportunities ?? []).filter(
    (o) => o.stage === 'SUGGESTED' || LIVE_STAGES.includes(o.stage)
  )
  const [picked, setPicked] = useState<string[]>(shortlist.map((o) => o.id))
  const [intro, setIntro] = useState(`Hi ${lead.name.split(' ')[0]}, here's what I found for you:`)
  const [copied, setCopied] = useState(false)

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const message = useMemo(() => {
    const lines: string[] = [intro.trim(), '']
    for (const o of shortlist.filter((s) => picked.includes(s.id))) {
      const s = o.subject
      if (!s) continue
      const bits: string[] = []
      if (s.ref) bits.push(`[${s.ref}]`)
      bits.push(s.title)
      lines.push(`• ${bits.join(' ')}`)
      if (s.subtitle) lines.push(`  ${s.subtitle}`)
      // A link the client can actually open beats a description every time.
      const link = s.url ?? (s.slug ? `${siteUrl}/listings/${s.slug}` : null)
      if (link) lines.push(`  ${link}`)
      lines.push('')
    }
    lines.push('Let me know which ones you want to see.')
    return lines.join('\n')
  }, [intro, picked, shortlist, siteUrl])

  const phone = (lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '')
  const waHref = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked — the text is on screen to select */ }
  }

  const iconFor = (kind?: string) =>
    kind === 'CLIENT' ? <Handshake className="h-3.5 w-3.5 text-slate-400" />
    : kind === 'INVESTMENT' || kind === 'EXTERNAL' ? <Globe className="h-3.5 w-3.5 text-slate-400" />
    : <Building2 className="h-3.5 w-3.5 text-slate-400" />

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" /> Send shortlist
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              to {lead.name}{phone ? ` · +${phone}` : ' · no number on file'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {shortlist.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Nothing shortlisted for this client yet.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Opening line</span>
                <input
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  className="mt-1 w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </label>

              <div>
                <span className="text-xs font-medium text-slate-500">Include</span>
                <ul className="mt-1 space-y-1">
                  {shortlist.map((o: Opportunity) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => toggle(o.id)}
                        className={`w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                          picked.includes(o.id)
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {iconFor(o.subject?.kind)}
                        {o.subject?.ref && (
                          <span className="font-mono text-[10px] font-semibold text-slate-500 shrink-0">
                            {o.subject.ref}
                          </span>
                        )}
                        <span className="text-sm text-slate-800 truncate flex-1">
                          {o.subject?.title ?? 'Property'}
                        </span>
                        {picked.includes(o.id) && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Preview</span>
                <pre className="mt-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                  {message}
                </pre>
              </div>
            </>
          )}
        </div>

        {shortlist.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                phone && picked.length ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 pointer-events-none'
              }`}
            >
              <MessageCircle className="h-4 w-4" /> Open in WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
