import { prisma } from '@propgroup/db';
import { ChatModelUnavailableError, ChatSession, chatAiEnabled, chatModelOrder, chatModelResting, type ChatContent, type ChatPart, type ChatTool } from '../config/chat-ai.js';
import { createText, isAiEnabled } from '../config/ai.js';
import { aiBudget } from '../utils/ai-budget.js';
import { logger } from '../utils/logger.js';
import { cardCaption, cardsByRef, formatPrice, marketNames, projectsNamedIn, propertyDetails, searchCatalogue, type Market } from './catalogue.service.js';
import { recordListingsShared } from './deal-sync.service.js';
import { getChatAiSettings, type ChatAiSettings } from './ai-settings.service.js';
import { linkConversationToLead } from './messaging-intake.service.js';
import { canSendOn, replyWindowOpen, sendReply } from './messaging-send.service.js';
import { extractKeyFromUrl, getFileStream } from './upload.service.js';

/**
 * The chat assistant on WhatsApp and Instagram.
 *
 * It listens (text, voice notes, photos), answers in the client's own
 * language, offers stock from the live public catalogue, and writes down what
 * the client wants as a suggestion for the team to accept.
 *
 * This runs on a PUBLIC trigger — anyone can message the number — which is the
 * exact shape of the AI-search incident (see config/ai.ts). So it is off unless
 * explicitly enabled, and every run has to pass each guard below. A reply also
 * costs a Meta service message, so the caps protect two bills.
 *
 * Env:
 *   AUTO_REPLY_ENABLED          — the master switch: must be exactly "true"
 *                                 (and GEMINI_API_KEY set)
 * Day-to-day behaviour — on/off, who it answers, which projects it favours —
 * is set in the back office (services/ai-settings.service.ts).
 *   AUTO_REPLY_DAILY_LIMIT      — messages per 24h across all threads (default 200)
 * Model spend is capped for every AI feature together — see utils/ai-budget.ts.
 *
 * One reply is ONE message. Each message to a client is billed by Meta, so the
 * answer and any properties offered with it travel together, and a burst of
 * short messages from the client is answered once, after they stop typing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Replies per thread per 24h. High enough for a real back-and-forth — the
 * assistant runs unattended, and pausing mid-conversation leaves a client in
 * silence — but still a ceiling on what one person can make it send.
 */
const PER_THREAD_LIMIT = 20;
/** How long to wait for a just-arrived voice note or photo to finish being stored. */
const MEDIA_WAIT_MS = 3_000;
const MEDIA_WAIT_TRIES = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
/** People send three short messages in a row; answer once, after they stop. */
const DEBOUNCE_MS = 6_000;
/** WhatsApp cuts a photo caption at 1024 characters. */
const CAPTION_LIMIT = 1000;
/** Enough history to keep the thread of a conversation; each message is resent on every model call. */
const HISTORY_MESSAGES = 16;
/** Voice notes and photos from the unanswered messages that are handed to the model. */
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const MAX_MODEL_TURNS = 6;
const MAX_LISTINGS = 3;

const pending = new Map<string, NodeJS.Timeout>();
/** The pause reason that means a person switched it off — see standingBlock. */
export const PAUSED_BY_TEAM = 'Paused by the team';
/** Tools whose result the model does not need to see before it can finish. */
const FINISHING_TOOLS = new Set([
  'send_listings', 'save_client_requirements', 'save_voice_transcripts', 'update_conversation_summary', 'hand_off_to_team',
]);
/** How many times a failed reply has been retried, per thread, and the waits between. */
const retries = new Map<string, number>();
const RETRY_AFTER_MS = [60_000, 3 * 60_000, 10 * 60_000];

export function autoReplyEnabled(): boolean {
  return process.env.AUTO_REPLY_ENABLED === 'true' && chatAiEnabled();
}

const envNumber = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Queue a reply for this thread. Safe to call on every inbound message. */
export function scheduleAutoReply(conversationId: string, delayMs: number = DEBOUNCE_MS): void {
  if (!autoReplyEnabled()) return;
  clearTimeout(pending.get(conversationId));
  pending.set(
    conversationId,
    setTimeout(() => {
      pending.delete(conversationId);
      void run(conversationId, retries.has(conversationId) ? 'retry' : 'message')
        .then(() => retries.delete(conversationId))
        .catch((err) => {
          // Nobody is watching, so a failure must not be the end of it: the
          // client is still waiting. Try again a few times, further apart.
          const attempt = retries.get(conversationId) ?? 0;
          const wait = RETRY_AFTER_MS[attempt];
          logger.error('Auto-reply failed', err, { conversationId, retryInSeconds: wait ? wait / 1000 : 'no more retries' });
          if (wait === undefined) {
            retries.delete(conversationId);
            return;
          }
          retries.set(conversationId, attempt + 1);
          scheduleAutoReply(conversationId, wait);
        });
    }, delayMs)
  );
}

export interface AutoReplyOutcome {
  sent: boolean;
  /** Why, in words somebody can act on. */
  reason: string;
  /** The block is one "Resume auto-reply" lifts (a pause, or the team having replied). */
  canResume?: boolean;
  /** What happened on the way, for the log line: script, model, tools, cost, timings, text previews. */
  trace?: Record<string, unknown>;
}

/**
 * Have the assistant answer this thread now, because a person asked it to.
 * Skips the checks that exist to keep it out of a person's way (who it
 * answers, the pause, "someone already replied") and keeps every one that
 * protects the client or the bill. Throws with the real error if the model or
 * the send fails, so the cause reaches the screen.
 */
export function runAutoReplyNow(conversationId: string): Promise<AutoReplyOutcome> {
  return run(conversationId, 'manual');
}

/** Would the assistant answer the next message on this thread, and if not, why? */
export async function autoReplyStatus(conversationId: string): Promise<AutoReplyOutcome> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: { select: { adId: true, source: true } } },
  });
  if (!conversation) return { sent: false, reason: 'Conversation not found.' };
  const blocked = await standingBlock(conversation, await getChatAiSettings(), false);
  if (blocked) {
    return { sent: false, reason: blocked, canResume: conversation.aiPaused || blocked.startsWith('Someone on the team') };
  }
  return {
    sent: true,
    reason: conversation.aiAlways
      ? 'It answers every message here, even when the team replies.'
      : 'It will answer the next message.',
  };
}

/**
 * The team has gone quiet: nobody has replied (or paused the thread) for
 * `quietHours`. A client writing into that silence should not wait for
 * someone to notice, so the assistant takes the conversation back.
 */
async function teamWentQuiet(conversation: { id: string; aiPausedAt: Date | null }, quietHours: number): Promise<boolean> {
  const lastTeam = await prisma.chatMessage.findFirst({
    where: { conversationId: conversation.id, direction: 'OUT', NOT: { origin: 'AI' } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const teamAt = Math.max(lastTeam?.createdAt.getTime() ?? 0, conversation.aiPausedAt?.getTime() ?? 0);
  return teamAt > 0 && Date.now() - teamAt >= quietHours * 60 * 60 * 1000;
}

/**
 * Every few minutes, look for clients who are waiting while the team has gone
 * quiet. Nothing else would notice them: the assistant otherwise only wakes on
 * a new message, and a client who wrote once and is waiting sends no other.
 */
const swept = new Map<string, number>();

export function startQuietSweep(): void {
  const sweep = async () => {
    if (!autoReplyEnabled()) return;
    const settings = await getChatAiSettings();
    if (!settings.enabled) return;
    const now = Date.now();
    // Still inside WhatsApp's 24-hour window, waiting at least as long as the
    // quiet period, and the client spoke last.
    const candidates = await prisma.conversation.findMany({
      where: {
        archivedAt: null,
        lastInboundAt: { gte: new Date(now - DAY_MS + 30 * 60 * 1000), lte: new Date(now - 60_000) },
      },
      select: { id: true, lastInboundAt: true, lastMessageAt: true },
      take: 200,
    });
    for (const c of candidates) {
      if (!c.lastInboundAt || c.lastMessageAt.getTime() - c.lastInboundAt.getTime() > 1000) continue;
      if (pending.has(c.id) || inFlight.has(c.id)) continue;
      // One try per client message. A thread the assistant looked at and
      // declined (a repeat it held back, no reply text) would otherwise be put
      // to the model again every five minutes — paid for every time.
      if (swept.get(c.id) === c.lastInboundAt.getTime()) continue;
      swept.set(c.id, c.lastInboundAt.getTime());
      await run(c.id, 'sweep').catch((err) => {
        logger.error('Quiet sweep reply failed', err, { conversationId: c.id });
      });
    }
  };
  setInterval(() => void sweep().catch((err) => logger.error('Quiet sweep failed', err)), 5 * 60 * 1000).unref();
}

/** "Resume auto-reply" was pressed within the last 24 hours. */
function resumedRecently(conversation: { aiResumedAt: Date | null }): boolean {
  return Boolean(conversation.aiResumedAt && Date.now() - conversation.aiResumedAt.getTime() < DAY_MS);
}

/**
 * The reasons that hold whatever the client writes next. `manual` drops the
 * ones that only exist to keep the assistant out of a person's way.
 */
async function standingBlock(
  conversation: { id: string; channel: 'WHATSAPP' | 'INSTAGRAM'; aiPaused: boolean; aiPausedReason: string | null; aiPausedAt: Date | null; aiAlways: boolean; aiResumedAt: Date | null; adId: string | null; lastInboundAt: Date | null; lead: { adId: string | null; source: string } | null },
  settings: { enabled: boolean; audience: 'ads' | 'all'; handover: ChatAiSettings['handover']; quietHours: number },
  manual: boolean
): Promise<string | null> {
  if (!chatAiEnabled()) return 'No Gemini key is set on the server (GEMINI_API_KEY).';
  if (!canSendOn(conversation.channel)) {
    return conversation.channel === 'WHATSAPP'
      ? 'WhatsApp sending is not configured on the server (YCLOUD_API_KEY and YCLOUD_WHATSAPP_FROM).'
      : 'Instagram sending is not configured on the server (INSTAGRAM_ACCESS_TOKEN).';
  }
  if (!replyWindowOpen(conversation.lastInboundAt)) {
    return 'More than 24 hours since the client last wrote, so the platform does not allow a reply.';
  }
  if (!manual) {
    if (process.env.AUTO_REPLY_ENABLED !== 'true') return 'The master switch is off on the server (AUTO_REPLY_ENABLED is not "true").';
    if (!settings.enabled) return 'Automatic replies are switched off in the Chat assistant settings.';
    // Switched off for this chat by a person: nothing brings it back but a person.
    if (conversation.aiPaused && conversation.aiPausedReason === PAUSED_BY_TEAM) {
      return 'Switched off for this chat by the team.';
    }
    const alwaysHere = conversation.aiAlways;
    const alwaysEverywhere = settings.handover === 'always';
    const hours = `${settings.quietHours} hour${settings.quietHours === 1 ? '' : 's'}`;

    // It handed the client to a person, or hit its daily cap. A person is
    // expected — in every mode, "always on" included: an assistant that says
    // "a colleague will message you" and then carries on answering contradicts
    // itself (and once said it twice). Unless set to step aside for good, it
    // comes back when the team leaves the client waiting the quiet period.
    if (conversation.aiPaused) {
      const comesBack = alwaysHere || settings.handover !== 'step_aside';
      if (!comesBack || !(await teamWentQuiet(conversation, settings.quietHours))) {
        const why = conversation.aiPausedReason
          ? ` (${conversation.aiPausedReason.charAt(0).toLowerCase()}${conversation.aiPausedReason.slice(1)})`
          : '';
        return `Handed over to the team${why}.${comesBack ? ` It answers again if the team leaves the client waiting ${hours}.` : ' Switch it back on to let it answer.'}`;
      }
    } else {
      // A per-chat "always on" is somebody's explicit choice for this client,
      // so it answers whether or not they came from an ad.
      if (settings.audience !== 'all' && !alwaysHere) {
        const fromAd =
          Boolean(conversation.adId) || Boolean(conversation.lead?.adId) || conversation.lead?.source === 'FACEBOOK_AD';
        if (!fromAd) return 'This person did not come from an ad or a lead form, and the settings say to answer only those.';
      }
      // A person replied from the phone or the CRM: the thread is theirs now.
      // Only replies since it was last switched on count — switching it on is
      // how a person says "take it from here".
      if (!alwaysHere && !alwaysEverywhere) {
        const since = Math.max(Date.now() - DAY_MS, conversation.aiResumedAt?.getTime() ?? 0);
        const humanReplied = await prisma.chatMessage.count({
          where: {
            conversationId: conversation.id, direction: 'OUT',
            sentAt: { gte: new Date(since) }, NOT: { origin: 'AI' },
          },
        });
        if (humanReplied > 0) {
          if (settings.handover !== 'return_after_quiet') {
            return 'Someone on the team replied here, so the assistant is staying out of it.';
          }
          if (!(await teamWentQuiet(conversation, settings.quietHours))) {
            return `Someone on the team replied here, so the assistant is staying out of it — it answers again if a client message waits ${hours} with no reply from the team.`;
          }
        }
      }
    }
  }
  const budget = await aiBudget();
  if (budget.exhausted) return 'The AI budget is used up, so all AI is paused.';
  return null;
}

const UNIT_KINDS = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL'];

const TOOLS: ChatTool[] = [
  {
    name: 'search_listings',
    description:
      'Search the live public catalogue for available properties. Call this before mentioning any specific property. Returns up to 6 results with reference code, location, size and price.',
    parameters: {
      type: 'object',
      properties: {
        market: { type: 'string', enum: ['LEBANON', 'GEORGIA'], description: 'Country the client wants. GEORGIA covers all stock outside Lebanon.' },
        deal: { type: 'string', enum: ['SALE', 'RENT'], description: 'Buying or renting. Only Lebanon has rentals; abroad is always SALE.' },
        area: { type: 'string', description: 'City, district or project name in English, e.g. "Batumi", "Achrafieh". Omit to search the whole market.' },
        minBeds: { type: 'integer', description: 'Minimum bedrooms. 0 for a studio.' },
        budgetMax: { type: 'number', description: 'Plain number in USD: the purchase budget, or for RENT the rent per month.' },
        kind: { type: 'string', enum: UNIT_KINDS },
        readyOnly: { type: 'boolean', description: 'True when the client wants something built and ready now, not off-plan.' },
      },
      required: ['market'],
    },
  },
  {
    name: 'get_property_details',
    description:
      'Everything the public page says about one property: whether it is ready or off-plan and its handover date, payment plans (down payment, monthly instalments, months), ROI and rental yield, amenities, a description, and each available unit with its size, floor, view, finishes and price. Call it whenever the client asks anything specific about a property — ready or not, payment plan, monthly payments, units, sizes, finishing, ROI, delivery — and answer from it.',
    parameters: {
      type: 'object',
      properties: { ref: { type: 'string', description: 'A reference code from search_listings, the advert, or the conversation, e.g. "PG-1059".' } },
      required: ['ref'],
    },
  },
  {
    name: 'send_listings',
    description: `Attach up to ${MAX_LISTINGS} properties to your reply. Each is added under your text with its name, reference code, location, size, price and link, and the first one's photo. Only reference codes returned by search_listings. Do not repeat those details in your text — just introduce them in a sentence.`,
    parameters: {
      type: 'object',
      properties: { refs: { type: 'array', items: { type: 'string' }, description: 'Reference codes like "PG-1059".' } },
      required: ['refs'],
    },
  },
  {
    name: 'save_client_requirements',
    description:
      'Record what the client has told you they want, for the team. Call whenever the client states or changes a requirement. Include only what they actually said.',
    parameters: {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: ['BUYER', 'RENTER', 'SELLER', 'LANDLORD'] },
        market: { type: 'string', enum: ['LEBANON', 'GEORGIA'] },
        area: { type: 'string', description: 'Areas they named, in English.' },
        minBeds: { type: 'integer' },
        budgetMax: { type: 'number', description: 'Plain number in USD.' },
        kind: { type: 'string', enum: UNIT_KINDS },
        isInvestor: { type: 'boolean', description: 'True if they are buying for return rather than to live in.' },
        summary: { type: 'string', description: 'One line in English: what they want and how soon.' },
      },
      required: ['summary'],
    },
  },
  {
    name: 'save_voice_transcripts',
    description: 'Write down what each voice note says, in the language spoken. Call once whenever the client sent voice notes.',
    parameters: {
      type: 'object',
      properties: {
        transcripts: {
          type: 'array',
          items: {
            type: 'object',
            properties: { note: { type: 'integer', description: 'The voice note number.' }, text: { type: 'string' } },
            required: ['note', 'text'],
          },
        },
      },
      required: ['transcripts'],
    },
  },
  {
    name: 'update_conversation_summary',
    description:
      'Rewrite the running summary of this conversation: two to four sentences in English on who the client is, what they want (country, area, budget, size, timing), what has been offered or agreed, and what is still open. Call it in the same turn as your reply, every time.',
    parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
  },
  {
    name: 'hand_off_to_team',
    description:
      'Pass the conversation to a person. Use when the client asks for one, is upset, wants to negotiate or book a viewing, or asks something you cannot answer. Still write a short reply telling them a colleague will message them.',
    parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
  },
];

/**
 * How Lebanese people really text in Latin letters. Left to itself the model
 * wrote "halla9", "3andna", "7elwi" and fus7a like "bodayi3" — Gulf numbers and
 * Syrian endings that a Lebanese client reads as a foreign bot.
 */
const LEBANESE_LATIN = `How Lebanese people text Arabic in Latin letters ("Arabizi") — follow it exactly:
- Only three numbers stand for letters: 2 (ء, and ق — Lebanese pronounce qaf as a hamza: "halla2", "2addeh", "2ariib"), 3 (ع), 7 (ح). Never use 9, 6 or 8 as letters: 9 for ق or ص is Gulf and reads as foreign. Write ص s, ط t, ض d, ظ z, خ kh, غ gh, ش sh.
- Lebanese, not Syrian, Gulf or Egyptian. Lebanese endings in "e": "7elwe", "hayde", "risele", "tenye", "mni7a". Lebanese words: "3anna" (not "3andna"), "2addeh" (how much), "shu", "halla2", "kif", "baddak", "fi", "akid", "tab3an", "ya3ne", "hek", "hon", "kamen", "ma fi mechkle".
- Keep property and money words in English, as Lebanese do: budget, apartment, studio, project, investment, payment plan, down payment, sea view, ROI.
- Never transliterate formal Arabic (fus7a) — no "bodayi3", "mizeytik", "khyarat". If unsure of a word, use the English one.
- Sounds right: "Ahla w sahla! 2addeh l budget li 3am tfakker fi?" · "3anna projects ktir 7elwe b Batumi bi hal budget:" · "Akid, kel l souwar w l tafasil 3al link." · "Ma weslitna l risele, fik tb3atha marra tenye ka text?"
- Sounds wrong: "Shu l budget li 3am tfakkir fi la halla9?" · "3andna khyarat ktir 7elwi" · "Hay l-bodayi3 3am tne2i l-afdal la mizeytik".`;

const LEBANESE_ARABIC = `When writing in Arabic letters: Lebanese dialect the way Lebanese people type it, never formal Arabic. "أهلا وسهلا! قديش الميزانية يلي عم تفكر فيها؟" · "عنا مشاريع كتير حلوة بباتومي بهالميزانية" · "أكيد، كل الصور والتفاصيل عاللينك". Project names, reference codes and words like ROI stay in Latin letters.`;

const LANGUAGE_RULE: Record<ChatAiSettings['replyStyle'], string> = {
  match: `- Reply in the client's language and script. Arabic typed in Arabic letters gets Lebanese Arabic in Arabic letters. Arabic typed in Latin letters, or SPOKEN in a voice note, gets Lebanese Arabic in Latin letters. English gets English; French gets French. Never ask which language they prefer.
${LEBANESE_LATIN}
${LEBANESE_ARABIC}`,
  latin: `- If the client writes or speaks Arabic — in Arabic letters, in Latin letters, or in a voice note — reply in Lebanese Arabic written in LATIN letters. Never use Arabic script. If they write English, reply in English; French, in French. Never ask which language they prefer.
${LEBANESE_LATIN}`,
  latin_always: `- Always reply in Lebanese Arabic written in LATIN letters, whatever language the client writes in. Never use Arabic script.
${LEBANESE_LATIN}`,
};

/**
 * The language a client is writing in, decided in code rather than left to
 * the model. "Latin letters" was not enough: an English "Hello! Can I get more
 * info on this?" got a Lebanese-in-Latin-letters answer, because the
 * instruction allowed either and the cheap model picked the wrong one.
 */
type ClientLanguage = 'arabic' | 'arabizi' | 'english' | 'french' | 'voice';
/** What the written reply is checked against. `latin` is any language in Latin letters (after a voice note). */
type ReplyLanguage = 'arabic' | 'arabizi' | 'english' | 'french' | 'latin';
const ARABIC_LETTERS = /[؀-ۿݐ-ݿ]/;
const NOT_RECEIVED = /^Not received:/;
const LEBANESE_WORDS = /\b(kifak|kifik|kifkon|shu|shou|chou|badde|baddi|baddak|baddik|3am|ahla|ahlan|halla2|hala2|hayda|hayde|akid|ma3ak|ma3ik|yalla|tayeb|mni7|ktir|kteer|kamen|fik|fiki|fiye|ana|enta|enti|inta|inte|lesh|la2|mish|msh|bas|hek|hon|ya3ne|yaane|habibi|marhaba|tfaddal|kel|shi|wen|lal|bel|3al|3an|3anna|men|mn)\b/gi;
/** Lebanese that never belongs in an English or French reply. */
const LEBANESE_PHRASE = /\b(ahla|ahlan|akid|ma fi|mechkle|mishkle|mushkle|yalla|habibi|tfaddal|tfadal|ya3ne|kifak|kifik|shu|shou|tayeb|yislamo|tislam|marhaba|w sahla)\b/i;
const FRENCH_WORDS = /\b(bonjour|bonsoir|salut|merci|je|j|vous|est|c|pour|avec|oui|non|plus|sujet|cette|des|les|une|suis|voudrais|svp|s|il|puis|en|savoir|quel|quelle|votre|nous|sont)\b/gi;

/** Words mixing letters with 2, 3 or 7 ("3am", "halla2", "mni7") — but not "2BR", "3rd", "7am", "PG-1074". */
function arabiziDigitWords(text: string): number {
  return (text.match(/[a-z0-9']+/gi) ?? []).filter(
    (w) => /[a-z]/i.test(w) && /[237]/.test(w) && !/^\d+(st|nd|rd|th|br|bd|bed|beds|k|m|m2|sqm|am|pm|x)$/i.test(w)
  ).length;
}

function looksArabizi(text: string): boolean {
  return arabiziDigitWords(text) >= 1 || (text.match(LEBANESE_WORDS) ?? []).length >= 2;
}

export function languageOf(text: string): ClientLanguage | null {
  if (ARABIC_LETTERS.test(text)) return 'arabic';
  if (!/[a-z]/i.test(text)) return null;
  if (looksArabizi(text)) return 'arabizi';
  if ((text.match(FRENCH_WORDS) ?? []).length >= 2 || /\b(bonjour|bonsoir|merci)\b/i.test(text)) return 'french';
  return 'english';
}

/**
 * How the client is writing right now: their newest message that has words in
 * it, looking first at what is unanswered and then further back. A voice note
 * counts as speech, whatever was said in it.
 */
function clientLanguage(newestFirst: Array<{ direction: string; type: string; body: string }>): ClientLanguage | null {
  for (const m of newestFirst) {
    if (m.direction !== 'IN') continue;
    if (m.type === 'audio') return 'voice';
    if (m.type !== 'text' && !m.body.trim()) continue;
    if (NOT_RECEIVED.test(m.body) || /^\[\w+\]$/.test(m.body)) continue;
    const language = languageOf(m.body);
    if (language) return language;
  }
  return null;
}

/**
 * The one language this reply must be in, decided in code — the model kept
 * drifting when only told the general rule. `expect` is what the written reply
 * is checked against before it goes.
 */
function languageForThisReply(style: ChatAiSettings['replyStyle'], language: ClientLanguage | null): { rule: string; expect: ReplyLanguage | null } {
  if (style === 'latin_always') {
    return { rule: 'Write this reply in Lebanese Arabic in LATIN letters.', expect: 'arabizi' };
  }
  switch (language) {
    case 'arabic':
      return style === 'match'
        ? { rule: 'The client is typing in ARABIC letters: write this reply in Lebanese Arabic in Arabic letters.', expect: 'arabic' }
        : { rule: 'The client is typing in Arabic letters: write this reply in Lebanese Arabic in LATIN letters.', expect: 'arabizi' };
    case 'arabizi':
      return { rule: 'The client is typing Lebanese Arabic in Latin letters: write this reply the same way.', expect: 'arabizi' };
    case 'english':
      return { rule: 'The client is writing in ENGLISH: write this reply only in English — no Arabic or Lebanese words at all, not even "ahla" or "ma fi mechkle".', expect: 'english' };
    case 'french':
      return { rule: 'The client is writing in FRENCH: write this reply only in French.', expect: 'french' };
    case 'voice':
      return {
        rule: 'The client\'s latest message is a voice note. If they speak Arabic, write this reply in Lebanese Arabic in LATIN letters; if English or French, in that language only. Never Arabic script.',
        expect: 'latin',
      };
    default:
      return { rule: '', expect: null };
  }
}

const LANGUAGE_NAME: Record<ReplyLanguage, string> = {
  arabic: 'Lebanese Arabic in Arabic letters', arabizi: 'Lebanese Arabic in Latin letters',
  english: 'English', french: 'French', latin: 'Latin letters',
};

/** What is wrong with the reply's language, or null. Links are ignored — "goo.gl/9xQ" is not Arabizi. */
export function languageProblem(text: string, expect: ReplyLanguage | null): string | null {
  if (!expect) return null;
  const words = text.replace(/https?:\/\/\S+/g, '');
  if (expect === 'arabic') return ARABIC_LETTERS.test(words) ? null : 'written in Latin letters instead of Arabic';
  if (ARABIC_LETTERS.test(words)) return 'written in Arabic letters instead of Latin';
  // In an English or French reply even one Lebanese phrase is wrong ("Ma fi mechkle, Joe…").
  if ((expect === 'english' || expect === 'french') && (looksArabizi(words) || LEBANESE_PHRASE.test(words))) {
    return `written in Lebanese instead of ${LANGUAGE_NAME[expect]}`;
  }
  if (expect === 'arabizi' && !looksArabizi(words) && words.split(/\s+/).length > 6) return 'written in English instead of Lebanese';
  // "halla9", "3e9ar", "9ar2eb" — but not "9th floor".
  if ((expect === 'arabizi' || expect === 'latin') && /[a-z]9|\b9(?!th\b)[a-z]/i.test(words)) return 'used 9 as a letter';
  return null;
}

/**
 * Put a reply that came out in the wrong language, or with Gulf numbers, right.
 * A small text-only call on the cheapest model, made only when the check fails;
 * if it fails too, the original goes out — a reply in the wrong language beats
 * silence.
 */
async function rewriteLanguage(
  text: string,
  expect: ReplyLanguage,
  conversationId: string
): Promise<{ text: string; usd: number }> {
  const target = expect === 'latin' ? 'in LATIN letters — Lebanese Arabizi if it is Arabic, otherwise leave the language as it is' : `in ${LANGUAGE_NAME[expect]}${expect === 'english' || expect === 'french' ? ' only, with no Arabic or Lebanese words' : ''}`;
  const guide = expect === 'arabic' ? LEBANESE_ARABIC : expect === 'arabizi' || expect === 'latin' ? LEBANESE_LATIN : '';
  const session = new ChatSession(
    `You correct WhatsApp messages written by a Lebanese real estate agency. Rewrite the message you are given ${target}. Keep its meaning and length, and keep every name, number, price, reference code and link exactly as they are. Output only the rewritten message.${guide ? `\n\n${guide}` : ''}`,
    [],
    { feature: 'chat-reply', conversationId },
    chatModelOrder('economy')[0]
  );
  try {
    const result = await session.send([{ role: 'user', parts: [{ text }] }], true);
    return { text: result.text || text, usd: session.spent.usd };
  } catch (err) {
    logger.warn('Auto-reply: language fix failed, sending as written', { conversationId, error: (err as Error).message });
    return { text, usd: session.spent.usd };
  }
}

/** Short, single-line text for the log, or nothing when LOG_CHAT_TEXT=false. */
function preview(text: string | null | undefined, max = 160): string | undefined {
  if (!text || process.env.LOG_CHAT_TEXT === 'false') return undefined;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

const sameText = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

function systemPrompt(context: string, replyStyle: ChatAiSettings['replyStyle'], thisReply: string): string {
  return `You are the assistant for PropGroup, a real estate brokerage, replying to a client on WhatsApp or Instagram. PropGroup sells and rents property in Lebanon and sells investment property abroad, mainly in Georgia.

How to write:
${LANGUAGE_RULE[replyStyle]}${thisReply ? `\n- ${thisReply}` : ''}
- Write like a helpful person texting: one to three short sentences, at most one question at a time. No lists, no markdown, no emojis unless the client uses them.
- If the client sends a voice note, listen to it and answer what it says as if they had typed it.
- A message that reads "Not received: …" in the middle of a conversation means the client sent something that did not reach us — usually a voice note or photo set to "view once". Do not guess what it said. Ask them, briefly and kindly, to send it again as a normal voice note or as text.
- Never send a message you have already sent in this conversation, word for word or nearly. If you already told them a colleague will be in touch, do not say it again: answer what they asked if you can, or acknowledge it in a few words.

What to do:
- Work out what they need from what you already know, and ask only for what is genuinely missing, one question at a time. Never ask something the ad they came from, their earlier messages or the notes below already answer.
- Each reply is one message and costs money to send. Say everything for this turn in that one reply; never plan a follow-up message.
- As soon as you know the country and either a budget, an area or a project, call search_listings and attach the best matches with send_listings. Two or three well-matched options beat many. If nothing fits, say so plainly and ask what they could flex on.
- Each time the client tells you a requirement, call save_client_requirements.
- Be quick: once you have what you need, write your reply in the SAME turn as send_listings, save_client_requirements and update_conversation_summary — do not make a separate turn just for those.
- Results marked "priority" are the projects the office most wants to sell. When one fits what the client asked for, recommend it first and use its "whyRecommend" to say why it is a good choice. Never push one that does not fit their budget or what they asked for.
- When the client asks anything specific about a property — is it ready, when is handover, is there a payment plan or monthly instalments, how much down, which sizes or floors, which finishes, the ROI — call get_property_details and answer from it, with the real figures, in a sentence or two. If they want something ready, search with readyOnly. Only hand off when the details really do not contain the answer.
- Photos, floor plans, the location and the full details of every property are on its own page, and send_listings puts the link to that page in your message. So when a client asks for pictures, more details, the location or "more info" about a property, attach it with send_listings and tell them everything is at the link. That is an answer you can give yourself — never hand off, and never promise that a colleague will send photos or details.

How the two markets work:
- Abroad (Georgia) PropGroup sells PROJECTS: developments with several unit types and a "from" price. It is always a purchase, usually for investment. Never ask a Georgia client whether they want to buy or rent, never offer rentals, and do not bring up Lebanon unless they do. Useful questions there are budget, unit size, and when they want to buy.
- Lebanon is sold property by property, and a property is either for sale or for rent — ask which if it is not clear, and pass it to search_listings.

Hard rules:
- Describe a property only as search_listings or get_property_details returned it — its name, its location and its price exactly as given. If a result is somewhere other than where the client asked, say so; never relabel it to match their request.
- If a place or project name in a voice note is unclear, or is not one we have stock in, ask the client to confirm it before searching.
- Only state facts about a property that search_listings or get_property_details returned, or that the office's answers below give. Never invent or estimate a price, availability, yield, payment plan, delivery date or legal detail — if it is not there, say a colleague will confirm it.
- Never mention owners, sellers, developers' terms, commission, fees, discounts or anything about how PropGroup is paid. If asked, say a colleague will go through the details.
- Never negotiate, never confirm a viewing time, never ask for ID or payment details.
- Hand off only when it is really needed: the client asks for a person, is upset, wants to negotiate or to book a viewing, or asks something that is neither in the search results nor on the property's page. Then call hand_off_to_team and tell them a member of the team will message them shortly.

${context}`;
}

/**
 * A reply written without Gemini, for when all of its models are unavailable.
 *
 * Deliberately limited: no stock search and no hearing voice notes, so it only
 * keeps the conversation going — acknowledges, asks the next useful question,
 * or asks for a voice note to be typed. It must never describe a property.
 */
async function fallbackReply(
  ordered: Array<{ id: string; direction: string; type: string; body: string; transcript: string | null }>,
  unansweredIds: Set<string>,
  replyStyle: ChatAiSettings['replyStyle'],
  market: Market
): Promise<string> {
  if (!isAiEnabled()) return '';
  const lines = ordered.slice(-12).map((m) => {
    const who = m.direction === 'IN' ? 'Client' : 'Us';
    if (m.type === 'audio' && !m.transcript) {
      return `${who}: [a voice note${unansweredIds.has(m.id) ? ' you could not listen to' : ''}]`;
    }
    return `${who}: ${m.transcript ?? m.body}`;
  });
  return (
    await createText({
      maxTokens: 250,
      system: `You are the assistant for PropGroup, a real estate brokerage, replying to a client on WhatsApp. This conversation is about property in ${market === 'LEBANON' ? 'Lebanon' : 'Georgia'}.

${LANGUAGE_RULE[replyStyle]}
- One or two short sentences, at most one question. No lists, no markdown.

Right now you cannot look up properties and you cannot listen to voice notes. So:
- If the client's latest message is a voice note you could not listen to, apologise briefly and ask them to send it as text.
- Otherwise reply naturally and ask for whichever of these is still missing: their budget, the area they prefer, the size they need.
- Never name, describe or price any property, and never promise a specific time. You may say you will send suitable options shortly.

Write only the message to send.`,
      messages: [{ role: 'user', content: `The conversation so far:\n${lines.join('\n')}\n\nWrite the next message from us.` }],
    })
  ).trim();
}

/** The bytes of a stored attachment, or null when it is missing or too large. */
async function loadAttachment(mediaUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const key = extractKeyFromUrl(mediaUrl);
    if (!key) return null;
    const object = await getFileStream(key);
    if ((object.ContentLength ?? 0) > MAX_ATTACHMENT_BYTES || !object.Body) return null;
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    // "audio/ogg; codecs=opus" → "audio/ogg"
    const mimeType = (object.ContentType ?? 'application/octet-stream').split(';')[0].trim();
    return { data: bytes.toString('base64'), mimeType };
  } catch (err) {
    logger.warn('Chat attachment could not be read for the AI', { error: (err as Error).message });
    return null;
  }
}

/**
 * One reply per thread at a time. The new-message timer, the quiet sweep and
 * the "reply now" button can all reach the same thread; two runs that both saw
 * the client waiting would both answer.
 */
const inFlight = new Set<string>();

async function run(conversationId: string, trigger: 'message' | 'sweep' | 'manual' | 'retry'): Promise<AutoReplyOutcome> {
  if (inFlight.has(conversationId)) {
    return { sent: false, reason: 'The assistant is already answering this conversation.' };
  }
  inFlight.add(conversationId);
  const started = Date.now();
  try {
    const outcome = await reply(conversationId, trigger);
    // Every outcome is logged with its reason: "it did not reply" must always
    // be answerable from the log without guessing. The quiet sweep only logs
    // what it did, or it would print a line per waiting thread every 5 minutes.
    if (outcome.sent || trigger !== 'sweep') {
      logger.info(`Auto-reply: ${outcome.sent ? 'sent' : 'not sent'}`, {
        conversation: conversationId,
        trigger,
        reason: outcome.reason,
        ...outcome.trace,
        ms: Date.now() - started,
      });
    }
    return outcome;
  } finally {
    inFlight.delete(conversationId);
  }
}

/** "ok", "thanks", "merci", "shukran", 👍 — a conversation ending, not a question. */
const ACKNOWLEDGEMENT = /^\s*(ok(ay)?|k|thanks?( you)?|thank u|thx|merci( beaucoup)?|shukran|tslam|yslamo|ysalmo|great|perfect|noted|👍|🙏|❤️|شكرا|شكراً|تسلم|يسلمو|اوكي|تمام)[\s!.]*$/i;

async function reply(conversationId: string, trigger: 'message' | 'sweep' | 'manual' | 'retry'): Promise<AutoReplyOutcome> {
  const manual = trigger === 'manual';
  // Everything worth knowing about this reply, logged as one line with its outcome.
  const trace: Record<string, unknown> = {};
  const skip = (reason: string): AutoReplyOutcome => ({ sent: false, reason, trace });
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      lead: {
        select: {
          id: true, name: true, source: true, adId: true, adLabel: true, market: true, askingFor: true,
          budgetMax: true, minBeds: true, areas: true, type: true,
        },
      },
    },
  });
  if (!conversation) return skip('Conversation not found.');

  const settings = await getChatAiSettings();
  const blocked = await standingBlock(conversation, settings, manual);
  if (blocked) return skip(blocked);

  const since = new Date(Date.now() - DAY_MS);
  const loadRecent = () =>
    prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      take: HISTORY_MESSAGES,
    });
  let recent = await loadRecent();

  // A voice note is copied into storage in the background when it arrives. If
  // the newest ones are not there yet, give them a moment — answering "[audio]"
  // without having heard it is worse than answering ten seconds later.
  const stillStoring = () =>
    recent.some(
      (m) =>
        m.direction === 'IN' && (m.type === 'audio' || m.type === 'image') && !m.mediaUrl &&
        Date.now() - m.createdAt.getTime() < 60_000
    );
  const mediaWaitStarted = Date.now();
  for (let i = 0; i < MEDIA_WAIT_TRIES && stillStoring(); i++) {
    await new Promise((resolve) => setTimeout(resolve, MEDIA_WAIT_MS));
    recent = await loadRecent();
  }
  if (Date.now() - mediaWaitStarted > 500) trace.mediaWaitMs = Date.now() - mediaWaitStarted;
  // Only answer a client who is actually waiting on us. "Waiting" goes by when
  // a message ARRIVED, not when it was sent: a voice note is stamped with the
  // moment the client pressed send, can take many seconds to upload, and so
  // lands after a reply of ours while carrying an earlier time. Judged by send
  // time it looked already answered, and was silently skipped.
  if (recent.length === 0) return skip('There are no messages on this conversation yet.');
  const lastReplyAt = Math.max(0, ...recent.filter((m) => m.direction === 'OUT').map((m) => m.createdAt.getTime()));
  const unansweredIds = new Set(
    recent.filter((m) => m.direction === 'IN' && m.createdAt.getTime() > lastReplyAt).map((m) => m.id)
  );
  if (unansweredIds.size === 0) return skip('The last message is ours — the client is not waiting on a reply.');
  const unansweredMessages = recent.filter((m) => unansweredIds.has(m.id)).reverse();
  // From the first unanswered message arriving to our reply going out.
  const waitingSince = Math.min(...unansweredMessages.map((m) => m.createdAt.getTime()));
  trace.in = unansweredMessages.map((m) => m.type).join(',');
  trace.client = preview(unansweredMessages.map((m) => m.transcript ?? m.body).join(' / '));
  // The sweep picks up clients left waiting — but "Ok / Thank you" left 13
  // hours is a conversation that ended, and "You're very welcome!" half a day
  // later reads as a bot. Only something that needs an answer is picked up.
  if (trigger === 'sweep' && unansweredMessages.every((m) => m.type === 'text' && m.body.split(/\n|\s\/\s/).every((line) => ACKNOWLEDGEMENT.test(line)))) {
    return skip('Only a thank-you or an "ok" is waiting, which needs no reply.');
  }
  const newestArrival = () =>
    prisma.chatMessage.findFirst({ where: { conversationId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const latestId = (await newestArrival())?.id;

  const [threadCount, globalCount] = await Promise.all([
    prisma.chatMessage.count({
      where: {
        conversationId, origin: 'AI',
        // Resuming starts the day's count again; otherwise it would pause straight back.
        sentAt: { gte: resumedRecently(conversation) ? (conversation.aiResumedAt as Date) : since },
      },
    }),
    prisma.chatMessage.count({ where: { origin: 'AI', sentAt: { gte: since } } }),
  ]);
  if (!manual && threadCount >= PER_THREAD_LIMIT) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiPaused: true, aiPausedReason: `It had already sent ${PER_THREAD_LIMIT} replies in a day`, aiPausedAt: new Date() },
    });
    return skip(`The assistant has already sent ${PER_THREAD_LIMIT} replies here today, so it has paused for a person to take over.`);
  }
  if (globalCount >= envNumber('AUTO_REPLY_DAILY_LIMIT', 200)) {
    return skip('The daily limit on assistant messages has been reached (AUTO_REPLY_DAILY_LIMIT).');
  }

  // Oldest first. The messages the client sent since our last reply are the
  // ones being answered — only those have their voice notes and photos attached.
  // In the order they were sent, except that what is still unanswered goes
  // last — it is what the model is replying to, whatever its timestamp says.
  const bySendTime = [...recent].reverse();
  const ordered = [
    ...bySendTime.filter((m) => !unansweredIds.has(m.id)),
    ...bySendTime.filter((m) => unansweredIds.has(m.id)),
  ];
  const voiceNotes: string[] = []; // message ids, by voice-note number
  let attached = 0;

  const contents: ChatContent[] = [];
  for (const m of ordered) {
    const role = m.direction === 'IN' ? 'user' : 'model';
    const parts: ChatPart[] = [];
    const unanswered = unansweredIds.has(m.id);
    const isAudio = m.type === 'audio';

    if (unanswered && m.mediaUrl && (isAudio || m.type === 'image') && attached < MAX_ATTACHMENTS) {
      const file = await loadAttachment(m.mediaUrl);
      if (file) {
        attached += 1;
        if (isAudio) {
          voiceNotes.push(m.id);
          parts.push({ text: `[voice note ${voiceNotes.length}]` });
        }
        parts.push({ inlineData: file });
      }
    }
    if (parts.length === 0 || !/^\[\w+\]$/.test(m.body)) {
      // The opening message of a chat started from an advert sometimes reaches
      // us only as "not available" (WhatsApp code 131060) while the phone shows
      // the ad's ready-made greeting. Asking that client to "send it again" is
      // nonsense to them — so the first message of a thread is read as a hello.
      const openingUnreadable = NOT_RECEIVED.test(m.body) && m.id === ordered[0].id && recent.length < HISTORY_MESSAGES;
      parts.push({
        text: openingUnreadable
          ? '[Not from the client] Their first message could not be read — almost certainly the ready-made greeting from the advert ("Hello! Can I get more info on this?"). Greet them and start the conversation; do not ask them to resend anything.'
          : m.transcript && isAudio ? `[voice note] ${m.transcript}` : m.body,
      });
      if (openingUnreadable) trace.openingUnreadable = true;
    }

    const last = contents[contents.length - 1];
    if (last?.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }
  while (contents.length > 0 && contents[0].role !== 'user') contents.shift();
  if (contents.length === 0) return skip('There is nothing from the client to answer.');

  const clientLang = clientLanguage([...ordered].reverse());
  const language = languageForThisReply(settings.replyStyle, clientLang);
  trace.language = clientLang ?? 'unknown';

  // Reference codes the model may attach: search results, the ad's project,
  // and anything already named in this conversation — "send me the pictures of
  // the first one" has to work without searching all over again.
  const offered = new Set<string>();
  for (const m of recent) for (const ref of m.body.match(/\bPG-\d+(?:-\d+)?\b/gi) ?? []) offered.add(ref.toUpperCase());

  const lead = conversation.lead;

  // Which country this is about. An ad settles it (the ad's market); so does
  // anything the client already said here. Otherwise it is the setting — by
  // default, ask. A client's stored market is NOT used: every client gets
  // Lebanon by default, which is how the assistant once told a Batumi buyer
  // it would look in Lebanon.
  const fromAd =
    Boolean(conversation.adId) || Boolean(lead?.adId) || lead?.source === 'FACEBOOK_AD';
  const pendingSuggestion = await prisma.leadSuggestion.findFirst({
    where: { conversationId, status: 'PENDING' },
    select: { patch: true },
  });
  const said = (pendingSuggestion?.patch ?? {}) as { market?: string };
  const adMarket: Market = (process.env.LEAD_MARKET_META ?? 'GEORGIA').toUpperCase() === 'LEBANON' ? 'LEBANON' : 'GEORGIA';
  const knownMarket: Market | null =
    said.market === 'LEBANON' || said.market === 'GEORGIA'
      ? said.market
      : fromAd
        ? adMarket
        : settings.marketWhenUnknown === 'ask'
          ? null
          : settings.marketWhenUnknown;
  // For the ad's project and the preferred list when nothing is known yet.
  const defaultMarket: Market = knownMarket ?? 'GEORGIA';
  const known = [
    lead?.name ? `Client name: ${lead.name}` : null,
    lead?.askingFor ? `Already on file: ${lead.askingFor}` : null,
    lead?.budgetMax ? `Budget on file: up to ${lead.budgetMax} USD` : null,
    lead?.minBeds ? `Bedrooms on file: at least ${lead.minBeds}` : null,
    lead?.areas?.length ? `Areas on file: ${lead.areas.join(', ')}` : null,
  ].filter(Boolean);

  // The ad is the client's first sentence. One for a Batumi project has already
  // said country, project and that they are buying — so none of it is asked.
  const adText = conversation.adLabel ?? lead?.adLabel ?? null;
  const adProjects = adText ? await projectsNamedIn(adText, defaultMarket) : [];
  for (const p of adProjects) offered.add(p.ref.toUpperCase());
  const ad = adText
    ? [
        `They tapped an advert and wrote to us from it. The advert: "${adText}".`,
        adProjects.length
          ? `It is for ${adProjects
              .map((p) => `${p.title} (${p.ref}) in ${p.location || 'the area'}, ${formatPrice(p)}`)
              .join('; ')}. Treat that as what they are asking about: you may attach it with send_listings straight away, and should not ask which project or country.`
          : 'Treat its subject as what they are asking about.',
      ].join(' ')
    : null;

  // What the office would most like to sell, for a client who has not picked a
  // project. Only what is public and available right now makes the list.
  const preferredCards = adProjects.length ? [] : await cardsByRef(settings.preferred.map((p) => p.ref));
  for (const c of preferredCards) offered.add(c.ref.toUpperCase());
  const pitchOf = new Map(settings.preferred.map((p) => [p.ref.toUpperCase(), p.pitch]));
  const priorityOrder = settings.preferred.map((p) => p.ref.toUpperCase());
  const preferred = preferredCards.length
    ? [
        'The client has not named a project. Ask their budget and where they would like to be (one question at a time, skipping whatever you already know). Then recommend from the office\'s preferred list below, most wanted first, choosing those that fit their budget and location — you may attach them with send_listings without searching. If none of them fits, use search_listings instead; never push one that is clearly over their budget.',
        ...preferredCards.map((c, i) => {
          const pitch = pitchOf.get(c.ref.toUpperCase());
          return `${i + 1}. ${c.title} (${c.ref}) — ${c.location || 'location on the page'}, ${formatPrice(c)}${pitch ? `. Why recommend it: ${pitch}` : ''}`;
        }),
      ].join('\n')
    : null;

  // Only needed to make sense of a place heard in a voice note — and it is a
  // long list to resend on every call, so it is left out otherwise.
  const hasVoice = ordered.some((m) => unansweredIds.has(m.id) && m.type === 'audio');
  const names = hasVoice && knownMarket ? await marketNames(knownMarket) : { places: [] as string[], projects: [] as string[] };
  const office = settings.office;

  const context = [
    ad,
    preferred,
    settings.guidance ? `Keep in mind (from the office):\n${settings.guidance}` : null,
    knownMarket
      ? `This is about ${knownMarket === 'LEBANON' ? 'Lebanon' : 'Georgia'} — do not ask which country unless they bring up another.`
      : 'You do not know yet whether they want property in Lebanon or an investment abroad. Before searching or suggesting anything, ask exactly that, in one short question — in substance: "Are you looking for an investment abroad in Georgia, or for a property in Lebanon?" (in the client\'s language style). Do not ask which area of Lebanon until they have chosen Lebanon.',
    `Offer at most ${settings.maxListings} propert${settings.maxListings === 1 ? 'y' : 'ies'} in one reply.`,
    office.address
      ? `If they ask where you are, for the address, or to visit or meet: the office is ${office.name || 'PropGroup'}, ${office.address}.${office.mapsUrl ? ` Map: ${office.mapsUrl}` : ''} Give the map link exactly as it is.`
      : null,
    settings.knowledge.length
      ? `Answers the office has given you. When a client asks one of these, answer with this — in the client's language and your own words:\n${settings.knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join('\n')}`
      : null,
    names.places.length
      ? `Places we have stock in there: ${names.places.join(', ')}.${names.projects.length ? ` Projects: ${names.projects.join(', ')}.` : ''} A name you hear that sounds like one of these is that one.`
      : null,
    known.length ? `What we already know (do not ask again):\n${known.join('\n')}` : null,
    conversation.summary
      ? `Where this conversation stood (your own summary — messages since may include replies from the team):\n${conversation.summary}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  // Everything up to here is the client's side. If a model gives out half-way
  // the reply is started again from this point on the next model down — a turn
  // already produced cannot be handed to a different model.
  const opening = contents.length;
  let leadId: string | null = lead?.id ?? null;
  let handoffReason = '';
  let toSend: string[] = [];
  let handoff = false;
  let reply = '';

  // A greeting or a one-liner ("hi", "kifak", "thanks") does not need the
  // stronger model: the cheap one answers it in a couple of seconds for a
  // fraction of the cost. Anything with a number, a voice note or real content
  // goes to the tier chosen in settings.
  const unansweredText = ordered.filter((m) => unansweredIds.has(m.id)).map((m) => m.body).join(' ').trim();
  const simple =
    !hasVoice && unansweredText.length <= 40 && !/\d/.test(unansweredText) && !/\[\w+\]/.test(unansweredText);
  const order = chatModelOrder(simple ? 'economy' : settings.modelTier);
  const sessions: ChatSession[] = [];
  let toolLog: string[] = [];
  let turns = 0;
  const aiStarted = Date.now();
  for (let step = 0; ; step++) {
    const model = order[step];
    const lastChance = step === order.length - 1;
    // Skip a model that failed minutes ago — unless it is the last one left.
    if (chatModelResting(model) && !lastChance) continue;
    contents.length = opening;
    toSend = [];
    handoff = false;
    reply = '';
    toolLog = [];
    turns = 0;
    const session = new ChatSession(systemPrompt(context, settings.replyStyle, language.rule), TOOLS, { feature: 'chat-reply', conversationId }, model);
    sessions.push(session);
    try {
  for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
    const result = await session.send(contents);
    turns += 1;
    contents.push(result.content);
    // Text written alongside a search is "let me check" — not the answer. Only
    // a turn that ends the work (no call, or only bookkeeping calls) is the reply.
    if (result.text && result.calls.every((c) => FINISHING_TOOLS.has(c.name))) reply = result.text;
    if (result.calls.length === 0) break;

    const responses: ChatPart[] = [];
    for (const call of result.calls) {
      const args = call.args ?? {};
      // Models return "Lebanon" or "studio" as readily as the exact value asked for.
      for (const key of ['market', 'deal', 'kind', 'intent']) {
        if (typeof args[key] === 'string') args[key] = args[key].trim().toUpperCase().replace(/\s+/g, '_');
      }
      let response: Record<string, any> = { ok: true };

      if (call.name === 'search_listings') {
        const cards = await searchCatalogue({
          market: args.market === 'LEBANON' ? 'LEBANON' : 'GEORGIA',
          deal: args.deal === 'RENT' ? 'RENT' : 'SALE',
          area: typeof args.area === 'string' ? args.area : null,
          minBeds: Number.isFinite(args.minBeds) ? Number(args.minBeds) : null,
          budgetMax: Number.isFinite(args.budgetMax) ? Number(args.budgetMax) : null,
          kind: typeof args.kind === 'string' ? args.kind : null,
          readyOnly: args.readyOnly === true,
        });
        for (const c of cards) offered.add(c.ref.toUpperCase());
        toolLog.push(`search(${[args.market, args.deal, args.area, args.budgetMax && `<=${args.budgetMax}`, args.minBeds != null && `${args.minBeds}bd`, args.kind].filter(Boolean).join(' ')})=${cards.length}`);
        // The office's priority projects go first whenever they fit.
        const rank = (ref: string) => {
          const i = priorityOrder.indexOf(ref.toUpperCase());
          return i === -1 ? Number.MAX_SAFE_INTEGER : i;
        };
        cards.sort((a, b) => rank(a.ref) - rank(b.ref));
        // Deliberately not the URL or the photo: the model has no reason to
        // type either out, and the card carries both.
        response = {
          results: cards.map((c) => ({
            ...(rank(c.ref) !== Number.MAX_SAFE_INTEGER
              ? { priority: true, whyRecommend: pitchOf.get(c.ref.toUpperCase()) || undefined }
              : {}),
            ref: c.ref, title: c.title, location: c.location,
            kind: c.isProject ? 'project with several units' : c.type,
            deal: c.deal === 'RENT' ? 'for rent' : 'for sale',
            bedrooms: c.bedrooms, area: c.areaSqm, price: formatPrice(c),
            readiness: c.readiness, ...(c.handover ? { handover: c.handover } : {}),
          })),
        };
      } else if (call.name === 'get_property_details') {
        const details = typeof args.ref === 'string' ? await propertyDetails(args.ref) : null;
        if (details) offered.add(String(details.ref).toUpperCase());
        toolLog.push(`details(${args.ref})${details ? '' : '=none'}`);
        response = details ?? { error: 'No public, available property has that reference code.' };
      } else if (call.name === 'send_listings') {
        const refs: string[] = (Array.isArray(args.refs) ? args.refs : [])
          .map((r: unknown) => String(r).toUpperCase())
          .filter((r: string) => offered.has(r));
        toSend = [...new Set(refs)].slice(0, settings.maxListings);
        response = { queued: toSend };
        toolLog.push(`send(${toSend.join(' ') || 'none'})`);
      } else if (call.name === 'save_client_requirements') {
        // Somebody telling us what they want to buy is a client, whether or
        // not anyone is at a screen to say so. The assistant works unattended,
        // so it files them itself; the details still wait as a suggestion.
        if (!leadId) leadId = (await linkConversationToLead(conversationId, {}))?.id ?? null;
        await saveSuggestion(conversationId, leadId, args);
      } else if (call.name === 'save_voice_transcripts') {
        for (const t of Array.isArray(args.transcripts) ? args.transcripts : []) {
          const messageId = voiceNotes[Number(t?.note) - 1];
          if (messageId && typeof t?.text === 'string' && t.text.trim()) {
            await prisma.chatMessage.update({
              where: { id: messageId },
              data: { transcript: t.text.trim().slice(0, 4000) },
            });
            trace.heard = preview([trace.heard, t.text].filter(Boolean).join(' / '));
          }
        }
      } else if (call.name === 'update_conversation_summary') {
        const summary = typeof args.summary === 'string' ? args.summary.trim().slice(0, 1200) : '';
        if (summary) await prisma.conversation.update({ where: { id: conversationId }, data: { summary } });
      } else if (call.name === 'hand_off_to_team') {
        toolLog.push('handoff');
        handoff = true;
        handoffReason = typeof args.reason === 'string' ? args.reason.trim().slice(0, 200) : '';
      } else {
        response = { error: 'unknown tool' };
      }
      if (call.name === 'save_client_requirements') toolLog.push('requirements');

      responses.push({ functionResponse: { name: call.name, response, ...(call.id ? { id: call.id } : {}) } });
    }
    // The reply is written and everything else it asked for is bookkeeping:
    // done. Sending those results back would only cost another round trip.
    if (reply && result.calls.every((c) => FINISHING_TOOLS.has(c.name))) break;
    contents.push({ role: 'user', parts: responses });
  }

      // It used its tools (wrote down the voice note, searched) and stopped
      // without saying anything. The client is still waiting: ask for the reply.
      if (!reply) {
        contents.push({ role: 'user', parts: [{ text: '[Not from the client] You have not replied to the client yet. Write your reply to them now, following the language rule you were given.' }] });
        reply = (await session.send(contents, true)).text;
      }
      break;
    } catch (err) {
      if (!(err instanceof ChatModelUnavailableError)) throw err;
      if (!lastChance) {
        logger.warn('Chat AI: switching model', { conversationId, reason: err.message });
        continue;
      }
      // Every Gemini model is down. A client left in silence is the worst
      // outcome, so a plain holding reply is written by Claude instead: it
      // cannot hear voice notes or search stock, but it can answer a person.
      logger.warn('Chat AI: all Gemini models unavailable, using the text fallback', { conversationId });
      trace.fallback = 'claude';
      toSend = [];
      handoff = false;
      reply = await fallbackReply(ordered, unansweredIds, settings.replyStyle, defaultMarket).catch((fallbackErr) => {
        logger.error('Chat AI: text fallback failed too', fallbackErr, { conversationId });
        return '';
      });
      if (!reply) throw err;
      break;
    }
  }

  const spent = () => sessions.reduce((sum, x) => sum + x.spent.usd, 0);
  const lastSession = sessions[sessions.length - 1];
  Object.assign(trace, {
    model: lastSession?.modelId ?? 'claude-fallback',
    ...(sessions.length > 1 ? { modelsTried: sessions.length } : {}),
    turns,
    tools: toolLog.join(' ') || undefined,
    aiMs: Date.now() - aiStarted,
  });
  if (!reply) {
    trace.usd = spent().toFixed(4);
    return skip('The model returned no reply text.');
  }

  // Wrong script, or Gulf "9"s in Arabizi: fix it before the client sees it.
  const problem = languageProblem(reply, language.expect);
  if (problem && language.expect) {
    trace.scriptFix = problem;
    const fixed = await rewriteLanguage(reply, language.expect, conversationId);
    trace.scriptFixed = languageProblem(fixed.text, language.expect) === null;
    reply = fixed.text;
    trace.usd = (spent() + fixed.usd).toFixed(4);
  } else {
    trace.usd = spent().toFixed(4);
  }

  // Never the same words twice. It happened when a hand-off was repeated on a
  // thread kept "always on", and the client got two identical messages.
  const alreadySaid = recent.find(
    (m) => m.direction === 'OUT' && m.createdAt.getTime() > Date.now() - DAY_MS && (sameText(m.body, reply) || sameText(m.body.slice(0, reply.length), reply))
  );
  if (alreadySaid) {
    trace.reply = preview(reply);
    logger.warn('Auto-reply: held back a repeat of an earlier message', { conversationId, repeatOf: alreadySaid.id });
    return skip('The assistant wrote the same message it had already sent, so it held it back.');
  }

  // The client may have written again, or a person may have answered, while the
  // model was working. Never talk over either.
  const latest = await newestArrival();
  if (latest?.id !== latestId) {
    return skip('A new message arrived while the assistant was working, so it held back rather than talk over it.');
  }

  // One message: the reply, then the properties under it. The first one's
  // photo heads the message when the whole thing fits in a caption.
  const cards = await cardsByRef(toSend);
  const message = [reply, ...cards.map(cardCaption)].join('\n\n');
  const photo = cards.find((c) => c.image)?.image ?? undefined;
  await sendReply(conversationId, message, 'AI', message.length <= CAPTION_LIMIT ? photo : undefined);

  // Sending a property is the "Details sent" step of a deal — put it on the board.
  if (cards.length > 0) {
    // Being sent a property makes them a client too, for the same reason.
    if (!leadId) leadId = (await linkConversationToLead(conversationId, {}))?.id ?? null;
    if (leadId) await recordListingsShared(leadId, cards.map((c) => c.buildingId));
  }

  // A hand-off pauses the assistant so it does not carry on over the person
  // taking the conversation — unless a person asked for this reply themselves,
  // in which case they are already there and the pause would only confuse.
  if (handoff && !manual) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiPaused: true, aiPausedReason: handoffReason || 'It handed the conversation to the team', aiPausedAt: new Date() },
    });
  } else if (conversation.aiPaused && !manual) {
    // It was allowed to answer a paused thread (always-on, or the client came
    // back after a quiet day) — so the thread is the assistant's again.
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { aiPaused: false, aiPausedReason: null, aiPausedAt: null },
    });
  }
  Object.assign(trace, {
    waitedS: Math.round((Date.now() - waitingSince) / 1000),
    listings: cards.map((c) => c.ref).join(' ') || undefined,
    handoff: handoff ? handoffReason || 'yes' : undefined,
    chars: message.length,
    reply: preview(reply),
  });
  return {
    sent: true,
    reason: `Replied${cards.length ? ` with ${cards.length} propert${cards.length === 1 ? 'y' : 'ies'}` : ''}${handoff ? ' and handed over to the team' : ''}.`,
    trace,
  };
}

/**
 * Keep one open suggestion per thread, merged as the conversation goes on, so
 * the team sees the client's current picture rather than a pile of fragments.
 */
async function saveSuggestion(conversationId: string, leadId: string | null, args: Record<string, any>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (['BUYER', 'RENTER', 'SELLER', 'LANDLORD'].includes(args.intent)) patch.intent = args.intent;
  if (args.market === 'LEBANON' || args.market === 'GEORGIA') patch.market = args.market;
  if (typeof args.area === 'string' && args.area.trim()) patch.area = args.area.trim().slice(0, 120);
  if (Number.isFinite(args.minBeds) && args.minBeds >= 0 && args.minBeds <= 20) patch.minBeds = Math.round(args.minBeds);
  if (Number.isFinite(args.budgetMax) && args.budgetMax > 0) patch.budgetMax = Number(args.budgetMax);
  if (UNIT_KINDS.includes(args.kind)) patch.kind = args.kind;
  if (typeof args.isInvestor === 'boolean') patch.isInvestor = args.isInvestor;
  const summary = typeof args.summary === 'string' ? args.summary.trim().slice(0, 300) : '';
  if (!summary && Object.keys(patch).length === 0) return;

  const open = await prisma.leadSuggestion.findFirst({ where: { conversationId, status: 'PENDING' } });
  if (open) {
    await prisma.leadSuggestion.update({
      where: { id: open.id },
      data: {
        patch: { ...(open.patch as Record<string, unknown>), ...patch } as any,
        summary: summary || open.summary,
        leadId,
      },
    });
  } else {
    await prisma.leadSuggestion.create({
      data: { conversationId, leadId, patch: patch as any, summary: summary || 'Requirements from chat' },
    });
  }
}
