import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * Turning inbound messages into CRM clients.
 *
 * Everything here has to be safe to run twice: Meta retries a webhook until it
 * gets a 200, and a retry storm that creates twelve copies of the same client
 * is worse than missing the lead entirely.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Digits only, no leading +, so "+961 3 212 385" and "03212385" can be compared. */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 6) return null;
  // Lebanese local numbers are stored with the leading 0; strip it so they
  // compare equal to the E.164 form WhatsApp reports (961…).
  return digits.replace(/^0+/, '');
}

/** Does this stored phone refer to the same person as this E.164 number? */
function phoneMatches(stored: string | null, e164: string): boolean {
  const a = normalisePhone(stored);
  if (!a) return false;
  return e164.endsWith(a) || a.endsWith(e164);
}

export interface InboundLead {
  /** WhatsApp id (digits, E.164 without +) when the source is WhatsApp. */
  waId?: string | null;
  /** Facebook leadgen id — unique per submission, our idempotency key. */
  externalLeadId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  source: 'WHATSAPP' | 'FACEBOOK_AD';
  /** Free-text of what they asked for, straight from the ad form. */
  askingFor?: string | null;
}

/**
 * Find the existing client this message belongs to, or create one.
 *
 * Matching order matters: the external id is exact, the WhatsApp id is exact,
 * and only then do we fall back to comparing phone numbers — which is fuzzy
 * enough that it must never be the first thing we try.
 */
export async function upsertInboundLead(input: InboundLead): Promise<{ lead: any; created: boolean }> {
  const waId = input.waId ? normalisePhone(input.waId) : null;

  if (input.externalLeadId) {
    const seen = await prisma.lead.findUnique({ where: { externalLeadId: input.externalLeadId } });
    if (seen) return { lead: seen, created: false };
  }

  if (waId) {
    const byWa = await prisma.lead.findUnique({ where: { waId } });
    if (byWa) return { lead: byWa, created: false };
  }

  // Phone fallback. Postgres can't do "endsWith" across formats, so we pull the
  // plausible candidates by suffix and compare properly in memory.
  const digits = normalisePhone(input.phone) ?? waId;
  if (digits) {
    const tail = digits.slice(-7);
    const candidates = await prisma.lead.findMany({
      where: {
        OR: [{ phone: { contains: tail } }, { whatsapp: { contains: tail } }],
      },
      take: 20,
    });
    const hit = candidates.find(
      (c: any) => phoneMatches(c.phone, digits) || phoneMatches(c.whatsapp, digits)
    );
    if (hit) {
      // Remember the WhatsApp id so the next message is an exact match.
      if (waId && !hit.waId) {
        await prisma.lead.update({ where: { id: hit.id }, data: { waId } });
      }
      return { lead: hit, created: false };
    }
  }

  const lead = await prisma.lead.create({
    data: {
      market: 'LEBANON',
      type: 'BUYER',
      status: 'ACTIVE',
      // They reached out and nobody has replied — that's the honest state, and
      // it puts them straight into the "waiting on us" filter.
      subStatus: 'AWAITING_REPLY',
      source: input.source,
      name: input.name?.trim() || `WhatsApp ${digits ?? 'contact'}`,
      phone: input.phone || (digits ? `+${digits}` : null),
      whatsapp: waId ? `+${waId}` : input.phone || null,
      email: input.email || null,
      waId,
      externalLeadId: input.externalLeadId || null,
      askingFor: input.askingFor || null,
      notes: input.message || null,
      contactIntervalDays: 3,
    },
  });

  logger.info('Lead auto-created from inbound message', { source: input.source, leadId: lead.id });
  return { lead, created: true };
}

/**
 * Record an inbound message on the client's timeline.
 *
 * Deliberately does NOT touch `lastContactAt`: that field means "when we last
 * contacted them". A client messaging us is the opposite, and letting it count
 * would hide the people we owe a reply to.
 */
export async function logInboundMessage(
  leadId: string,
  body: string,
  channel: 'WHATSAPP' | 'NOTE' = 'WHATSAPP'
): Promise<void> {
  await prisma.leadContact.create({
    data: {
      leadId,
      channel,
      body: body.slice(0, 4000),
      outcome: 'Inbound',
      contactedAt: new Date(),
    },
  });
  // Bump updatedAt so the board's "last action" sort floats them up, and flag
  // that the ball is in our court.
  await prisma.lead.update({
    where: { id: leadId },
    data: { subStatus: 'AWAITING_REPLY' },
  });
}
