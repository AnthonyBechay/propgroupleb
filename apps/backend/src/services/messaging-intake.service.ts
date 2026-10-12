import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * Turning Meta webhook deliveries into inbox threads and CRM clients.
 *
 * Everything here has to be safe to run twice: Meta retries a webhook until it
 * gets a 200, and a retry storm that creates twelve copies of the same client
 * is worse than missing the lead entirely.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Channel = 'WHATSAPP' | 'INSTAGRAM';

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

/**
 * The client a phone number already belongs to, without creating anything.
 * Postgres can't do "endsWith" across formats, so pull the plausible candidates
 * by suffix and compare properly in memory.
 */
async function findLeadByPhone(digits: string): Promise<any | null> {
  const tail = digits.slice(-7);
  const candidates = await prisma.lead.findMany({
    where: { OR: [{ phone: { contains: tail } }, { whatsapp: { contains: tail } }] },
    take: 20,
  });
  return (
    candidates.find(
      (c: any) => phoneMatches(c.phone, digits) || phoneMatches(c.whatsapp, digits)
    ) ?? null
  );
}

/** The known client behind a WhatsApp id or Instagram user id, if any. */
async function findLeadForSender(channel: Channel, externalId: string): Promise<any | null> {
  if (channel === 'INSTAGRAM') {
    return prisma.lead.findUnique({ where: { igId: externalId } });
  }
  const byWa = await prisma.lead.findUnique({ where: { waId: externalId } });
  if (byWa) return byWa;

  const hit = await findLeadByPhone(externalId);
  if (hit && !hit.waId) {
    // Remember it so the next message is an exact match.
    await prisma.lead.update({ where: { id: hit.id }, data: { waId: externalId } });
  }
  return hit;
}

export interface AdReferral {
  adId?: string | null;
  label?: string | null;
}

export interface ChatEvent {
  channel: Channel;
  /** WhatsApp id or Instagram-scoped user id of the OTHER party. */
  externalId: string;
  displayName?: string | null;
  /** The platform's message id — the idempotency key. */
  messageId: string;
  direction: 'IN' | 'OUT';
  type: string;
  body: string;
  mediaId?: string | null;
  /** Outbound only: PHONE (typed in the app), CRM or AI. */
  origin?: string | null;
  sentAt?: Date;
  referral?: AdReferral | null;
}

/**
 * Store one message on its thread, creating the thread on first contact.
 *
 * A thread is linked to a client when the sender is already known, or when the
 * message came from an ad — that is a real enquiry by construction. Any other
 * unknown sender stays an unlinked thread: a work number also hears from
 * suppliers and wrong numbers, and a client per stranger ruins the pipeline.
 */
export async function recordChatMessage(event: ChatEvent): Promise<void> {
  const externalId =
    event.channel === 'WHATSAPP' ? normalisePhone(event.externalId) ?? event.externalId : event.externalId;

  // Retries carry the same message id; the unique index is the real guard, this
  // just avoids the wasted work in the common case.
  if (await prisma.chatMessage.findUnique({ where: { externalId: event.messageId } })) return;

  const sentAt = event.sentAt ?? new Date();
  const inbound = event.direction === 'IN';
  const preview = event.body.slice(0, 140);

  let conversation = await prisma.conversation.findUnique({
    where: { channel_externalId: { channel: event.channel, externalId } },
  });

  if (!conversation) {
    let lead = await findLeadForSender(event.channel, externalId);
    if (!lead && inbound && event.referral?.adId) {
      lead = await createLeadFromChat(event, externalId);
    }
    conversation = await prisma.conversation.create({
      data: {
        channel: event.channel,
        externalId,
        displayName: event.displayName || null,
        leadId: lead?.id ?? null,
        adId: event.referral?.adId ?? null,
        adLabel: event.referral?.label ?? null,
      },
    });
  }

  try {
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        direction: event.direction,
        externalId: event.messageId,
        type: event.type,
        body: event.body.slice(0, 4000),
        mediaId: event.mediaId ?? null,
        origin: inbound ? null : event.origin ?? null,
        sentAt,
      },
    });
  } catch (err: any) {
    // Two deliveries of the same message raced past the check above.
    if (err?.code === 'P2002') return;
    throw err;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: sentAt,
      lastPreview: preview,
      ...(event.displayName && !conversation.displayName ? { displayName: event.displayName } : {}),
      ...(inbound
        ? { lastInboundAt: sentAt, unreadCount: { increment: 1 } }
        : // We answered, from wherever — nothing is waiting on us any more.
          { unreadCount: 0 }),
    },
  });

  if (conversation.leadId) {
    await prisma.lead.update({
      where: { id: conversation.leadId },
      data: inbound
        ? // The ball is in our court. Deliberately not `lastContactAt`: that
          // means "when we last contacted them", and a client messaging us is
          // the opposite.
          { subStatus: 'AWAITING_REPLY' }
        : { lastContactAt: sentAt },
    });
  }
}

/** A new client from an ad-driven first message. */
async function createLeadFromChat(event: ChatEvent, externalId: string): Promise<any> {
  const isWhatsApp = event.channel === 'WHATSAPP';
  const lead = await prisma.lead.create({
    data: {
      type: 'BUYER',
      status: 'ACTIVE',
      subStatus: 'AWAITING_REPLY',
      source: isWhatsApp ? 'WHATSAPP' : 'FACEBOOK_AD',
      name:
        event.displayName?.trim() ||
        (isWhatsApp ? `WhatsApp +${externalId}` : 'Instagram contact'),
      phone: isWhatsApp ? `+${externalId}` : null,
      whatsapp: isWhatsApp ? `+${externalId}` : null,
      waId: isWhatsApp ? externalId : null,
      igId: isWhatsApp ? null : externalId,
      adId: event.referral?.adId ?? null,
      adLabel: event.referral?.label ?? null,
      notes: event.body.slice(0, 4000),
      contactIntervalDays: 3,
    },
  });
  logger.info('Client auto-created from ad message', { channel: event.channel, leadId: lead.id });
  return lead;
}

/** Delivery receipts for messages we sent. Unknown ids are ignored. */
export async function recordMessageStatus(messageId: string, status: string): Promise<void> {
  await prisma.chatMessage.updateMany({ where: { externalId: messageId }, data: { status } });
}

export interface LeadFormSubmission {
  /** Facebook leadgen id — unique per submission, the idempotency key. */
  leadgenId: string;
  adId?: string | null;
  formName?: string | null;
  fields: Record<string, string>;
}

/**
 * A Lead Ads form submission. Always a client — somebody filled in a form
 * asking to be contacted — matched to an existing one by phone where possible.
 */
export async function upsertLeadFromForm(
  input: LeadFormSubmission
): Promise<{ lead: any; created: boolean }> {
  const seen = await prisma.lead.findUnique({ where: { externalLeadId: input.leadgenId } });
  if (seen) return { lead: seen, created: false };

  const f = input.fields;
  const name =
    f.full_name || [f.first_name, f.last_name].filter(Boolean).join(' ') || null;
  const phone = f.phone_number || f.phone || null;
  const email = f.email || null;
  const answers = Object.entries(f)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n');

  const digits = normalisePhone(phone);
  const existing = digits ? await findLeadByPhone(digits) : null;
  if (existing) {
    // Same person asking again: keep one client, and put the new answers on
    // their timeline so the enquiry is not lost.
    await prisma.leadContact.create({
      data: {
        leadId: existing.id,
        channel: 'NOTE',
        body: `Facebook lead form${input.formName ? ` (${input.formName})` : ''}\n${answers}`.slice(0, 4000),
        outcome: 'Inbound',
      },
    });
    await prisma.lead.update({ where: { id: existing.id }, data: { subStatus: 'AWAITING_REPLY' } });
    return { lead: existing, created: false };
  }

  const lead = await prisma.lead.create({
    data: {
      type: 'BUYER',
      status: 'ACTIVE',
      subStatus: 'AWAITING_REPLY',
      source: 'FACEBOOK_AD',
      name: name?.trim() || (digits ? `Facebook lead +${digits}` : 'Facebook lead'),
      phone,
      whatsapp: phone,
      email,
      externalLeadId: input.leadgenId,
      adId: input.adId ?? null,
      adLabel: input.formName ?? null,
      notes: answers || null,
      contactIntervalDays: 3,
    },
  });
  logger.info('Client auto-created from lead form', { leadId: lead.id });
  return { lead, created: true };
}
