import { prisma } from '@propgroup/db';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { recordChatMessage } from './messaging-intake.service.js';

/**
 * Sending a reply on a mirrored thread.
 *
 * WhatsApp goes out through YCloud, because the number runs in coexistence and
 * only the partner can send on it. Instagram goes straight to Meta.
 *
 * Env:
 *   YCLOUD_API_KEY         — YCloud Console → Developers → API Keys
 *   YCLOUD_WHATSAPP_FROM   — the business number, E.164 ("+9617…")
 *   INSTAGRAM_ACCESS_TOKEN — the Instagram account token from the Meta app
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

/** Meta only accepts a free-form reply within 24h of the customer's last message. */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReplyOrigin = 'CRM' | 'AI';

export function canSendOn(channel: 'WHATSAPP' | 'INSTAGRAM'): boolean {
  return channel === 'WHATSAPP'
    ? Boolean(process.env.YCLOUD_API_KEY && process.env.YCLOUD_WHATSAPP_FROM)
    : Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
}

export function replyWindowOpen(lastInboundAt: Date | null): boolean {
  return Boolean(lastInboundAt && Date.now() - lastInboundAt.getTime() < REPLY_WINDOW_MS);
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = json?.error?.message ?? json?.message ?? `HTTP ${res.status}`;
    logger.error('Chat send failed', { url: new URL(url).host, status: res.status, reason });
    throw new AppError(`The message was not sent: ${reason}`, 502);
  }
  return json;
}

/** Returns the platform ids the sent message may later be echoed under. */
async function sendWhatsApp(to: string, text: string): Promise<{ id: string; altId?: string }> {
  const json = await postJson(
    'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
    { 'X-API-Key': process.env.YCLOUD_API_KEY as string },
    { from: process.env.YCLOUD_WHATSAPP_FROM, to: `+${to}`, type: 'text', text: { body: text } }
  );
  const id = json.wamid ?? json.id;
  if (!id) throw new AppError('The message was sent but YCloud returned no id', 502);
  return { id, altId: json.wamid && json.id ? json.id : undefined };
}

async function sendInstagram(to: string, text: string): Promise<{ id: string; altId?: string }> {
  const json = await postJson(
    `https://graph.instagram.com/${GRAPH_VERSION}/me/messages`,
    { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}` },
    { recipient: { id: to }, message: { text } }
  );
  if (!json.message_id) throw new AppError('The message was sent but Instagram returned no id', 502);
  return { id: json.message_id };
}

/** Send `text` on a thread and store it, so the CRM shows it without waiting for the echo. */
export async function sendReply(conversationId: string, text: string, origin: ReplyOrigin): Promise<void> {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new AppError('Conversation not found', 404);

  if (!canSendOn(conversation.channel)) {
    throw new AppError(`Sending on ${conversation.channel} is not configured yet`, 503);
  }
  if (!replyWindowOpen(conversation.lastInboundAt)) {
    throw new AppError(
      'The 24-hour reply window has closed. Reply from the phone app, or wait for the client to write again.',
      409
    );
  }

  const body = text.trim().slice(0, 4000);
  if (!body) throw new AppError('Empty message', 400);

  const sent =
    conversation.channel === 'WHATSAPP'
      ? await sendWhatsApp(conversation.externalId, body)
      : await sendInstagram(conversation.externalId, body);

  await recordChatMessage({
    channel: conversation.channel,
    externalId: conversation.externalId,
    messageId: sent.id,
    altMessageId: sent.altId,
    direction: 'OUT',
    type: 'text',
    body,
    origin,
  });
  // Instagram echoes our own message back, sometimes before the line above
  // runs — it is then already stored as typed on the phone. Say where it
  // really came from, or an automatic reply would read as a person's.
  await prisma.chatMessage.updateMany({
    where: { externalId: { in: [sent.id, sent.altId].filter((id): id is string => Boolean(id)) } },
    data: { origin },
  });
}
