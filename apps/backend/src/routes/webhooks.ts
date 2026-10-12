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
 * 2. Answer 200 immediately. Meta retries with escalating frequency when a
 *    webhook is slow or errors, so processing failures must not become
 *    delivery failures — we log them and still acknowledge.
 *
 * Setup (Meta App → each use case → Webhooks):
 *   Callback URL : https://<backend>/api/webhooks/meta
 *   Verify token : META_VERIFY_TOKEN
 *   Subscribe to : messages (WhatsApp, Instagram), leadgen (Page)
 *
 * A WhatsApp provider (needed for app + API coexistence on one number) relays
 * the same payloads but does not sign them with our app secret. Point it at
 *   https://<backend>/api/webhooks/whatsapp
 * with the header `X-Webhook-Secret: WHATSAPP_WEBHOOK_SECRET`.
 *
 * Env:
 *   META_APP_SECRET         — signs every Meta delivery (App settings → Basic)
 *   INSTAGRAM_APP_SECRET    — Instagram deliveries are signed with the Instagram
 *                             app's own secret when it differs
 *   META_VERIFY_TOKEN       — any random string; must match what you type in Meta
 *   META_ACCESS_TOKEN       — system-user token, needed to read Lead Ads answers
 *   WHATSAPP_WEBHOOK_SECRET — shared secret for the provider relay
 *
 * Without these the endpoints stay live but reject everything, so a half-set-up
 * integration fails loudly at the door instead of quietly inventing clients.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const router: Router = express.Router();

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

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

/**
 * Acknowledge, then process. Everything after the 200 is best-effort; a thrown
 * error must not turn into a retry storm.
 */
async function acceptAndProcess(req: Request, res: Response): Promise<void> {
  res.sendStatus(200);
  try {
    const body = req.body ?? {};
    if (body.object === 'whatsapp_business_account') await handleWhatsApp(body);
    else if (body.object === 'instagram') await handleInstagram(body);
    else if (body.object === 'page') await handleLeadgen(body);
    else logger.info('Meta webhook ignored', { object: body.object });
  } catch (err) {
    logger.error('Meta webhook processing failed', { error: (err as Error).message });
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

// ── POST /whatsapp — the same payloads relayed by a WhatsApp provider ─────────

router.post(
  '/whatsapp',
  asyncHandler(async (req: Request, res: Response) => {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) {
      logger.warn('WhatsApp provider webhook hit but WHATSAPP_WEBHOOK_SECRET is unset');
      res.sendStatus(503);
      return;
    }
    const given = req.get('x-webhook-secret') ?? '';
    if (!safeEqual(given, expected)) {
      logger.warn('WhatsApp provider webhook rejected: bad secret');
      res.sendStatus(401);
      return;
    }
    // Providers omit the `object` field on some deliveries; this route only
    // ever carries WhatsApp.
    if (req.body && !req.body.object) req.body.object = 'whatsapp_business_account';
    await acceptAndProcess(req, res);
  })
);

/** Something readable for any message type — an image of a floor plan is still a message. */
function whatsAppText(msg: any): string {
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
  return { adId: String(r.source_id), label: r.headline ?? r.body ?? null };
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
        await recordChatMessage({
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
        if (status.id && status.status) await recordMessageStatus(status.id, status.status);
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

      await recordChatMessage({
        channel: 'INSTAGRAM',
        externalId: String(customerId),
        messageId: message.mid,
        direction: echo ? 'OUT' : 'IN',
        type: attachment?.type ?? 'text',
        body: message.text ?? `[${attachment?.type ?? 'message'}]`,
        origin: echo ? 'PHONE' : null,
        sentAt: event.timestamp ? new Date(Number(event.timestamp)) : undefined,
        referral: ad?.ad_id ? { adId: String(ad.ad_id), label: ad.ads_context_data?.ad_title ?? null } : null,
      });
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

      const fields = await fetchLeadFields(String(leadgenId));
      const { lead, created } = await upsertLeadFromForm({
        leadgenId: String(leadgenId),
        adId: change.value?.ad_id ? String(change.value.ad_id) : null,
        formName: change.value?.form_id ? `Form ${change.value.form_id}` : null,
        fields,
      });
      logger.info('Lead Ads submission handled', { leadId: lead.id, newClient: created });
    }
  }
}

/** Pull the submitted answers for a leadgen id. Returns {} when unavailable. */
async function fetchLeadFields(leadgenId: string): Promise<Record<string, string>> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    logger.warn('META_ACCESS_TOKEN unset — storing the Lead Ads id without its answers');
    return {};
  }
  try {
    // Token in a header, never the query string — URLs end up in access logs.
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(leadgenId)}?fields=field_data`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) {
      logger.error('Lead Ads fetch failed', { status: res.status });
      return {};
    }
    const json = (await res.json()) as { field_data?: Array<{ name: string; values: string[] }> };
    const out: Record<string, string> = {};
    for (const f of json.field_data ?? []) {
      if (f.values?.[0]) out[f.name] = f.values[0];
    }
    return out;
  } catch (err) {
    logger.error('Lead Ads fetch threw', { error: (err as Error).message });
    return {};
  }
}

export default router;
