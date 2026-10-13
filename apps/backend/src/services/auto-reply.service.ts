import { prisma } from '@propgroup/db';
import { ChatSession, chatAiEnabled, type ChatContent, type ChatPart, type ChatTool } from '../config/chat-ai.js';
import { aiBudget } from '../utils/ai-budget.js';
import { logger } from '../utils/logger.js';
import { cardCaption, cardsByRef, formatPrice, marketNames, projectsNamedIn, searchCatalogue, type Market } from './catalogue.service.js';
import { recordListingsShared } from './deal-sync.service.js';
import { getChatAiSettings } from './ai-settings.service.js';
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

/** Replies per thread per 24h. A conversation needing more than this needs a person. */
const PER_THREAD_LIMIT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** People send three short messages in a row; answer once, after they stop. */
const DEBOUNCE_MS = 12_000;
/** WhatsApp cuts a photo caption at 1024 characters. */
const CAPTION_LIMIT = 1000;
const HISTORY_MESSAGES = 24;
/** Voice notes and photos from the unanswered messages that are handed to the model. */
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const MAX_MODEL_TURNS = 4;
const MAX_LISTINGS = 3;

const pending = new Map<string, NodeJS.Timeout>();

export function autoReplyEnabled(): boolean {
  return process.env.AUTO_REPLY_ENABLED === 'true' && chatAiEnabled();
}

const envNumber = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Queue a reply for this thread. Safe to call on every inbound message. */
export function scheduleAutoReply(conversationId: string): void {
  if (!autoReplyEnabled()) return;
  clearTimeout(pending.get(conversationId));
  pending.set(
    conversationId,
    setTimeout(() => {
      pending.delete(conversationId);
      void run(conversationId, false)
        // Every outcome is logged with its reason: "it did not reply" must
        // always be answerable from the log without guessing.
        .then((outcome) => logger.info(`Auto-reply: ${outcome.sent ? 'sent' : 'not sent'}`, { conversationId, reason: outcome.reason }))
        .catch((err) => logger.error('Auto-reply failed', { conversationId, error: (err as Error).message }));
    }, DEBOUNCE_MS)
  );
}

export interface AutoReplyOutcome {
  sent: boolean;
  /** Why, in words somebody can act on. */
  reason: string;
}

/**
 * Have the assistant answer this thread now, because a person asked it to.
 * Skips the checks that exist to keep it out of a person's way (who it
 * answers, the pause, "someone already replied") and keeps every one that
 * protects the client or the bill. Throws with the real error if the model or
 * the send fails, so the cause reaches the screen.
 */
export function runAutoReplyNow(conversationId: string): Promise<AutoReplyOutcome> {
  return run(conversationId, true);
}

/** Would the assistant answer the next message on this thread, and if not, why? */
export async function autoReplyStatus(conversationId: string): Promise<AutoReplyOutcome> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { lead: { select: { adId: true, source: true } } },
  });
  if (!conversation) return { sent: false, reason: 'Conversation not found.' };
  const blocked = await standingBlock(conversation, await getChatAiSettings(), false);
  return blocked ? { sent: false, reason: blocked } : { sent: true, reason: 'It will answer the next message.' };
}

/**
 * The reasons that hold whatever the client writes next. `manual` drops the
 * ones that only exist to keep the assistant out of a person's way.
 */
async function standingBlock(
  conversation: { id: string; channel: 'WHATSAPP' | 'INSTAGRAM'; aiPaused: boolean; adId: string | null; lastInboundAt: Date | null; lead: { adId: string | null; source: string } | null },
  settings: { enabled: boolean; audience: 'ads' | 'all' },
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
    if (conversation.aiPaused) return 'Auto-reply is paused on this conversation.';
    if (settings.audience !== 'all') {
      const fromAd =
        Boolean(conversation.adId) || Boolean(conversation.lead?.adId) || conversation.lead?.source === 'FACEBOOK_AD';
      if (!fromAd) return 'This person did not come from an ad or a lead form, and the settings say to answer only those.';
    }
    // A person replied from the phone or the CRM: the thread is theirs now.
    const humanReplied = await prisma.chatMessage.count({
      where: {
        conversationId: conversation.id, direction: 'OUT',
        sentAt: { gte: new Date(Date.now() - DAY_MS) }, NOT: { origin: 'AI' },
      },
    });
    if (humanReplied > 0) return 'Someone on the team replied on this conversation in the last 24 hours, so the assistant is staying out of it.';
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
      },
      required: ['market'],
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
    name: 'hand_off_to_team',
    description:
      'Pass the conversation to a person. Use when the client asks for one, is upset, wants to negotiate or book a viewing, or asks something you cannot answer. Still write a short reply telling them a colleague will message them.',
    parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] },
  },
];

function systemPrompt(context: string): string {
  return `You are the assistant for PropGroup, a real estate brokerage, replying to a client on WhatsApp or Instagram. PropGroup sells and rents property in Lebanon and sells investment property abroad, mainly in Georgia.

How to write:
- Reply in the language the client uses, and the same script. Lebanese Arabic in Arabic letters gets Lebanese Arabic in Arabic letters; Arabic typed in Latin letters and numbers (e.g. "badde shi2a") gets the same style back; English gets English; French gets French. Never ask which language they prefer.
- Write like a helpful person texting: one to three short sentences, at most one question at a time. No lists, no markdown, no emojis unless the client uses them.
- If the client sends a voice note, listen to it and answer what it says as if they had typed it.

What to do:
- Work out what they need from what you already know, and ask only for what is genuinely missing, one question at a time. Never ask something the ad they came from, their earlier messages or the notes below already answer.
- Each reply is one message and costs money to send. Say everything for this turn in that one reply; never plan a follow-up message.
- As soon as you know the country and either a budget, an area or a project, call search_listings and attach the best matches with send_listings. Two or three well-matched options beat many. If nothing fits, say so plainly and ask what they could flex on.
- Each time the client tells you a requirement, call save_client_requirements.

How the two markets work:
- Abroad (Georgia) PropGroup sells PROJECTS: developments with several unit types and a "from" price. It is always a purchase, usually for investment. Never ask a Georgia client whether they want to buy or rent, never offer rentals, and do not bring up Lebanon unless they do. Useful questions there are budget, unit size, and when they want to buy.
- Lebanon is sold property by property, and a property is either for sale or for rent — ask which if it is not clear, and pass it to search_listings.

Hard rules:
- Describe a property only as search_listings returned it — its name, its location and its price exactly as given. If a result is somewhere other than where the client asked, say so; never relabel it to match their request.
- If a place or project name in a voice note is unclear, or is not one we have stock in, ask the client to confirm it before searching.
- Only state facts about a property that search_listings returned. Never invent or estimate a price, availability, yield, payment plan, delivery date or legal detail.
- Never mention owners, sellers, developers' terms, commission, fees, discounts or anything about how PropGroup is paid. If asked, say a colleague will go through the details.
- Never negotiate, never confirm a viewing time, never ask for ID or payment details.
- If the client wants a person, is upset, wants to negotiate or book a viewing, or asks something you cannot answer, call hand_off_to_team and tell them a member of the team will message them shortly.

${context}`;
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

async function run(conversationId: string, manual: boolean): Promise<AutoReplyOutcome> {
  const skip = (reason: string): AutoReplyOutcome => ({ sent: false, reason });
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
  const recent = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { sentAt: 'desc' },
    take: HISTORY_MESSAGES,
  });
  // Only answer a client who is actually waiting on us.
  if (recent.length === 0) return skip('There are no messages on this conversation yet.');
  if (recent[0].direction !== 'IN') return skip('The last message is ours — the client is not waiting on a reply.');
  const latestId = recent[0].id;

  const [threadCount, globalCount] = await Promise.all([
    prisma.chatMessage.count({ where: { conversationId, origin: 'AI', sentAt: { gte: since } } }),
    prisma.chatMessage.count({ where: { origin: 'AI', sentAt: { gte: since } } }),
  ]);
  if (!manual && threadCount >= PER_THREAD_LIMIT) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { aiPaused: true } });
    return skip(`The assistant has already sent ${PER_THREAD_LIMIT} replies here today, so it has paused for a person to take over.`);
  }
  if (globalCount >= envNumber('AUTO_REPLY_DAILY_LIMIT', 200)) {
    return skip('The daily limit on assistant messages has been reached (AUTO_REPLY_DAILY_LIMIT).');
  }

  // Oldest first. The messages the client sent since our last reply are the
  // ones being answered — only those have their voice notes and photos attached.
  const ordered = [...recent].reverse();
  const lastOut = ordered.map((m) => m.direction).lastIndexOf('OUT');
  const voiceNotes: string[] = []; // message ids, by voice-note number
  let attached = 0;

  const contents: ChatContent[] = [];
  for (const [i, m] of ordered.entries()) {
    const role = m.direction === 'IN' ? 'user' : 'model';
    const parts: ChatPart[] = [];
    const unanswered = i > lastOut && m.direction === 'IN';
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
      parts.push({ text: m.transcript && isAudio ? `[voice note] ${m.transcript}` : m.body });
    }

    const last = contents[contents.length - 1];
    if (last?.role === role) last.parts.push(...parts);
    else contents.push({ role, parts });
  }
  while (contents.length > 0 && contents[0].role !== 'user') contents.shift();
  if (contents.length === 0) return skip('There is nothing from the client to answer.');

  // Reference codes the model may attach: search results and the ad's project.
  const offered = new Set<string>();

  const lead = conversation.lead;
  const defaultMarket: Market =
    lead?.market ?? ((process.env.LEAD_MARKET_WHATSAPP ?? '').toUpperCase() === 'LEBANON' ? 'LEBANON' : 'GEORGIA');
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
  const preferred = preferredCards.length
    ? [
        'The client has not named a project. Ask their budget and where they would like to be (one question at a time, skipping whatever you already know). Then recommend from the office\'s preferred list below, most wanted first, choosing those that fit their budget and location — you may attach them with send_listings without searching. If none of them fits, use search_listings instead; never push one that is clearly over their budget.',
        ...preferredCards.map((c, i) => {
          const pitch = pitchOf.get(c.ref.toUpperCase());
          return `${i + 1}. ${c.title} (${c.ref}) — ${c.location || 'location on the page'}, ${formatPrice(c)}${pitch ? `. Why recommend it: ${pitch}` : ''}`;
        }),
      ].join('\n')
    : null;

  const names = await marketNames(defaultMarket);

  const context = [
    ad,
    preferred,
    settings.guidance ? `From the office:\n${settings.guidance}` : null,
    `Unless they say otherwise, this is about ${defaultMarket === 'LEBANON' ? 'Lebanon' : 'Georgia'} — do not ask which country.`,
    names.places.length
      ? `Places we have stock in there: ${names.places.join(', ')}.${names.projects.length ? ` Projects: ${names.projects.join(', ')}.` : ''} A name you hear that sounds like one of these is that one.`
      : null,
    known.length ? `What we already know (do not ask again):\n${known.join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const session = new ChatSession(systemPrompt(context), TOOLS, { feature: 'chat-reply', conversationId });

  let toSend: string[] = [];
  let handoff = false;
  let reply = '';

  for (let turn = 0; turn < MAX_MODEL_TURNS; turn++) {
    const result = await session.send(contents);
    contents.push(result.content);
    if (result.text) reply = result.text;
    if (result.calls.length === 0) break;

    const responses: ChatPart[] = [];
    for (const call of result.calls) {
      const args = call.args ?? {};
      let response: Record<string, any> = { ok: true };

      if (call.name === 'search_listings') {
        const cards = await searchCatalogue({
          market: args.market === 'LEBANON' ? 'LEBANON' : 'GEORGIA',
          deal: args.deal === 'RENT' ? 'RENT' : 'SALE',
          area: typeof args.area === 'string' ? args.area : null,
          minBeds: Number.isFinite(args.minBeds) ? Number(args.minBeds) : null,
          budgetMax: Number.isFinite(args.budgetMax) ? Number(args.budgetMax) : null,
          kind: typeof args.kind === 'string' ? args.kind : null,
        });
        for (const c of cards) offered.add(c.ref.toUpperCase());
        // Deliberately not the URL or the photo: the model has no reason to
        // type either out, and the card carries both.
        response = {
          results: cards.map((c) => ({
            ref: c.ref, title: c.title, location: c.location,
            kind: c.isProject ? 'project with several units' : c.type,
            deal: c.deal === 'RENT' ? 'for rent' : 'for sale',
            bedrooms: c.bedrooms, area: c.areaSqm, price: formatPrice(c),
          })),
        };
      } else if (call.name === 'send_listings') {
        const refs: string[] = (Array.isArray(args.refs) ? args.refs : [])
          .map((r: unknown) => String(r).toUpperCase())
          .filter((r: string) => offered.has(r));
        toSend = [...new Set(refs)].slice(0, MAX_LISTINGS);
        response = { queued: toSend };
      } else if (call.name === 'save_client_requirements') {
        await saveSuggestion(conversationId, lead?.id ?? null, args);
      } else if (call.name === 'save_voice_transcripts') {
        for (const t of Array.isArray(args.transcripts) ? args.transcripts : []) {
          const messageId = voiceNotes[Number(t?.note) - 1];
          if (messageId && typeof t?.text === 'string' && t.text.trim()) {
            await prisma.chatMessage.update({
              where: { id: messageId },
              data: { transcript: t.text.trim().slice(0, 4000) },
            });
          }
        }
      } else if (call.name === 'hand_off_to_team') {
        handoff = true;
      } else {
        response = { error: 'unknown tool' };
      }

      responses.push({ functionResponse: { name: call.name, response, ...(call.id ? { id: call.id } : {}) } });
    }
    contents.push({ role: 'user', parts: responses });
  }

  if (!reply) return skip('The model returned no reply text.');

  // The client may have written again, or a person may have answered, while the
  // model was working. Never talk over either.
  const latest = await prisma.chatMessage.findFirst({
    where: { conversationId },
    orderBy: { sentAt: 'desc' },
    select: { id: true },
  });
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
  if (lead && cards.length > 0) {
    await recordListingsShared(lead.id, cards.map((c) => c.buildingId));
  }

  if (handoff) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { aiPaused: true } });
  }
  return { sent: true, reason: `Replied${cards.length ? ` with ${cards.length} propert${cards.length === 1 ? 'y' : 'ies'}` : ''}${handoff ? ' and handed over to the team' : ''}.` };
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
