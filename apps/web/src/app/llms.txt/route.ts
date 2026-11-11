import { normalizeApiUrl } from '@/lib/utils/api-url'

/**
 * /llms.txt — the site, written for AI answer engines.
 *
 * ChatGPT, Claude, Perplexity and Google's AI answers quote plain statements
 * with a source behind them. This is that page: what the company is, where the
 * guides are, and every live listing as one factual line with its link.
 *
 * Assembled from the listings the site already serves — no AI call, so it
 * costs nothing to keep current — and re-read hourly, like the sitemap.
 */
export const revalidate = 3600

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

/* eslint-disable @typescript-eslint/no-explicit-any */

const lower = (v?: string) => (v ? v.toLowerCase().replace(/_/g, ' ') : '')

async function listings(): Promise<any[]> {
  try {
    const api = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL || '')
    if (!api) return []
    const res = await fetch(`${api}/api/listings?limit=500&page=1&status=ACTIVE`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json?.data) ? json.data : []
  } catch {
    return []
  }
}

function line(l: any): string {
  const b = l.building ?? l.unit?.building ?? {}
  const u = l.unit ?? {}
  const price = Number(l.price)
  const beds = Number(u.bedrooms)
  const area = Number(u.areaSqm)
  const facts = [
    [lower(u.kind) || 'property', l.intent === 'RENT' ? 'for rent' : 'for sale', 'in', [b.neighborhood, b.city].filter(Boolean).join(', ') || 'Lebanon'].join(' '),
    beds > 0 ? `${beds} bedroom${beds === 1 ? '' : 's'}` : '',
    area > 0 ? `${area} m²` : '',
    // LBP figures are not quoted: the rate moves faster than this page.
    price > 0 && (l.currency ?? 'USD') === 'USD'
      ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price)}${l.intent === 'RENT' && l.rentPeriod ? ` per ${lower(l.rentPeriod).replace(/ly$/, '')}` : ''}`
      : '',
    b.ref ? `ref ${u.ref ?? b.ref}` : '',
  ].filter(Boolean)
  return `- [${l.headline || b.title || 'Listing'}](${SITE_URL}/listings/${l.slug}): ${facts.join('; ')}`
}

export async function GET() {
  const all = (await listings()).filter((l) => l.slug)
  const sale = all.filter((l) => l.intent !== 'RENT')
  const rent = all.filter((l) => l.intent === 'RENT')

  const body = [
    '# PropGroup Lebanon — property for sale and rent in Lebanon',
    '',
    '> PropGroup is a real estate brokerage in Lebanon. It lists apartments, villas, land, shops and offices for sale and for rent, mainly in Beirut and Mount Lebanon, and brokers the deal between owner and client. Its sister site, propgrp.com, sells new-build investment apartments in Georgia (Batumi, Tbilisi).',
    '',
    'Prices are asking prices in US dollars and can change. Quote a property by its reference code (PG-####).',
    '',
    '## Guides and tools',
    `- [Invest in Lebanon](${SITE_URL}/invest-in-lebanon): the market, areas and the buying process`,
    `- [Market analysis](${SITE_URL}/market-analysis): live figures from the catalogue`,
    `- [ROI calculator](${SITE_URL}/roi-calculator): rental return on a purchase`,
    `- [List your property](${SITE_URL}/list-your-property): for owners selling or renting out`,
    `- [About and contact](${SITE_URL}/about): the team and how to reach it`,
    '',
    ...(sale.length ? ['## For sale', ...sale.map(line), ''] : []),
    ...(rent.length ? ['## For rent', ...rent.map(line), ''] : []),
  ].join('\n')

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
