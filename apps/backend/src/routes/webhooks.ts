import express, { type Request, type Response, type Router } from 'express';
import crypto from 'node:crypto';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { upsertInboundLead, logInboundMessage, findLeadByWhatsApp, isBlockedSender, queueInbound } from '../services/lead-intake.service.js';

/**
 * Meta webhooks — WhatsApp Business and Facebook Lead Ads.
 *
 * Both products deliver to a single webhook on the Meta app, distinguished by
 * the payload's `object` field, so one endpoint handles both.
 *
 * Two rules govern everything here:
 *
 * 1. Verify the signature before trusting a byte. The URL is public and
 *    anything that can POST to it could otherwise fabricate clients.
 * 2. Answer 200 immediately. Meta retries with escalating frequency when a
 *    webhook is slow or errors, so processing failures must not become
 *    delivery failures — we log them and still acknowledge.
 *
 * Setup (Meta App → Webhooks):
 *   Callback URL : https://<backend>/api/webhooks/meta
 *   Verify token : META_VERIFY_TOKEN
 *   Subscribe to : messages (WhatsApp), leadgen (Lead Ads)
 *
 * Env:
 *   META_APP_SECRET      — signs every delivery (App Dashboard → Settings → Basic)
 *   META_VERIFY_TOKEN    — any random string; must match what you type in Meta
 *   META_PAGE_TOKEN      — page access token, needed to read Lead Ads answers
 *
 * Without these the endpoints stay live but reject everything, so a half-set-up
 * integration fails loudly at the door instead of quietly inventing clients.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const router: Router = express.Router();

/** Raw body captured by the JSON parser — signatures cover bytes, not objects. */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

function isConfigured(): boolean {
  return Boolean(process.env.META_APP_SECRET && process.env.META_VERIFY_TOKEN);
}

/**
 * Constant-time check of Meta's `X-Hub-Signature-256` header.
 * A plain `===` here would leak the expected digest a byte at a time.
 */
function signatureValid(req: RawBodyRequest): boolean {
  const secret = process.env.META_APP_SECRET;
  const header = req.get('x-hub-signature-256');
  if (!secret || !header || !req.rawBody) return false;

  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── GET /api/webhooks/meta — Meta's subscription handshake ────────────────────

router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.META_VERIFY_TOKEN) {
    logger.info('Meta webhook verified');
    res.status(200).send(String(challenge));
    return;
  }
  logger.warn('Meta webhook verification rejected');
  res.sendStatus(403);
});

// ── POST /api/webhooks/meta — inbound messages and lead submissions ───────────

router.post(
  '/meta',
  asyncHandler(async (req: Request, res: Response) => {
    if (!isConfigured()) {
      logger.warn('Meta webhook hit but META_APP_SECRET / META_VERIFY_TOKEN are unset');
      res.sendStatus(503);
      return;
    }
    if (!signatureValid(req as RawBodyRequest)) {
      logger.warn('Meta webhook rejected: bad signature');
      res.sendStatus(401);
      return;
    }

    // Acknowledge first. Everything below is best-effort; a thrown error must
    // not turn into a retry storm.
    res.sendStatus(200);

    try {
      const body = req.body ?? {};
      if (body.object === 'whatsapp_business_account') await handleWhatsApp(body);
      else if (body.object === 'page') await handleLeadgen(body);
      else logger.info('Meta webhook ignored', { object: body.object });
    } catch (err) {
      logger.error('Meta webhook processing failed', { error: (err as Error).message });
    }
  })
);

/**
 * Inbound WhatsApp messages.
 *
 * `contacts[]` carries the sender's profile name, `messages[]` the text. Status
 * callbacks (delivered/read) arrive on the same topic with no `messages` array
 * and are skipped — they'd otherwise log an empty note per delivery receipt.
 */
async function handleWhatsApp(body: any): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const messages = value.messages ?? [];
      if (messages.length === 0) continue;

      const profileByWaId = new Map<string, string>(
        (value.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name])
      );

      for (const msg of messages) {
        const waId: string = msg.from;
        // Non-text messages still matter — an image of a floor plan is a real
        // message — so record something useful rather than dropping them.
        const text: string =
          msg.text?.body ??
          msg.button?.text ??
          msg.interactive?.list_reply?.title ??
          msg.interactive?.button_reply?.title ??
          `[${msg.type ?? 'message'}]`;

        // Muted numbers are dropped on the floor — no client, no inbox entry.
        if (await isBlockedSender(waId)) continue;

        // A number we already know goes straight onto that client's timeline.
        const known = await findLeadByWhatsApp(waId);
        if (known) {
          await logInboundMessage(known.id, text);
          logger.info('WhatsApp message logged on existing client', { leadId: known.id });
          continue;
        }

        // Everyone else waits in the inbox for a person to decide. This is the
        // difference between a CRM and a copy of your phone's message list.
        await queueInbound(waId, text, profileByWaId.get(waId));
      }
    }
  }
}

/**
 * Facebook Lead Ads.
 *
 * The webhook only carries a `leadgen_id`; the answers have to be fetched from
 * the Graph API with a page token. Without META_PAGE_TOKEN we still create the
 * client from the id alone so the lead isn't lost — the team can call the
 * number once it's filled in.
 */
async function handleLeadgen(body: any): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue;
      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      const fields = await fetchLeadFields(leadgenId);
      const { lead, created } = await upsertInboundLead({
        externalLeadId: String(leadgenId),
        name: fields.full_name ?? fields.first_name ?? null,
        phone: fields.phone_number ?? null,
        email: fields.email ?? null,
        askingFor: fields.what_are_you_looking_for ?? fields.property_type ?? null,
        message: Object.entries(fields)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
          .join('\n') || null,
        source: 'FACEBOOK_AD',
      });
      if (created && fields.what_are_you_looking_for) {
        await logInboundMessage(lead.id, `Facebook ad: ${fields.what_are_you_looking_for}`, 'NOTE');
      }
      logger.info('Lead Ads submission handled', { leadId: lead.id, newClient: created });
    }
  }
}

/** Pull the submitted answers for a leadgen id. Returns {} when unavailable. */
async function fetchLeadFields(leadgenId: string): Promise<Record<string, string>> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token) {
    logger.warn('META_PAGE_TOKEN unset — storing the Lead Ads id without its answers');
    return {};
  }
  try {
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
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
