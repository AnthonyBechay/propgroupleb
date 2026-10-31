import crypto from 'node:crypto';
import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * Telling Meta which ad leads turned into real business.
 *
 * Meta optimises an ad for whatever it can see. Left alone that is "filled in
 * a form", so it finds more people who fill in forms. Reporting the leads that
 * reached a viewing, and the ones that bought, lets it look for more of those.
 *
 * Meta asks for every stage of the funnel, starting with the raw lead, so
 * three are sent: "Lead" when the client arrives, "Qualified" when a deal of
 * theirs reaches a viewing, "Converted" when one closes. Each client is
 * reported at most once per stage, and only ever forwards.
 *
 * Two kinds of client, reported two ways:
 *   - From a lead form (or with no ad click to point at): a CRM event —
 *     "Lead" / "Qualified" / "Converted" — to META_DATASET_ID, matched by the
 *     lead-form id or hashed phone and email.
 *   - From a click-to-WhatsApp ad: a business-messaging event —
 *     "LeadSubmitted" / "QualifiedLead" / "Purchase" — carrying the ad click id,
 *     sent to the dataset Meta links to the WhatsApp Business Account. Only
 *     this kind is credited to a WhatsApp ad.
 *
 * Env:
 *   META_DATASET_ID   — the dataset (pixel) id from Meta Events Manager, set up
 *                       for CRM / conversion leads
 *   META_WHATSAPP_DATASET_ID — optional; the dataset linked to the WhatsApp
 *                       Business Account. Looked up automatically when unset.
 *   META_ACCESS_TOKEN — the system-user token
 *   META_TEST_EVENT_CODE — optional; while set, events land in Events
 *                       Manager's "Test events" tab instead of the real data
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

const STAGES = { Lead: 1, Qualified: 2, Converted: 3 } as const;
type Stage = keyof typeof STAGES;

/** A viewing or beyond means a real buyer; a closed deal means a customer. */
const QUALIFIED = ['VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'RESERVED'];

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/** The same stages, in the names Meta uses for conversations on WhatsApp. */
const MESSAGING_EVENT: Record<Stage, string> = { Lead: 'LeadSubmitted', Qualified: 'QualifiedLead', Converted: 'Purchase' };

const waDatasetCache = new Map<string, string>();

/**
 * The dataset Meta links to a WhatsApp Business Account — where WhatsApp-ad
 * results have to go. Asking creates it if the account has none yet. Needs a
 * token with whatsapp_business_manage_events on that account.
 */
export async function whatsappDatasetId(wabaId: string): Promise<string> {
  if (process.env.META_WHATSAPP_DATASET_ID) return process.env.META_WHATSAPP_DATASET_ID;
  const hit = waDatasetCache.get(wabaId);
  if (hit) return hit;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/dataset`;
  const headers = { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` };
  let res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  let json: any = await res.json().catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
  let id = json?.id ?? json?.data?.[0]?.dataset_id ?? json?.data?.[0]?.id;
  if (!id) {
    // None linked yet: this call creates (or returns) it.
    res = await fetch(url, { method: 'POST', headers, signal: AbortSignal.timeout(15_000) });
    json = await res.json().catch(() => ({}));
    id = json?.id ?? json?.data?.[0]?.dataset_id ?? json?.data?.[0]?.id;
  }
  if (!id) throw new Error(json?.error?.message ?? `No dataset for WhatsApp account ${wabaId} (HTTP ${res.status})`);
  waDatasetCache.set(wabaId, String(id));
  return String(id);
}

export function conversionsConfigured(): boolean {
  return Boolean(process.env.META_DATASET_ID && process.env.META_ACCESS_TOKEN);
}

export interface ReportOutcome {
  status: 'sent' | 'skipped' | 'failed';
  detail: string;
}

/** Report this client's furthest stage to Meta, if it is news. Never throws. */
export async function reportLeadStage(leadId: string): Promise<ReportOutcome> {
  if (!conversionsConfigured()) return { status: 'skipped', detail: 'META_DATASET_ID is not set' };
  // Hands the claimed stage back when Meta never got it, so the next change retries.
  let release: () => Promise<unknown> = async () => {};
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true, adId: true, externalLeadId: true, phone: true, email: true, metaStage: true,
        ctwaClid: true, wabaId: true,
        opportunities: { select: { stage: true, soldPrice: true, soldCurrency: true } },
      },
    });
    // Only people an ad brought in: anyone else tells Meta nothing about its ads.
    if (!lead || (!lead.adId && !lead.externalLeadId && !lead.ctwaClid)) return { status: 'skipped', detail: 'not from an ad' };

    const stages = lead.opportunities.map((o) => o.stage as string);
    const reached: Stage = stages.includes('WON')
      ? 'Converted'
      : stages.some((s) => QUALIFIED.includes(s))
        ? 'Qualified'
        : 'Lead';
    if (STAGES[reached] <= (STAGES[lead.metaStage as Stage] ?? 0)) {
      return { status: 'skipped', detail: `"${lead.metaStage}" already reported` };
    }
    // Claim the stage before telling Meta. An ad that names a project creates
    // the client and opens its deal at once, both report, and both used to read
    // "nothing reported yet" — so every such lead reached Meta twice.
    const below = (Object.keys(STAGES) as Stage[]).filter((s) => STAGES[s] < STAGES[reached]);
    const claimed = await prisma.lead.updateMany({
      where: { id: lead.id, OR: [{ metaStage: null }, { metaStage: { in: below } }] },
      data: { metaStage: reached },
    });
    if (claimed.count === 0) return { status: 'skipped', detail: `"${reached}" already being reported` };
    release = () => prisma.lead.update({ where: { id: lead.id }, data: { metaStage: lead.metaStage } }).catch(() => {});

    // A click-to-WhatsApp client: report against the ad click itself.
    const wabaId = lead.wabaId || process.env.META_WABA_ID || null;
    if (lead.ctwaClid && wabaId) {
      const won = lead.opportunities.find((o) => o.stage === 'WON' && o.soldPrice);
      const dataset = await whatsappDatasetId(wabaId);
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(dataset)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` },
        body: JSON.stringify({
          data: [
            {
              event_name: MESSAGING_EVENT[reached],
              event_time: Math.floor(Date.now() / 1000),
              action_source: 'business_messaging',
              messaging_channel: 'whatsapp',
              user_data: { whatsapp_business_account_id: wabaId, ctwa_clid: lead.ctwaClid },
              ...(reached === 'Converted'
                ? { custom_data: { currency: won?.soldCurrency ?? 'USD', value: won?.soldPrice ?? 0 } }
                : {}),
            },
          ],
          ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const json: any = await res.json().catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
        const reason = json?.error?.error_user_msg ?? json?.error?.message ?? `HTTP ${res.status}`;
        logger.error('Meta WhatsApp conversion not accepted', { leadId, status: res.status, reason });
        await release();
        return { status: 'failed', detail: reason };
      }
      logger.info('Meta WhatsApp conversion reported', { leadId, event: MESSAGING_EVENT[reached] });
      return { status: 'sent', detail: MESSAGING_EVENT[reached] };
    }

    // Meta matches the event to the person by the lead-form id when there is
    // one, otherwise by hashed contact details. Nothing is sent in the clear.
    const digits = lead.phone?.replace(/\D/g, '').replace(/^0+/, '');
    const leadFormId = /^\d{10,20}$/.test(lead.externalLeadId ?? '') ? (lead.externalLeadId as string) : null;
    const userData: Record<string, unknown> = {
      ...(leadFormId ? { lead_id: leadFormId } : {}),
      ...(digits ? { ph: [sha256(digits)] } : {}),
      ...(lead.email ? { em: [sha256(lead.email.trim().toLowerCase())] } : {}),
    };
    if (Object.keys(userData).length === 0) {
      await release();
      return { status: 'skipped', detail: 'no lead id, phone or email to match on' };
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(process.env.META_DATASET_ID as string)}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        },
        // Meta wants lead_id as a bare number, but its ids run to 17 digits —
        // past what a JavaScript number holds exactly — so it travels through
        // JSON.stringify as text and is unquoted afterwards.
        body: JSON.stringify({
          data: [
            {
              event_name: reached,
              event_time: Math.floor(Date.now() / 1000),
              action_source: 'system_generated',
              custom_data: { event_source: 'crm', lead_event_source: 'PropGroup CRM' },
              user_data: userData,
            },
          ],
          ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
        }).replace(/"lead_id":"(\d+)"/, '"lead_id":$1'),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      const json: any = await res.json().catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
      const reason = json?.error?.error_user_msg ?? json?.error?.message ?? `HTTP ${res.status}`;
      logger.error('Meta conversion not accepted', { leadId, status: res.status, reason });
      await release();
      return { status: 'failed', detail: reason };
    }
    logger.info('Meta conversion reported', { leadId, stage: reached });
    return { status: 'sent', detail: reached };
  } catch (err) {
    logger.error('Meta conversion failed', { leadId, error: (err as Error).message });
    await release();
    return { status: 'failed', detail: (err as Error).message };
  }
}
