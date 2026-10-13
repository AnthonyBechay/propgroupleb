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
 * Each client is reported at most once per stage, and only ever forwards.
 *
 * Env:
 *   META_DATASET_ID   — the dataset (pixel) id from Meta Events Manager, set up
 *                       for CRM / conversion leads
 *   META_ACCESS_TOKEN — the system-user token
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

const STAGES = { Qualified: 1, Converted: 2 } as const;
type Stage = keyof typeof STAGES;

/** A viewing or beyond means a real buyer; a closed deal means a customer. */
const QUALIFIED = ['VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'RESERVED'];

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export function conversionsConfigured(): boolean {
  return Boolean(process.env.META_DATASET_ID && process.env.META_ACCESS_TOKEN);
}

/** Report this client's furthest stage to Meta, if it is news. Never throws. */
export async function reportLeadStage(leadId: string): Promise<void> {
  if (!conversionsConfigured()) return;
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true, adId: true, externalLeadId: true, phone: true, email: true, metaStage: true,
        opportunities: { select: { stage: true } },
      },
    });
    // Only people an ad brought in: anyone else tells Meta nothing about its ads.
    if (!lead || (!lead.adId && !lead.externalLeadId)) return;

    const stages = lead.opportunities.map((o) => o.stage as string);
    const reached: Stage | null = stages.includes('WON')
      ? 'Converted'
      : stages.some((s) => QUALIFIED.includes(s))
        ? 'Qualified'
        : null;
    if (!reached) return;
    if (STAGES[reached] <= (STAGES[lead.metaStage as Stage] ?? 0)) return;

    // Meta matches the event to the person by the lead-form id when there is
    // one, otherwise by hashed contact details. Nothing is sent in the clear.
    const digits = lead.phone?.replace(/\D/g, '').replace(/^0+/, '');
    const userData: Record<string, unknown> = {
      ...(lead.externalLeadId ? { lead_id: lead.externalLeadId } : {}),
      ...(digits ? { ph: [sha256(digits)] } : {}),
      ...(lead.email ? { em: [sha256(lead.email.trim().toLowerCase())] } : {}),
    };
    if (Object.keys(userData).length === 0) return;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(process.env.META_DATASET_ID as string)}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        },
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
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!res.ok) {
      const json: any = await res.json().catch(() => ({})); // eslint-disable-line @typescript-eslint/no-explicit-any
      logger.error('Meta conversion not accepted', { leadId, status: res.status, reason: json?.error?.message });
      return;
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { metaStage: reached } });
    logger.info('Meta conversion reported', { leadId, stage: reached });
  } catch (err) {
    logger.error('Meta conversion failed', { leadId, error: (err as Error).message });
  }
}
