import { prisma } from '@propgroup/db';
import { createText, isAiEnabled } from '../config/ai.js';
import { logger } from '../utils/logger.js';
import { canSendOn, replyWindowOpen, sendReply } from './messaging-send.service.js';

/**
 * Automatic first-line replies on WhatsApp and Instagram.
 *
 * This runs on a PUBLIC trigger — anyone can message the number — which is the
 * exact shape of the AI-search incident (see config/ai.ts). So it is off unless
 * explicitly enabled, and every reply has to pass each guard below. A reply
 * also costs a Meta service message, so the caps protect two bills.
 *
 * Env:
 *   AUTO_REPLY_ENABLED     — must be exactly "true" (and AI_ENABLED too)
 *   AUTO_REPLY_AUDIENCE    — "ads" (default): only people who came from an ad
 *                            or lead form. "all": everyone who is not already
 *                            being handled by a person.
 *   AUTO_REPLY_DAILY_LIMIT — replies per 24h across all threads (default 200)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Replies per thread per 24h. A conversation needing more than this needs a person. */
const PER_THREAD_LIMIT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** People send three short messages in a row; answer once, after they stop. */
const DEBOUNCE_MS = 8_000;
const HISTORY_MESSAGES = 20;

const pending = new Map<string, NodeJS.Timeout>();

export function autoReplyEnabled(): boolean {
  return process.env.AUTO_REPLY_ENABLED === 'true' && isAiEnabled();
}

function dailyLimit(): number {
  const n = Number(process.env.AUTO_REPLY_DAILY_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

/** Queue a reply for this thread. Safe to call on every inbound message. */
export function scheduleAutoReply(conversationId: string): void {
  if (!autoReplyEnabled()) return;
  clearTimeout(pending.get(conversationId));
  pending.set(
    conversationId,
    setTimeout(() => {
      pending.delete(conversationId);
      void run(conversationId).catch((err) =>
        logger.error('Auto-reply failed', { conversationId, error: (err as Error).message })
      );
    }, DEBOUNCE_MS)
  );
}

const SYSTEM_PROMPT = `You are the first-line assistant for PropGroup, a real estate brokerage. PropGroup sells and rents property in Lebanon (propgrouplb.com) and sells investment property abroad, mainly in Georgia (propgrp.com). You are chatting with a prospective client on WhatsApp or Instagram.

Your job is to welcome them and find out what they need, so a broker can follow up with the right options:
- whether they want to buy, rent, sell or invest
- which country and area
- the type of property and number of bedrooms
- their budget
- how soon they want to move

Rules:
- Reply in the language the client writes in (Arabic, English or French). Match Arabic script or Latin-letter Arabic, whichever they use.
- Keep it short and natural, like a person texting: one to three sentences, at most one question at a time. No lists, no markdown.
- Never state a price, availability, yield, payment plan, legal or visa fact, or any detail of a specific property unless the client has already written it in this conversation. You do not have the catalogue. Say a broker will send exact details.
- Never negotiate, promise a discount, or book a viewing time yourself.
- Do not ask for anything beyond what is listed above. Never ask for ID or payment details.
- If the client asks for a person, is upset, wants to negotiate, asks something you cannot answer, or you already have what a broker needs, hand off: tell them a member of the team will message them shortly.

Answer with a single JSON object and nothing else:
{"reply": "<the message to send>", "handoff": <true if a person should take over now, otherwise false>, "summary": "<one line in English of what the client wants so far, or empty>"}`;

function parseReply(text: string): { reply?: unknown; handoff?: unknown; summary?: unknown } | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function run(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: { select: { id: true, source: true, adId: true, askingFor: true } } },
  });
  if (!conversation || conversation.aiPaused) return;
  if (!canSendOn(conversation.channel) || !replyWindowOpen(conversation.lastInboundAt)) return;

  if (process.env.AUTO_REPLY_AUDIENCE !== 'all') {
    const fromAd =
      Boolean(conversation.adId) ||
      Boolean(conversation.lead?.adId) ||
      conversation.lead?.source === 'FACEBOOK_AD';
    if (!fromAd) return;
  }

  const since = new Date(Date.now() - DAY_MS);
  const recent = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'desc' },
    take: HISTORY_MESSAGES,
  });
  // Only answer a client who is actually waiting on us.
  if (recent.length === 0 || recent[0].direction !== 'IN') return;

  // A person replied from the phone or the CRM: the thread is theirs now.
  const humanReplied = await prisma.chatMessage.count({
    where: { conversationId, direction: 'OUT', sentAt: { gte: since }, NOT: { origin: 'AI' } },
  });
  if (humanReplied > 0) return;

  const [threadCount, globalCount] = await Promise.all([
    prisma.chatMessage.count({ where: { conversationId, origin: 'AI', sentAt: { gte: since } } }),
    prisma.chatMessage.count({ where: { origin: 'AI', sentAt: { gte: since } } }),
  ]);
  if (threadCount >= PER_THREAD_LIMIT) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { aiPaused: true } });
    logger.info('Auto-reply paused: thread limit reached', { conversationId });
    return;
  }
  if (globalCount >= dailyLimit()) {
    logger.warn('Auto-reply skipped: daily limit reached', { limit: dailyLimit() });
    return;
  }

  // Oldest first, consecutive messages from one side merged into one turn, and
  // the transcript must open with the client.
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of recent.reverse()) {
    const role = m.direction === 'IN' ? 'user' : 'assistant';
    const last = turns[turns.length - 1];
    if (last?.role === role) last.content += `\n${m.body}`;
    else turns.push({ role, content: m.body });
  }
  while (turns.length > 0 && turns[0].role !== 'user') turns.shift();
  if (turns.length === 0) return;

  const raw = await createText({ system: SYSTEM_PROMPT, messages: turns, maxTokens: 400 });
  const parsed = parseReply(raw);
  const reply = typeof parsed?.reply === 'string' ? parsed.reply.trim() : '';
  if (!reply) {
    logger.warn('Auto-reply produced nothing usable', { conversationId });
    return;
  }

  // The client may have written again, or a person may have answered, while the
  // model was thinking. Never talk over either.
  const latest = await prisma.chatMessage.findFirst({
    where: { conversationId },
    orderBy: { sentAt: 'desc' },
    select: { id: true },
  });
  if (latest?.id !== recent[recent.length - 1].id) return;

  await sendReply(conversationId, reply, 'AI');

  if (parsed?.handoff === true) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { aiPaused: true } });
  }
  const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim().slice(0, 200) : '';
  if (summary && conversation.lead && !conversation.lead.askingFor) {
    await prisma.lead.update({ where: { id: conversation.lead.id }, data: { askingFor: summary } });
  }
  logger.info('Auto-reply sent', { conversationId, handoff: parsed?.handoff === true });
}
