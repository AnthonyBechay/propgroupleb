import { prisma } from '@propgroup/db';
import { FLAT_PROPERTY_INCLUDE } from '../routes/properties.js';
import { mapBuildingToProperty } from '../utils/property-mapper.js';

/**
 * The public catalogue, as something that can be offered to a client in chat.
 *
 * Everything returned here is already on the public websites. That is the
 * whole point of the narrow `CatalogueCard` shape: owner, commission, internal
 * notes and the seller's own figures are never loaded into it, so nothing
 * downstream — a model, a message template, a broker in a hurry — can send
 * them by mistake.
 *
 * The two markets are sold differently and a card says which it is:
 *   - Abroad (Georgia) we sell PROJECTS. One card is a development with a range
 *     of units and a "from" price, always for purchase.
 *   - Lebanon is sold PROPERTY BY PROPERTY. One card is one apartment or shop,
 *     either for sale or for rent — never interchangeable.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Market = 'LEBANON' | 'GEORGIA';
export type Deal = 'SALE' | 'RENT';

export interface CatalogueQuery {
  market: Market;
  /** Buying or renting. Abroad there is only SALE. */
  deal?: Deal | null;
  /** Free text: a city, district or project name. */
  area?: string | null;
  minBeds?: number | null;
  /** For RENT this is the rent per period, not a purchase budget. */
  budgetMax?: number | null;
  /** APARTMENT, STUDIO, VILLA, … */
  kind?: string | null;
  limit?: number;
}

export interface CatalogueCard {
  buildingId: string;
  ref: string;
  title: string;
  location: string;
  /** A development with several units, rather than one property. */
  isProject: boolean;
  deal: Deal;
  type: string | null;
  bedrooms: string | null;
  areaSqm: string | null;
  price: number;
  currency: string;
  /** The cheapest unit of several — shown as "from". */
  priceFrom: boolean;
  /** RENT only: MONTHLY, QUARTERLY, YEARLY. */
  rentPeriod: string | null;
  image: string | null;
  url: string;
}

function siteUrl(market: Market): string {
  const base =
    market === 'LEBANON'
      ? process.env.FRONTEND_URL || 'https://propgrouplb.com'
      : process.env.INTERNATIONAL_SITE_URL || 'https://propgrp.com';
  return base.replace(/\/$/, '');
}

const range = (min: unknown, max: unknown, unit = ''): string | null => {
  if (typeof min !== 'number') return null;
  return typeof max === 'number' && max !== min ? `${min}–${max}${unit}` : `${min}${unit}`;
};

/** Every live listing on a building or its units. */
function liveListings(building: any): any[] {
  return [...(building.listings ?? []), ...(building.units ?? []).flatMap((u: any) => u.listings ?? [])];
}

function toCard(building: any): CatalogueCard | null {
  const p = mapBuildingToProperty(building, { detail: false }) as Record<string, any>;
  if (p.availabilityStatus !== 'AVAILABLE') return null;
  if (!p.referenceCode || !p.slug || !(p.price > 0)) return null;

  const market: Market = p.country === 'LEBANON' ? 'LEBANON' : 'GEORGIA';
  // The price on the card is the cheapest live listing's when there is one, so
  // the card's sale-or-rent has to come from that same listing.
  const listings = liveListings(building);
  const cheapest = listings.reduce<any>(
    (best, l) => (Number(l.price) > 0 && (!best || Number(l.price) < Number(best.price)) ? l : best),
    null
  );
  const deal: Deal = cheapest?.intent === 'FOR_RENT' ? 'RENT' : 'SALE';
  const isProject = market !== 'LEBANON' || building.kind === 'PROJECT' || (p.unitCount ?? 0) > 1;

  return {
    buildingId: building.id,
    ref: p.referenceCode,
    title: p.title,
    location: [p.district, p.city].filter(Boolean).join(', '),
    isProject,
    deal,
    type: p.propertyType ?? null,
    bedrooms: range(p.minBedrooms, p.maxBedrooms),
    areaSqm: range(p.minArea, p.maxArea, ' m²'),
    price: p.price,
    currency: p.currency || 'USD',
    priceFrom: isProject && (p.unitCount ?? 0) > 1,
    rentPeriod: deal === 'RENT' ? cheapest?.rentPeriod ?? 'MONTHLY' : null,
    image: typeof p.images?.[0] === 'string' && /^https:\/\//.test(p.images[0]) ? p.images[0] : null,
    url: `${siteUrl(market)}/property/${p.slug}`,
  };
}

/**
 * One reply reads the catalogue several times over — the ad's project, the
 * preferred list, the place names, then each search. It is the same stock each
 * time, so it is held for a minute rather than re-queried with every unit and
 * option attached.
 */
const CACHE_MS = 60_000;
const marketCache = new Map<Market, { at: number; cards: CatalogueCard[] }>();

/** Public, available stock in one market. */
async function loadMarket(market: Market): Promise<CatalogueCard[]> {
  const hit = marketCache.get(market);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.cards;
  const cards = await queryMarket(market);
  marketCache.set(market, { at: Date.now(), cards });
  return cards;
}

async function queryMarket(market: Market): Promise<CatalogueCard[]> {
  const buildings = await prisma.building.findMany({
    where: {
      visibility: 'PUBLIC',
      // International is "not Lebanon", never a fixed list of countries.
      country: market === 'LEBANON' ? 'LEBANON' : { not: 'LEBANON' },
    },
    include: FLAT_PROPERTY_INCLUDE,
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });
  return buildings.map(toCard).filter((c): c is CatalogueCard => c !== null);
}

/**
 * Stock that fits what a client asked for, best fit first.
 *
 * A budget is a ceiling with a little give (10%) — nobody thanks you for
 * hiding the flat that is $3,000 over. Price, type and bedrooms are derived
 * values, so they are tested here rather than in SQL.
 */
export async function searchCatalogue(query: CatalogueQuery): Promise<CatalogueCard[]> {
  const needle = query.area?.trim().toLowerCase() || null;
  const kind = query.kind?.trim().toUpperCase() || null;
  const budget = query.budgetMax && query.budgetMax > 0 ? query.budgetMax : null;
  // Abroad everything is for purchase; in Lebanon, buying unless told otherwise.
  const deal: Deal = query.market === 'LEBANON' && query.deal === 'RENT' ? 'RENT' : 'SALE';

  const matches = (await loadMarket(query.market)).filter((c) => {
    if (c.deal !== deal) return false;
    if (budget && c.price > budget * 1.1) return false;
    // A project holds many unit types; its headline type is only the smallest.
    if (kind && !c.isProject && c.type && c.type !== kind) return false;
    if (query.minBeds) {
      const most = Number(c.bedrooms?.split('–').pop());
      if (Number.isFinite(most) && most < query.minBeds) return false;
    }
    if (needle && ![c.title, c.location].join(' ').toLowerCase().includes(needle)) return false;
    return true;
  });

  // Closest to the budget first: the client asked for "up to X", and the best
  // answer to that is rarely the cheapest thing on the books.
  if (budget) matches.sort((a, b) => Math.abs(budget - a.price) - Math.abs(budget - b.price));

  return matches.slice(0, query.limit ?? 6);
}

/**
 * The place and project names we actually have stock under. Given to the chat
 * assistant so that a name half-heard in a voice note ("Batroun"? "Batumi"?)
 * resolves to somewhere real rather than to a confident guess.
 */
export async function marketNames(market: Market): Promise<{ places: string[]; projects: string[] }> {
  const cards = await loadMarket(market);
  const places = new Set<string>();
  for (const c of cards) for (const part of c.location.split(',')) if (part.trim()) places.add(part.trim());
  return {
    places: [...places].slice(0, 40),
    projects: cards.filter((c) => c.isProject).map((c) => c.title).slice(0, 40),
  };
}

/** Cards for specific reference codes, in the order asked for. */
export async function cardsByRef(refs: string[]): Promise<CatalogueCard[]> {
  const wanted = [...new Set(refs.map((r) => r.trim().toUpperCase()).filter(Boolean))].slice(0, 6);
  if (wanted.length === 0) return [];
  const buildings = await prisma.building.findMany({
    where: { ref: { in: wanted }, visibility: 'PUBLIC' },
    include: FLAT_PROPERTY_INCLUDE,
  });
  const cards = new Map<string, CatalogueCard>();
  for (const b of buildings) {
    const card = toCard(b);
    if (card) cards.set(card.ref.toUpperCase(), card);
  }
  return wanted.map((r) => cards.get(r)).filter((c): c is CatalogueCard => Boolean(c));
}

/**
 * Projects an advert was about, found by name. An ad for "Tonino Residence"
 * already says which project the client is asking about — nobody should have
 * to ask them again.
 */
export async function projectsNamedIn(text: string | null | undefined, market: Market): Promise<CatalogueCard[]> {
  const haystack = plain(text);
  if (!haystack) return [];
  return (await loadMarket(market))
    .filter((c) => {
      const title = plain(c.title);
      // The name as written in the CRM, or its reference code ("PG-1059").
      return (title.length >= 4 && haystack.includes(title)) || haystack.includes(plain(c.ref));
    })
    .slice(0, 3);
}

/**
 * Lower-case letters and digits with single spaces, accents and punctuation
 * gone — so "Tonino Residence", "TONINO-RESIDENCE" and "Tonino  Résidence!"
 * in an ad all match the same project.
 */
function plain(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const PERIOD: Record<string, string> = { MONTHLY: 'month', QUARTERLY: 'quarter', YEARLY: 'year' };

export function formatPrice(card: CatalogueCard): string {
  const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(card.price);
  const symbol = card.currency === 'USD' ? '$' : `${card.currency} `;
  const period = card.deal === 'RENT' ? ` / ${PERIOD[card.rentPeriod ?? 'MONTHLY'] ?? 'month'}` : '';
  return `${card.priceFrom ? 'from ' : ''}${symbol}${amount}${period}`;
}

/** One listing as a few lines of message text — the same facts as the public page. */
export function cardCaption(card: CatalogueCard): string {
  const size = card.isProject
    ? [card.bedrooms ? `${card.bedrooms === '0' ? 'studios' : `${card.bedrooms} bed`}` : null, card.areaSqm]
    : [card.bedrooms ? (card.bedrooms === '0' ? 'studio' : `${card.bedrooms} bed`) : null, card.areaSqm];
  return [
    `${card.title} (${card.ref})`,
    [card.location, ...size].filter(Boolean).join(' · '),
    `${card.deal === 'RENT' ? 'For rent' : card.isProject ? 'Units' : 'For sale'}: ${formatPrice(card)}`,
    card.url,
  ]
    .filter(Boolean)
    .join('\n');
}
