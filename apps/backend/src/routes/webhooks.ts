import express, { type Request, type Response, type Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  recordChatMessage,
  recordMessageStatus,
  upsertLeadFromForm,
  type AdReferral,
} from '../services/messaging-intake.service.js';
import { scheduleAutoReply } from '../services/auto-reply.service.js';

/**
 * Meta webhooks — WhatsApp, Instagram messaging and Facebook Lead Ads.
 *
 * All three products deliver to one callback on the Meta app, distinguished by
 * the payload's `object` field, so one endpoint handles them.
 *
 * Two rules govern everything here:
 *
 * 1. Verify the sender before trusting a byte. The URL is public and anything
 *    that can POST to it could otherwise fabricate clients.
 * 2. Store first, then acknowledge. A 200 tells the sender to forget the
 *    message, so it is only given once the message is in the database; a
 *    failure answers 500 and the sender retries. That is safe because every
 *    message is keyed on the platform's own id — a retry of something already
 *    stored is a no-op. Slow work (attachments, auto-reply) is not awaited.
 *
 * Setup (Meta App → each use case → Webhooks):
 *   Callback URL : https://<backend>/api/webhooks/meta
 *   Verify token : META_VERIFY_TOKEN
 *   Subscribe to : messages (WhatsApp, Instagram), leadgen (Page)
 *
 * The real WhatsApp number runs in coexistence (phone app + API on one number),
 * which Meta only allows through a partner — here YCloud. YCloud delivers its
 * own event format, signed with its own secret, to
 *   https://<backend>/api/webhooks/ycloud
 * Subscribe that endpoint (YCloud Console → Developers → Webhook) to:
 *   whatsapp.inbound_message.received, whatsapp.smb.message.echoes,
 *   whatsapp.smb.history, whatsapp.message.updated
 *
 * Env:
 *   META_APP_SECRET         — signs every Meta delivery (App settings → Basic)
 *   INSTAGRAM_APP_SECRET    — Instagram deliveries are signed with the Instagram
 *                             app's own secret when it differs
 *   META_VERIFY_TOKEN       — any random string; must match what you type in Meta
 *   META_ACCESS_TOKEN       — system-user token, needed to read Lead Ads answers
 *   YCLOUD_WEBHOOK_SECRET   — signing secret YCloud shows when the endpoint is created
 *
 * Without these the endpoints stay live but reject everything, so a half-set-up
 * integration fails loudly at the door instead of quietly inventing clients.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const router: Router = express.Router();

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';

/** Raw body captured by the JSON parser — signatures cover bytes, not objects. */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/** Constant-time string comparison. A plain `===` leaks the secret a byte at a time. */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Check Meta's `X-Hub-Signature-256` header against every secret we hold. */
function signatureValid(req: RawBodyRequest): boolean {
  const header = req.get('x-hub-signature-256');
  if (!header || !req.rawBody) return false;
  const secrets = [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter(
    (s): s is string => Boolean(s)
  );
  return secrets.some((secret) =>
    safeEqual(
      header,
      'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody as Buffer).digest('hex')
    )
  );
}

/** Process, then acknowledge — a failure asks the sender to deliver again. */
async function acceptAndProcess(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    if (body.object === 'whatsapp_business_account') await handleWhatsApp(body);
    else if (body.object === 'instagram') await handleInstagram(body);
    else if (body.object === 'page') await handleLeadgen(body);
    else logger.info('Meta webhook ignored', { object: body.object });
    res.sendStatus(200);
  } catch (err) {
    logger.error('Meta webhook processing failed', { error: (err as Error).message });
    res.sendStatus(500);
  }
}

// ── GET — Meta's subscription handshake ───────────────────────────────────────

router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.META_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && typeof token === 'string' && safeEqual(token, expected)) {
    logger.info('Meta webhook verified');
    res.status(200).type('text/plain').send(String(challenge ?? ''));
    return;
  }
  logger.warn('Meta webhook verification rejected');
  res.sendStatus(403);
});

// ── POST /meta — deliveries straight from Meta, HMAC-signed ───────────────────

router.post(
  '/meta',
  asyncHandler(async (req: Request, res: Response) => {
    if (!process.env.META_APP_SECRET && !process.env.INSTAGRAM_APP_SECRET) {
      logger.warn('Meta webhook hit but no app secret is configured');
      res.sendStatus(503);
      return;
    }
    if (!signatureValid(req as RawBodyRequest)) {
      logger.warn('Meta webhook rejected: bad signature');
      res.sendStatus(401);
      return;
    }
    await acceptAndProcess(req, res);
  })
);

// ── POST /ycloud — the coexistence number, relayed by YCloud ─────────────────

/**
 * Check YCloud's `YCloud-Signature: t=<unix seconds>,s=<hex>` header: HMAC-SHA256
 * over "<t>." + the raw body. The timestamp window is wide on purpose: YCloud
 * retries a failed delivery for hours, and a replayed message is harmless
 * because it is already stored under its own id.
 */
function ycloudSignatureValid(req: RawBodyRequest): boolean {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET;
  const header = req.get('ycloud-signature');
  if (!secret || !header || !req.rawBody) return false;

  const fields = header.split(',').map((part) => part.trim().split('='));
  const timestamp = fields.find(([key]) => key === 't')?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 3 * 24 * 60 * 60) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.')
    .update(req.rawBody)
    .digest('hex');
  return fields.some(([key, value]) => key === 's' && typeof value === 'string' && safeEqual(value.toLowerCase(), expected));
}

router.post(
  '/ycloud',
  asyncHandler(async (req: Request, res: Response) => {
    if (!process.env.YCLOUD_WEBHOOK_SECRET) {
      logger.warn('YCloud webhook hit but YCLOUD_WEBHOOK_SECRET is unset');
      res.sendStatus(503);
      return;
    }
    if (!ycloudSignatureValid(req as RawBodyRequest)) {
      logger.warn('YCloud webhook rejected: bad signature');
      res.sendStatus(401);
      return;
    }

    try {
      await handleYCloud(req.body ?? {});
      res.sendStatus(200);
    } catch (err) {
      logger.error('YCloud webhook processing failed', { error: (err as Error).message });
      res.sendStatus(500);
    }
  })
);

/** The download link YCloud attaches to an image, voice note, video or document. */
function ycloudMedia(m: any): { url: string; mime?: string; filename?: string } | null {
  const part = m?.[m?.type];
  return typeof part?.link === 'string' && part.link
    ? { url: part.link, mime: part.mime_type, filename: part.filename }
    : null;
}

/**
 * YCloud events for the coexistence number.
 *
 * `whatsappInboundMessage` is always something the customer sent;
 * `whatsappMessage` is always something we sent. `smb.message.echoes` is a
 * message typed in the WhatsApp Business app on the phone, and `smb.history`
 * replays up to 180 days of past chat when the number is first connected.
 */
async function handleYCloud(event: any): Promise<void> {
  const type: string = event.type ?? '';
  const history = type === 'whatsapp.smb.history';

  if (type === 'whatsapp.message.updated') {
    const m = event.whatsappMessage;
    if (m?.status) await recordMessageStatus([m.wamid, m.id], m.status);
    return;
  }

  if (type === 'whatsapp.inbound_message.received' || (history && event.whatsappInboundMessage)) {
    const m = event.whatsappInboundMessage;
    // Group chats are not mirrored — a thread here is one person.
    if (!m?.from || m.groupId) return;
    const conversationId = await recordChatMessage({
      channel: 'WHATSAPP',
      externalId: m.from,
      displayName: m.customerProfile?.name ?? null,
      messageId: m.wamid ?? m.id,
      direction: 'IN',
      type: m.type ?? 'text',
      body: whatsAppText(m),
      mediaId: m[m.type]?.id ?? null,
      media: ycloudMedia(m),
      sentAt: m.sendTime ? new Date(m.sendTime) : undefined,
      referral: whatsAppReferral(m),
      history,
    });
    if (conversationId && !history) scheduleAutoReply(conversationId);
    return;
  }

  if (
    type === 'whatsapp.smb.message.echoes' ||
    type === 'whatsapp.smb.message.created' ||
    (history && event.whatsappMessage)
  ) {
    const m = event.whatsappMessage;
    if (!m?.to || m.groupId) return;
    await recordChatMessage({
      channel: 'WHATSAPP',
      externalId: m.to,
      displayName: m.customerProfile?.name ?? null,
      messageId: m.wamid ?? m.id,
      altMessageId: m.id,
      direction: 'OUT',
      type: m.type ?? 'text',
      body: whatsAppText(m),
      mediaId: m[m.type]?.id ?? null,
      media: ycloudMedia(m),
      origin: 'PHONE',
      sentAt: m.sendTime ? new Date(m.sendTime) : undefined,
      history,
    });
    return;
  }

  logger.info('YCloud webhook ignored', { type });
}

/** Something readable for any message type — an image of a floor plan is still a message. */
function whatsAppText(msg: any): string {
  // WhatsApp tells us a message exists but will not hand it over — most often
  // a view-once voice note or photo, sometimes a type the API does not carry.
  // The reason it gives is kept, because "[unsupported]" explains nothing.
  if (msg.type === 'unsupported' || msg.type === 'unknown') {
    const why = msg.errors?.[0];
    const detail = why?.error_data?.details ?? why?.message ?? why?.title;
    logger.warn('WhatsApp message not passed on', { from: msg.from, code: why?.code, detail });
    return `Not received: WhatsApp did not pass this message on${detail ? ` (${detail})` : ''}. It is visible on the phone.`;
  }
  if (msg.type === 'reaction') return `Reacted ${msg.reaction?.emoji ?? ''}`.trim();
  if (msg.type === 'location' && msg.location) {
    const { name, address, latitude, longitude } = msg.location;
    return `Location: ${[name, address].filter(Boolean).join(', ') || `${latitude}, ${longitude}`}`;
  }
  if (msg.type === 'contacts' && Array.isArray(msg.contacts)) {
    const names = msg.contacts.map((c: any) => c.name?.formatted_name).filter(Boolean);
    return `Contact card: ${names.join(', ') || 'shared contact'}`;
  }
  return (
    msg.text?.body ??
    msg.button?.text ??
    msg.interactive?.list_reply?.title ??
    msg.interactive?.button_reply?.title ??
    msg[msg.type]?.caption ??
    `[${msg.type ?? 'message'}]`
  );
}

function whatsAppReferral(msg: any): AdReferral | null {
  const r = msg.referral;
  if (!r?.source_id) return null;
  // Headline AND the ad's main text: a project named in either is enough to
  // know what the client is asking about.
  const label = [r.headline, r.body].filter(Boolean).join(' — ').slice(0, 300);
  return { adId: String(r.source_id), label: label || null };
}

function seconds(ts: unknown): Date | undefined {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : undefined;
}

/**
 * WhatsApp.
 *
 * `messages[]` is what a customer sent. `message_echoes[]` is what WE sent from
 * the WhatsApp Business app on the phone — delivered when the number runs in
 * coexistence — and is what keeps the CRM thread identical to the phone's.
 * `statuses[]` are delivery receipts.
 */
async function handleWhatsApp(body: any): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      const profileByWaId = new Map<string, string>(
        (value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name])
      );

      for (const msg of value.messages ?? []) {
        if (!msg.from || !msg.id) continue;
        const conversationId = await recordChatMessage({
          channel: 'WHATSAPP',
          externalId: msg.from,
          displayName: profileByWaId.get(msg.from) ?? null,
          messageId: msg.id,
          direction: 'IN',
          type: msg.type ?? 'text',
          body: whatsAppText(msg),
          mediaId: msg[msg.type]?.id ?? null,
          sentAt: seconds(msg.timestamp),
          referral: whatsAppReferral(msg),
        });
        if (conversationId) scheduleAutoReply(conversationId);
      }

      for (const msg of value.message_echoes ?? []) {
        if (!msg.to || !msg.id) continue;
        await recordChatMessage({
          channel: 'WHATSAPP',
          externalId: msg.to,
          messageId: msg.id,
          direction: 'OUT',
          type: msg.type ?? 'text',
          body: whatsAppText(msg),
          mediaId: msg[msg.type]?.id ?? null,
          origin: 'PHONE',
          sentAt: seconds(msg.timestamp),
        });
      }

      for (const status of value.statuses ?? []) {
        if (status.id && status.status) await recordMessageStatus([status.id], status.status);
      }
    }
  }
}

/**
 * Instagram direct messages.
 *
 * `is_echo` marks a message sent FROM the business account (typed in the
 * Instagram app), in which case the customer is the recipient, not the sender.
 */
async function handleInstagram(body: any): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const message = event.message;
      if (!message?.mid || message.is_deleted) continue;

      const echo = Boolean(message.is_echo);
      const customerId = echo ? event.recipient?.id : event.sender?.id;
      if (!customerId) continue;

      const attachment = message.attachments?.[0];
      const ad = event.referral ?? message.referral;

      const conversationId = await recordChatMessage({
        channel: 'INSTAGRAM',
        externalId: String(customerId),
        messageId: message.mid,
        direction: echo ? 'OUT' : 'IN',
        type: attachment?.type ?? 'text',
        body: message.text ?? `[${attachment?.type ?? 'message'}]`,
        media: typeof attachment?.payload?.url === 'string' ? { url: attachment.payload.url } : null,
        origin: echo ? 'PHONE' : null,
        sentAt: event.timestamp ? new Date(Number(event.timestamp)) : undefined,
        referral: ad?.ad_id ? { adId: String(ad.ad_id), label: ad.ads_context_data?.ad_title ?? null } : null,
      });
      if (conversationId && !echo) scheduleAutoReply(conversationId);
    }
  }
}

/**
 * Facebook Lead Ads.
 *
 * The webhook only carries a `leadgen_id`; the answers have to be fetched from
 * the Graph API. Without a token we still create the client from the id alone
 * so the lead isn't lost.
 */
async function handleLeadgen(body: any): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      const { fields, label } = await fetchLead(String(leadgenId));
      const { lead, created } = await upsertLeadFromForm({
        leadgenId: String(leadgenId),
        adId: change.value?.ad_id ? String(change.value.ad_id) : null,
        formName: label,
        fields,
      });
      logger.info('Lead Ads submission handled', { leadId: lead.id, newClient: created });
    }
  }
}

/**
 * Pull the submitted answers for a leadgen id, plus the ad or campaign name the
 * team will recognise it by. Empty when unavailable.
 */
async function fetchLead(leadgenId: string): Promise<{ fields: Record<string, string>; label: string | null }> {
  const empty = { fields: {}, label: null };
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    logger.warn('META_ACCESS_TOKEN unset — storing the Lead Ads id without its answers');
    return empty;
  }
  try {
    // Token in a header, never the query string — URLs end up in access logs.
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(leadgenId)}?fields=field_data,ad_name,campaign_name`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) {
      logger.error('Lead Ads fetch failed', { status: res.status });
      return empty;
    }
    const json = (await res.json()) as {
      field_data?: Array<{ name: string; values: string[] }>;
      ad_name?: string;
      campaign_name?: string;
    };
    const fields: Record<string, string> = {};
    for (const f of json.field_data ?? []) {
      if (f.values?.[0]) fields[f.name] = f.values[0];
    }
    return { fields, label: json.ad_name ?? json.campaign_name ?? null };
  } catch (err) {
    logger.error('Lead Ads fetch threw', { error: (err as Error).message });
    return empty;
  }
}

export default router;
