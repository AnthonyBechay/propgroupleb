import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'node:crypto';
import { uploadFileAtKey } from './upload.service.js';
import { recordAdEnquiry } from './deal-sync.service.js';
import { describeAd } from './meta-ads.service.js';
import { reportLeadStage } from './meta-conversions.service.js';

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
 *
 * Numbers are typed into the CRM however the broker likes — "+961 71 952 211",
 * "71-952211", "03 212 385" — so the stored text is stripped to digits in SQL
 * before comparing its tail. A plain `contains` on the raw column silently
 * missed every number written with a space or a dash. The suffix match only
 * narrows the candidates; the real comparison happens in memory.
 */
async function findLeadByPhone(digits: string): Promise<any | null> {
  const tail = `%${digits.slice(-7)}`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM leads
    WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${tail}
       OR regexp_replace(coalesce(whatsapp, ''), '[^0-9]', '', 'g') LIKE ${tail}
    LIMIT 20`;
  if (rows.length === 0) return null;
  const candidates = await prisma.lead.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
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

/**
 * Which market a brand-new client is filed under. Meta does not say what the
 * person wants, so this follows the account they wrote to: the Facebook Page
 * and Instagram account (`LEAD_MARKET_META`) or the WhatsApp number
 * (`LEAD_MARKET_WHATSAPP`). It is only a starting point — editable on the
 * client, and never applied to someone already in the CRM.
 */
function marketFor(source: 'META' | 'WHATSAPP'): 'LEBANON' | 'GEORGIA' {
  const value = (process.env[`LEAD_MARKET_${source}`] ?? '').toUpperCase();
  return value === 'GEORGIA' ? 'GEORGIA' : 'LEBANON';
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
  /** A second id the same message may already be stored under (provider id vs wamid). */
  altMessageId?: string | null;
  direction: 'IN' | 'OUT';
  type: string;
  body: string;
  mediaId?: string | null;
  /** Where the platform serves the attachment from, when it gives a link. */
  media?: { url: string; mime?: string | null; filename?: string | null } | null;
  /** Outbound only: PHONE (typed in the app), CRM or AI. */
  origin?: string | null;
  sentAt?: Date;
  referral?: AdReferral | null;
  /**
   * A replay of past chat from when the number was first connected. Stored on
   * the thread, but it is not news: no unread badge, no new client, and the
   * client's follow-up state is left alone.
   */
  history?: boolean;
}

/**
 * Store one message on its thread, creating the thread on first contact.
 *
 * A thread is linked to a client when the sender is already known, or when the
 * message came from an ad — that is a real enquiry by construction. Any other
 * unknown sender stays an unlinked thread: a work number also hears from
 * suppliers and wrong numbers, and a client per stranger ruins the pipeline.
 */
export async function recordChatMessage(event: ChatEvent): Promise<string | null> {
  const externalId =
    event.channel === 'WHATSAPP' ? normalisePhone(event.externalId) ?? event.externalId : event.externalId;

  // Retries carry the same message id; the unique index is the real guard, this
  // just avoids the wasted work in the common case.
  if (!event.messageId) return null;
  const ids = [event.messageId, event.altMessageId].filter((id): id is string => Boolean(id));
  if (await prisma.chatMessage.findFirst({ where: { externalId: { in: ids } }, select: { id: true } })) {
    return null;
  }

  const sentAt = event.sentAt ?? new Date();
  const inbound = event.direction === 'IN';

  // A message we sent through the API can come back as an echo "from the
  // phone" under an id we were never given. Stored twice it would look as if a
  // person had answered — and the assistant steps aside for a person. So an
  // echo that repeats, word for word, what the CRM or the assistant sent on
  // this thread moments ago is that same message, not a new one.
  if (!inbound && event.origin === 'PHONE' && !event.history) {
    const twin = await prisma.chatMessage.findFirst({
      where: {
        direction: 'OUT',
        origin: { in: ['AI', 'CRM'] },
        body: event.body.slice(0, 4000),
        sentAt: { gte: new Date(Date.now() - 3 * 60 * 1000) },
        conversation: { channel: event.channel, externalId },
      },
      select: { id: true },
    });
    if (twin) return null;
  }
  const preview = event.body.slice(0, 140);

  let conversation = await prisma.conversation.findUnique({
    where: { channel_externalId: { channel: event.channel, externalId } },
  });

  if (!conversation) {
    let lead = await findLeadForSender(event.channel, externalId);
    if (!lead && inbound && !event.history && event.referral?.adId) {
      lead = await createLeadFromChat(event, externalId);
    }
    try {
      conversation = await prisma.conversation.create({
        data: {
          channel: event.channel,
          externalId,
          displayName: event.displayName || null,
          leadId: lead?.id ?? null,
          adId: event.referral?.adId ?? null,
          adLabel: event.referral?.label ?? null,
          // Backdated a moment so the first message, stamped by the platform
          // slightly before this row exists, still counts as the newest and
          // gets to set the thread's preview and position.
          lastMessageAt: new Date(sentAt.getTime() - 1),
        },
      });
      if (event.channel === 'INSTAGRAM' && !event.displayName) void nameInstagramSender(conversation.id, externalId);
      if (!event.history && event.referral?.adId) {
        void noteAd(conversation.id, lead?.id ?? null, event.referral.adId, event.referral.label ?? null, event.channel);
      }
    } catch (err: any) {
      // Two messages from a new sender arrived together (a history import does
      // this constantly) and the other one created the thread first.
      if (err?.code !== 'P2002') throw err;
      conversation = await prisma.conversation.findUniqueOrThrow({
        where: { channel_externalId: { channel: event.channel, externalId } },
      });
    }
  } else if (!conversation.leadId && !event.history) {
    // The sender may have been added to the CRM by hand since the thread began.
    const lead = await findLeadForSender(event.channel, externalId);
    if (lead) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { leadId: lead.id },
      });
    }
  }

  let stored: { id: string };
  try {
    stored = await prisma.chatMessage.create({
      select: { id: true },
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
    if (err?.code === 'P2002') return null;
    throw err;
  }

  logger.info('Chat message stored', {
    channel: event.channel,
    direction: event.direction,
    type: event.type,
    ...(event.history ? { history: true } : {}),
    ...(event.origin ? { origin: event.origin } : {}),
    conversation: conversation.id,
    client: conversation.leadId ?? 'none',
  });

  // Not awaited: a slow download must not hold up the thread, and a failed one
  // only costs the attachment, never the message.
  if (event.media?.url) {
    void keepMedia(stored.id, event.media, {
      channel: event.channel,
      externalId,
      direction: event.direction,
      type: event.type,
      sentAt,
    });
  }

  // History arrives out of order and long after the fact, so a thread's
  // summary only ever moves forward in time.
  const newest = sentAt >= conversation.lastMessageAt;
  const live = !event.history;

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      ...(newest ? { lastMessageAt: sentAt, lastPreview: preview } : {}),
      ...(event.displayName && !conversation.displayName ? { displayName: event.displayName } : {}),
      ...(inbound && (!conversation.lastInboundAt || sentAt > conversation.lastInboundAt)
        ? { lastInboundAt: sentAt }
        : {}),
      ...(live && inbound ? { unreadCount: { increment: 1 } } : {}),
      // We answered, from wherever — nothing is waiting on us any more.
      ...(live && !inbound ? { unreadCount: 0 } : {}),
    },
  });

  if (conversation.leadId && live) {
    if (inbound) {
      // AWAITING_REPLY means "waiting on them" — and they just replied, so it
      // no longer holds. Any other sub-status is the team's call and stays.
      // Deliberately not `lastContactAt`: that is when WE last contacted them.
      await prisma.lead.updateMany({
        where: { id: conversation.leadId, subStatus: 'AWAITING_REPLY' },
        data: { subStatus: null },
      });
    } else if (event.origin !== 'AI') {
      // A person answered. An automatic reply does not count as contact — the
      // client must stay on the "nobody has spoken to them" list until one has.
      await prisma.lead.update({
        where: { id: conversation.leadId },
        data: { lastContactAt: sentAt },
      });
    }
  }

  return conversation.id;
}

/**
 * Instagram delivers a message with the sender's id and nothing else, so every
 * thread would read "Instagram user". Ask who it is, once, when the thread
 * starts. Best effort — a private account or a missing token leaves the
 * fallback name in place.
 */
async function nameInstagramSender(conversationId: string, userId: string): Promise<void> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(
      `https://graph.instagram.com/${process.env.META_GRAPH_VERSION || 'v26.0'}/${encodeURIComponent(userId)}?fields=name,username`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return;
    const profile = (await res.json()) as { name?: string; username?: string };
    const displayName = profile.name || (profile.username ? `@${profile.username}` : null);
    if (displayName) await prisma.conversation.update({ where: { id: conversationId }, data: { displayName } });
  } catch (err) {
    logger.warn('Instagram sender name not available', { error: (err as Error).message });
  }
}

/**
 * Find out what the advert was — campaign and ad name, not just the headline
 * the client saw — and, when it names a project, open an enquiry on it. Both
 * tell the team and the assistant what this person is asking about before
 * they have typed a word. Best effort, never awaited by the message itself.
 */
async function noteAd(
  conversationId: string,
  leadId: string | null,
  adId: string,
  headline: string | null,
  channel: Channel
): Promise<void> {
  try {
    const named = await describeAd(adId);
    const label = [named, headline].filter(Boolean).join(' — ').slice(0, 300) || null;
    if (label && label !== headline) {
      await prisma.conversation.update({ where: { id: conversationId }, data: { adLabel: label } });
      if (leadId) await prisma.lead.update({ where: { id: leadId }, data: { adLabel: label } });
    }
    if (leadId) await recordAdEnquiry(leadId, label, marketFor(channel === 'WHATSAPP' ? 'WHATSAPP' : 'META'));
  } catch (err) {
    logger.warn('Advert details not recorded', { adId, error: (err as Error).message });
  }
}

/** Attachments above this are left on the platform — nobody needs a 200 MB video in the CRM. */
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/aac': '.aac',
  'video/mp4': '.mp4', 'application/pdf': '.pdf',
};

/**
 * Where a chat attachment lives in the bucket — one folder per person, one per
 * month inside it, and a name that says what the file is without opening it:
 *
 *   chats/whatsapp/96171952211/2026-10/20261013-142507-in-image-3f9a1c2e.jpg
 *   chats/instagram/<user id>/2026-10/20261013-150211-out-audio-8b0d44aa.ogg
 */
function mediaKey(
  at: { channel: Channel; externalId: string; direction: 'IN' | 'OUT'; type: string; sentAt: Date },
  ext: string
): string {
  const stamp = at.sentAt.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const person = at.externalId.replace(/[^A-Za-z0-9]/g, '') || 'unknown';
  const kind = at.type.replace(/[^a-z]/gi, '').toLowerCase() || 'file';
  return [
    'chats',
    at.channel.toLowerCase(),
    person,
    at.sentAt.toISOString().slice(0, 7),
    `${stamp}-${at.direction.toLowerCase()}-${kind}-${randomUUID().slice(0, 8)}${ext}`,
  ].join('/');
}

/** Copy an attachment into our own storage before the platform's link expires. */
async function keepMedia(
  messageId: string,
  media: { url: string; mime?: string | null; filename?: string | null },
  at: { channel: Channel; externalId: string; direction: 'IN' | 'OUT'; type: string; sentAt: Date }
): Promise<void> {
  try {
    const url = new URL(media.url);
    if (url.protocol !== 'https:') return;
    // YCloud serves its own media links to the account that owns them.
    const headers: Record<string, string> =
      url.hostname.endsWith('ycloud.com') && process.env.YCLOUD_API_KEY
        ? { 'X-API-Key': process.env.YCLOUD_API_KEY }
        : {};
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get('content-length') ?? 0) > MAX_MEDIA_BYTES) return;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_MEDIA_BYTES) return;

    const mime = (media.mime || res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
    const ext =
      EXT_BY_MIME[mime] ?? (media.filename?.match(/\.[A-Za-z0-9]{1,5}$/)?.[0].toLowerCase() || '');
    const { url: mediaUrl } = await uploadFileAtKey(buffer, mediaKey(at, ext), mime);
    await prisma.chatMessage.update({ where: { id: messageId }, data: { mediaUrl } });
  } catch (err) {
    logger.warn('Chat attachment not stored', { messageId, error: (err as Error).message });
  }
}

/** A new client from an ad-driven first message. */
async function createLeadFromChat(event: ChatEvent, externalId: string): Promise<any> {
  const isWhatsApp = event.channel === 'WHATSAPP';
  const lead = await prisma.lead.create({
    data: {
      market: marketFor(isWhatsApp ? 'WHATSAPP' : 'META'),
      type: 'BUYER',
      status: 'ACTIVE',
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
  // The first stage of the funnel, as Meta counts it.
  void reportLeadStage(lead.id);
  return lead;
}

/** Delivery receipts for messages we sent. Unknown ids are ignored. */
export async function recordMessageStatus(
  messageIds: Array<string | null | undefined>,
  status: string
): Promise<void> {
  const ids = messageIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  await prisma.chatMessage.updateMany({ where: { externalId: { in: ids } }, data: { status } });
}

/**
 * Make a thread's sender a client, or attach the thread to an existing one.
 * This is the "a person decided" step for senders who did not arrive from an ad.
 */
export async function linkConversationToLead(
  conversationId: string,
  options: { leadId?: string | null; name?: string | null; createdBy?: string | null }
): Promise<any> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return null;

  const isWhatsApp = conversation.channel === 'WHATSAPP';
  const identity = isWhatsApp ? { waId: conversation.externalId } : { igId: conversation.externalId };

  let lead: any;
  if (options.leadId) {
    lead = await prisma.lead.findUnique({ where: { id: options.leadId } });
    if (!lead) return null;
    // Only remember the identity when nobody else holds it — it is unique.
    const taken = await prisma.lead.findFirst({ where: identity, select: { id: true } });
    if (!taken) await prisma.lead.update({ where: { id: lead.id }, data: identity });
  } else {
    lead =
      (await prisma.lead.findFirst({ where: identity })) ??
      (await prisma.lead.create({
        data: {
          market: marketFor(isWhatsApp ? 'WHATSAPP' : 'META'),
          type: 'BUYER',
          status: 'ACTIVE',
          source: isWhatsApp ? 'WHATSAPP' : 'MANUAL',
          name:
            options.name?.trim() ||
            conversation.displayName ||
            (isWhatsApp ? `WhatsApp +${conversation.externalId}` : 'Instagram contact'),
          phone: isWhatsApp ? `+${conversation.externalId}` : null,
          whatsapp: isWhatsApp ? `+${conversation.externalId}` : null,
          ...identity,
          adId: conversation.adId,
          adLabel: conversation.adLabel,
          createdBy: options.createdBy ?? null,
        },
      }));
  }

  await prisma.conversation.update({ where: { id: conversation.id }, data: { leadId: lead.id } });
  return lead;
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
    // They came back to us, so we are no longer "waiting on them".
    await prisma.lead.updateMany({
      where: { id: existing.id, subStatus: 'AWAITING_REPLY' },
      data: { subStatus: null },
    });
    return { lead: existing, created: false };
  }

  const lead = await prisma.lead.create({
    data: {
      market: marketFor('META'),
      type: 'BUYER',
      status: 'ACTIVE',
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
  // A form on an ad that names a project is an enquiry about that project.
  void recordAdEnquiry(lead.id, input.formName, marketFor('META'));
  // The first stage of the funnel, as Meta counts it.
  void reportLeadStage(lead.id);
  return { lead, created: true };
}
