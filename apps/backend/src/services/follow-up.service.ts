import { prisma } from '@propgroup/db';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getChatAiSettings, type FollowUpSettings } from './ai-settings.service.js';
import { canSendOn, sendTemplate } from './messaging-send.service.js';
import { PAUSED_BY_TEAM } from './auto-reply.service.js';

/**
 * The follow-up: one short WhatsApp template to a client who went quiet.
 *
 * Once a client has not written for 24 hours, WhatsApp refuses any message
 * that is not a pre-approved template — from the team or the assistant. A
 * client who stops answering is then lost unless someone remembers to pick up
 * the phone. This sends them one friendly nudge after `afterDays` of silence;
 * if they answer, the 24-hour window is open again and the assistant carries on.
 *
 * Every template is billed by Meta, so it is careful:
 *   - off until switched on in Chat assistant settings, with an approved template
 *   - WhatsApp clients only (a thread that is not a client is a supplier or a wrong number)
 *   - once per silence: never again until the client has written since
 *   - only silences that began `afterDays` to `afterDays + 7` days ago, so
 *     switching it on does not ping everyone imported from six months of history
 *   - never to a closed, lost or parked client, a chat the team switched the
 *     assistant off on, or someone who asked us to stop
 *   - business hours in Beirut, and at most `dailyLimit` a day
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Asked us to stop, in the ways clients here say it. */
const OPTED_OUT = /^\s*(stop|unsubscribe|no thanks|not interested|ma badd?(e|i)|la2 shukran|توقف|لا شكرا|مش مهتم)/i;

/** "Hi {{1}}" → "Hi Rami" — what the client sees, for the thread. */
function render(settings: FollowUpSettings, name: string): string {
  return settings.text.replace(/\{\{\s*1\s*\}\}/g, name);
}

/** A first name WhatsApp will accept as the {{1}} value (it refuses an empty one). */
function firstName(lead: { name: string | null } | null, displayName: string | null): string {
  const raw = (lead?.name || displayName || '').trim().split(/\s+/)[0] ?? '';
  // A phone number or an emoji is not a name.
  return /\p{L}/u.test(raw) ? raw.slice(0, 40) : 'there';
}

/**
 * Send the follow-up on one thread now. `manual` is a person pressing the
 * button: they may send it inside the silence window or before switching
 * automatic follow-ups on, but never without a template.
 */
export async function sendFollowUp(conversationId: string, manual: boolean): Promise<void> {
  const { followUp } = await getChatAiSettings();
  if (!followUp.templateName) {
    throw new AppError('No follow-up template is set up yet — add it in Chat assistant settings.', 409);
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: { select: { name: true } } },
  });
  if (!conversation) throw new AppError('Conversation not found', 404);

  const name = firstName(conversation.lead, conversation.displayName);
  await sendTemplate(
    conversationId,
    { name: followUp.templateName, language: followUp.language, params: followUp.useName ? [name] : [] },
    render(followUp, name),
    // Stored as the assistant's, so that when the client answers, the
    // assistant picks it up rather than stepping aside for "a team reply".
    'AI'
  );
  await prisma.conversation.update({ where: { id: conversationId }, data: { followUpSentAt: new Date() } });
  logger.info('Follow-up sent', { conversation: conversationId, template: followUp.templateName, manual });
}

/** What the inbox needs to offer the button: whether it can be sent, and when it last was. */
export async function followUpInfo(conversation: { channel: string; followUpSentAt: Date | null }) {
  const { followUp } = await getChatAiSettings();
  return {
    available: conversation.channel === 'WHATSAPP' && Boolean(followUp.templateName) && canSendOn('WHATSAPP'),
    preview: followUp.text,
    lastSentAt: conversation.followUpSentAt,
  };
}

/** The hour of the day in Beirut, whatever timezone the server runs in. */
function beirutHour(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
}

async function sweep(): Promise<void> {
  const { followUp } = await getChatAiSettings();
  if (!followUp.enabled || !followUp.templateName || !canSendOn('WHATSAPP')) return;
  const hour = beirutHour();
  if (hour < 10 || hour >= 19) return;

  const now = Date.now();
  const sentToday = await prisma.conversation.count({ where: { followUpSentAt: { gte: new Date(now - DAY_MS) } } });
  let room = followUp.dailyLimit - sentToday;
  if (room <= 0) return;

  const candidates = await prisma.conversation.findMany({
    where: {
      channel: 'WHATSAPP',
      archivedAt: null,
      leadId: { not: null },
      lastInboundAt: { not: null },
      lastMessageAt: {
        lte: new Date(now - followUp.afterDays * DAY_MS),
        gte: new Date(now - (followUp.afterDays + 7) * DAY_MS),
      },
      lead: { status: { notIn: ['WON', 'LOST', 'ARCHIVED'] } },
      NOT: { aiPaused: true, aiPausedReason: PAUSED_BY_TEAM },
    },
    select: { id: true, lastInboundAt: true, followUpSentAt: true },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
  });

  for (const c of candidates) {
    if (room <= 0) break;
    // Once per silence: the client must have written since the last one.
    if (c.followUpSentAt && c.lastInboundAt && c.followUpSentAt >= c.lastInboundAt) continue;
    const lastFromClient = await prisma.chatMessage.findFirst({
      where: { conversationId: c.id, direction: 'IN' },
      orderBy: { createdAt: 'desc' },
      select: { body: true },
    });
    if (lastFromClient && OPTED_OUT.test(lastFromClient.body)) continue;

    try {
      await sendFollowUp(c.id, false);
      room -= 1;
    } catch (err) {
      // A template that is not approved, paused or misnamed fails the same way
      // on every thread — stop, rather than log the same error a hundred times.
      logger.error('Follow-up not sent — stopping for this hour', err, { conversation: c.id, template: followUp.templateName });
      return;
    }
  }
}

/** Every hour, send the follow-ups that are due. */
export function startFollowUpSweep(): void {
  setInterval(() => void sweep().catch((err) => logger.error('Follow-up sweep failed', err)), HOUR_MS).unref();
}
