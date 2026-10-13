import { logger } from '../utils/logger.js';

/**
 * Ad spend from Meta's Marketing API, so the CRM can put a cost next to the
 * clients and deals each ad produced.
 *
 * Read-only: this never creates, edits or pauses anything in the ad account.
 *
 * Env:
 *   META_AD_ACCOUNT_ID — the ad account, with or without the "act_" prefix
 *   META_ACCESS_TOKEN  — the system-user token (needs ads_read or ads_management)
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

/** Meta rate-limits insights hard, and yesterday's spend does not change by the minute. */
const CACHE_MS = 15 * 60 * 1000;

export interface AdSpend {
  adId: string;
  adName: string | null;
  campaignName: string | null;
  spend: number;
  impressions: number;
  clicks: number;
}

export interface AdAccountSpend {
  currency: string;
  ads: AdSpend[];
}

const cache = new Map<number, { at: number; data: AdAccountSpend }>();

export function adsConfigured(): boolean {
  return Boolean(process.env.META_AD_ACCOUNT_ID && process.env.META_ACCESS_TOKEN);
}

async function graph(url: string): Promise<any> {
  const res = await fetch(url, {
    // Token in a header, never the query string — URLs end up in access logs.
    headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(20_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Meta answered HTTP ${res.status}`);
  }
  return json;
}

/**
 * "Campaign · Ad name" for one advert, as the team named them in Ads Manager —
 * usually far more telling than the headline ("Batumi studios — Oct" against
 * "Own a home by the sea"). Null when it cannot be read.
 */
export async function describeAd(adId: string): Promise<string | null> {
  if (!process.env.META_ACCESS_TOKEN) return null;
  try {
    const json = await graph(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(adId)}?fields=name,campaign{name}`
    );
    return [json.campaign?.name, json.name].filter(Boolean).join(' · ') || null;
  } catch (err) {
    logger.warn('Ad details not available', { adId, error: (err as Error).message });
    return null;
  }
}

/** Spend per ad over the last `days` days. Throws with Meta's own message on failure. */
export async function fetchAdSpend(days: number): Promise<AdAccountSpend> {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const account = `act_${String(process.env.META_AD_ACCOUNT_ID).replace(/^act_/, '')}`;
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${account}`;

  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    level: 'ad',
    fields: 'ad_id,ad_name,campaign_name,spend,impressions,clicks',
    time_range: JSON.stringify({ since: day(since), until: day(until) }),
    limit: '500',
  });

  const [{ currency }, ads] = await Promise.all([
    graph(`${base}?fields=currency`),
    (async () => {
      const rows: AdSpend[] = [];
      let next: string | undefined = `${base}/insights?${params}`;
      // Bounded: an account with more than 5,000 ads in the window is not this one.
      for (let page = 0; next && page < 10; page++) {
        const json: any = await graph(next);
        for (const r of json.data ?? []) {
          rows.push({
            adId: String(r.ad_id),
            adName: r.ad_name ?? null,
            campaignName: r.campaign_name ?? null,
            spend: Number(r.spend) || 0,
            impressions: Number(r.impressions) || 0,
            clicks: Number(r.clicks) || 0,
          });
        }
        next = json.paging?.next;
      }
      return rows;
    })(),
  ]);

  const data = { currency: currency ?? 'USD', ads };
  cache.set(days, { at: Date.now(), data });
  logger.info('Meta ad spend fetched', { days, ads: ads.length });
  return data;
}
