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

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

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
  logger.debug('Meta ad spend fetched', { days, ads: ads.length });
  return data;
}

export interface ConnectionCheck {
  name: string;
  ok: boolean;
  /** What was found, or what is wrong and where to fix it. */
  detail: string;
}

/**
 * Walk the whole Meta link end to end and say, in order, what works.
 *
 * Read-only: it looks things up and changes nothing. Each step is independent,
 * so one failure does not hide the state of the others.
 */
export async function checkMetaConnection(): Promise<ConnectionCheck[]> {
  const checks: ConnectionCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const attempt = async (name: string, fn: () => Promise<string>) => {
    try {
      add(name, true, await fn());
    } catch (err) {
      add(name, false, (err as Error).message);
    }
  };
  const base = `https://graph.facebook.com/${GRAPH_VERSION}`;

  add(
    'Webhook secrets',
    Boolean(process.env.META_APP_SECRET && process.env.META_VERIFY_TOKEN),
    process.env.META_APP_SECRET && process.env.META_VERIFY_TOKEN
      ? 'META_APP_SECRET and META_VERIFY_TOKEN are set, so lead forms and Instagram messages can be received.'
      : 'META_APP_SECRET or META_VERIFY_TOKEN is missing on the server, so nothing from Meta is accepted.'
  );

  if (!process.env.META_ACCESS_TOKEN) {
    add('Access token', false, 'META_ACCESS_TOKEN is not set on the server. Nothing below can be checked without it.');
    return checks;
  }

  await attempt('Access token', async () => {
    const me = await graph(`${base}/me?fields=id,name`);
    return `Valid. Meta sees it as "${me.name ?? me.id}".`;
  });

  // Lead forms: the Page must be reachable AND subscribed to this app for leadgen.
  await attempt('Facebook Page and lead forms', async () => {
    const pages = (await graph(`${base}/me/accounts?fields=id,name,access_token&limit=50`)).data ?? [];
    if (pages.length === 0) throw new Error('The token cannot reach any Facebook Page. Assign the Page to the system user in Business Settings.');
    const lines: string[] = [];
    let anySubscribed = false;
    for (const page of pages) {
      const res = await fetch(`${base}/${page.id}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${page.access_token}` },
        signal: AbortSignal.timeout(15_000),
      });
      const json: any = await res.json().catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
      const subscribed = (json.data ?? []).some((app: any) => (app.subscribed_fields ?? []).includes('leadgen')); // eslint-disable-line @typescript-eslint/no-explicit-any
      anySubscribed ||= subscribed;
      lines.push(`${page.name}: ${subscribed ? 'sending lead forms to the CRM' : 'NOT subscribed for lead forms'}`);
    }
    if (!anySubscribed) throw new Error(`${lines.join('; ')}. Subscribe the Page to the app for "leadgen".`);
    return lines.join('; ') + '.';
  });

  if (!process.env.META_AD_ACCOUNT_ID) {
    add('Ad account', false, 'META_AD_ACCOUNT_ID is not set on the server, so spend cannot be read.');
  } else {
    const account = `act_${String(process.env.META_AD_ACCOUNT_ID).replace(/^act_/, '')}`;
    await attempt('Ad account', async () => {
      const a = await graph(`${base}/${account}?fields=name,currency,account_status`);
      return `"${a.name}" in ${a.currency}${a.account_status === 1 ? ', active' : `, status code ${a.account_status}`}.`;
    });
    await attempt('Ad spend', async () => {
      const rows = (await graph(`${base}/${account}/insights?date_preset=last_30d&fields=spend,impressions`)).data ?? [];
      return rows.length
        ? `Readable. Last 30 days: ${rows[0].spend} spent, ${rows[0].impressions} impressions.`
        : 'Readable, but there was no ad activity in the last 30 days.';
    });
  }

  if (!process.env.META_DATASET_ID) {
    add('Reporting results back', false, 'META_DATASET_ID is not set on the server, so Meta is not told which leads became buyers.');
  } else {
    await attempt('Reporting results back', async () => {
      const d = await graph(`${base}/${encodeURIComponent(process.env.META_DATASET_ID as string)}?fields=id,name`);
      return `Dataset "${d.name ?? d.id}" is reachable with this token.`;
    });
  }

  return checks;
}
