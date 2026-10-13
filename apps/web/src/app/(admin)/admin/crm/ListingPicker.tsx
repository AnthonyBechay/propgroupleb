'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Send, Building2, ExternalLink, X } from 'lucide-react'
import { normalizeApiUrl, normalizeFileUrl } from '@/lib/utils/api-url'

/**
 * Stock that fits the client in this conversation, ready to send as a photo
 * card. Only what is already on the public website — the card carries the
 * reference, location, size, public price and link, and nothing about the
 * owner or what the office earns.
 */

interface Card {
  ref: string
  title: string
  location: string
  type: string | null
  bedrooms: string | null
  areaSqm: string | null
  price: number
  currency: string
  priceFrom: boolean
  isProject: boolean
  deal: 'SALE' | 'RENT'
  rentPeriod: string | null
  image: string | null
  url: string
}

interface Basis { market: string; deal: 'SALE' | 'RENT'; budgetMax: number | null; minBeds: number | null; area: string | null }

export function ListingPicker({
  conversationId,
  canSend,
  onSent,
  onClose,
}: {
  onClose: () => void
  conversationId: string
  canSend: boolean
  onSent: () => void
}) {
  const apiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
  const [cards, setCards] = useState<Card[] | null>(null)
  const [basis, setBasis] = useState<Basis | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/crm/inbox/${conversationId}/listings`, { credentials: 'include', cache: 'no-store' })
    if (!res.ok) { setCards([]); return }
    const data = (await res.json()).data
    setCards(data?.cards ?? [])
    setBasis(data?.basis ?? null)
  }, [apiUrl, conversationId])
  useEffect(() => { load() }, [load])

  const send = async (ref: string) => {
    setSending(ref)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/crm/inbox/${conversationId}/listings`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      })
      if (res.ok) { setSent((s) => [...s, ref]); onSent() }
      else setError((await res.json().catch(() => null))?.message || 'The listing was not sent.')
    } finally { setSending(null) }
  }

  const PERIOD: Record<string, string> = { MONTHLY: 'month', QUARTERLY: 'quarter', YEARLY: 'year' }
  const money = (c: Card) =>
    `${c.priceFrom ? 'from ' : ''}${new Intl.NumberFormat('en-US', { style: 'currency', currency: c.currency, maximumFractionDigits: 0 }).format(c.price)}` +
    (c.deal === 'RENT' ? ` / ${PERIOD[c.rentPeriod ?? 'MONTHLY'] ?? 'month'}` : '')

  const fit = basis
    ? [
        basis.market.charAt(0) + basis.market.slice(1).toLowerCase(),
        basis.deal === 'RENT' ? 'to rent' : 'to buy',
        basis.area,
        basis.budgetMax ? `up to $${basis.budgetMax.toLocaleString('en-US')}` : null,
        typeof basis.minBeds === 'number' ? (basis.minBeds === 0 ? 'studio' : `${basis.minBeds}+ bed`) : null,
      ].filter(Boolean).join(' · ')
    : ''

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2 max-h-64 overflow-y-auto xl:max-h-none xl:w-72 xl:border-b-0 xl:border-l">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Properties</span>
          {fit ? ` · ${fit}` : ' · available now'}
        </p>
        <button onClick={onClose} aria-label="Close properties" className="min-h-9 min-w-9 -mt-1 -mr-1 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200">
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {cards === null ? (
        <div className="flex justify-center py-6 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-slate-500 py-3">Nothing public and available fits yet.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
          {cards.map((c) => (
            <div key={c.ref} className="w-52 shrink-0 xl:w-full bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={normalizeFileUrl(c.image)} alt="" className="h-20 xl:h-28 w-full object-cover" />
              ) : (
                <div className="h-20 xl:h-28 w-full bg-slate-100 flex items-center justify-center text-slate-300"><Building2 className="h-6 w-6" /></div>
              )}
              <div className="p-2.5 flex-1 flex flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {c.deal === 'RENT' ? 'For rent' : c.isProject ? 'Project' : 'For sale'}
                </p>
                <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                <p className="text-xs text-slate-500 truncate">
                  <span className="font-mono">{c.ref}</span>{c.location ? ` · ${c.location}` : ''}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {[c.bedrooms ? `${c.bedrooms} bed` : null, c.areaSqm].filter(Boolean).join(' · ')}
                </p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{money(c)}</p>
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => send(c.ref)}
                    disabled={!canSend || sending !== null || sent.includes(c.ref)}
                    className="flex-1 min-h-11 rounded-lg bg-slate-900 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {sending === c.ref ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sent.includes(c.ref) ? 'Sent' : 'Send'}
                  </button>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label="Open the public page"
                     className="min-h-11 min-w-11 rounded-lg border border-slate-200 text-slate-600 inline-flex items-center justify-center hover:bg-slate-50">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!canSend && cards && cards.length > 0 && (
        <p className="text-xs text-slate-500 mt-2">Sending from the CRM isn&apos;t available on this conversation right now — open the link and share it from your phone.</p>
      )}
    </div>
  )
}
