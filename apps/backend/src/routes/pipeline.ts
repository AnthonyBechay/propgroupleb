import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireCrm } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

// ─────────────────────────────────────────────────────────────────────────────
// The front of the pipeline: people, before there is a deal.
//
// The board used to start with property deals — "Enquiry", "Details sent" — so
// a client the assistant sent ten projects to became ten cards, which said
// nothing true. Before a viewing or a meeting, what matters is the PERSON and
// who is talking to them:
//
//   New        — they reached out; nobody has answered yet
//   Assistant  — the assistant is handling the conversation
//   With you   — it needs a person: handed over, waiting on a reply the
//                assistant will not give, or the team is already talking
//
// Property deals start at "Viewing / meeting booked" and come from /deals.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

router.use(authenticateToken, requireCrm);

/** Deal stages that put a client on the property side of the board instead. */
const ADVANCED = ['VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'RESERVED'];
/** Properties sent or picked, but nothing booked. */
const SHORTLISTED = ['SUGGESTED', 'SHARED'];
/** Unanswered for this long and the assistant has not picked it up: a person is needed. */
const WAITING_MS = 10 * 60 * 1000;
/** An inbound lead with no conversation drops off the front of the board after this. */
const FRESH_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Where a lead came in by itself — the only kind that belongs in "New" without
 * a conversation. A client the team typed in, imported, or met by phone has
 * already been spoken to; it lives in the client list, not at the front of a
 * board about who is reaching out.
 */
const INBOUND_SOURCES = ['FACEBOOK_AD', 'INQUIRY', 'WHATSAPP', 'FAVORITE'];
/** Selling or renting out: someone to list, not someone to show property to. */
const SUPPLY = ['SELLER', 'LANDLORD'];

type Bucket = 'NEW' | 'ASSISTANT' | 'WITH_YOU';

// GET /api/crm/pipeline — open clients who have not reached a viewing yet
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const market = req.query.market;
    const now = Date.now();

    const leads = await prisma.lead.findMany({
      where: {
        status: { notIn: ['WON', 'LOST', 'ARCHIVED'] },
        ...(market === 'LEBANON' || market === 'GEORGIA' ? { market } : {}),
        opportunities: { none: { stage: { in: ADVANCED as never } } },
        // Someone in a live conversation, or a lead that came in on its own in
        // the last month (an ad form, a website enquiry). Everybody else is in
        // the client list.
        OR: [
          { conversations: { some: { archivedAt: null } } },
          { source: { in: INBOUND_SOURCES as never }, createdAt: { gte: new Date(now - FRESH_MS) } },
        ],
      },
      select: {
        id: true, name: true, market: true, type: true, intents: true, isInvestor: true, source: true,
        adLabel: true, askingFor: true, budgetMax: true, lastContactAt: true, createdAt: true,
        opportunities: { select: { stage: true } },
        conversations: {
          where: { archivedAt: null },
          orderBy: { lastMessageAt: 'desc' },
          take: 1,
          select: {
            id: true, channel: true, lastMessageAt: true, lastPreview: true, unreadCount: true,
            aiPaused: true, aiPausedReason: true,
            suggestions: { where: { status: 'PENDING' }, select: { id: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });

    // Who spoke last on each thread, and when it actually arrived.
    const ids = leads.flatMap((l) => l.conversations.map((c) => c.id));
    const [lastOut, lastIn] = ids.length
      ? await Promise.all([
          prisma.chatMessage.findMany({
            where: { conversationId: { in: ids }, direction: 'OUT' },
            distinct: ['conversationId'],
            orderBy: { createdAt: 'desc' },
            select: { conversationId: true, origin: true, createdAt: true },
          }),
          prisma.chatMessage.findMany({
            where: { conversationId: { in: ids }, direction: 'IN' },
            distinct: ['conversationId'],
            orderBy: { createdAt: 'desc' },
            select: { conversationId: true, createdAt: true },
          }),
        ])
      : [[], []];
    const outOf = new Map(lastOut.map((m) => [m.conversationId, m]));
    const inOf = new Map(lastIn.map((m) => [m.conversationId, m]));

    // A seller or landlord with no buyer side is not someone to book a viewing
    // for — unless they are actually writing to us.
    const relevant = leads.filter(
      (l) => l.conversations.length > 0 || !(l.intents.length ? l.intents : [l.type]).every((t) => SUPPLY.includes(t))
    );

    const clients = relevant.map((l) => {
      const chat = l.conversations[0] ?? null;
      const out = chat ? outOf.get(chat.id) : undefined;
      const inbound = chat ? inOf.get(chat.id) : undefined;
      const waitingSince =
        inbound && (!out || inbound.createdAt > out.createdAt) ? inbound.createdAt : null;
      const waitingLong = waitingSince !== null && now - waitingSince.getTime() > WAITING_MS;

      // Who spoke last: the client, the assistant, or one of us.
      const lastFrom: 'client' | 'assistant' | 'team' | null = waitingSince
        ? 'client'
        : out
          ? out.origin === 'AI' ? 'assistant' : 'team'
          : null;

      let bucket: Bucket;
      let reason: string | null = null;
      if (chat?.aiPaused) {
        bucket = 'WITH_YOU';
        reason = chat.aiPausedReason ?? 'The assistant handed this to the team';
      } else if (!out && !l.lastContactAt) {
        bucket = waitingLong && chat ? 'WITH_YOU' : 'NEW';
        if (bucket === 'WITH_YOU') reason = 'Nobody has answered, and the assistant is not replying here';
      } else if (out?.origin === 'AI') {
        bucket = waitingLong ? 'WITH_YOU' : 'ASSISTANT';
        if (waitingLong) reason = 'Waiting for a reply the assistant has not sent';
      } else {
        bucket = 'WITH_YOU';
        reason = waitingSince
          ? 'They replied to you'
          : out
            ? 'You are talking to them'
            : 'Contacted outside the chat';
      }

      return {
        id: l.id,
        name: l.name,
        market: l.market,
        type: l.type,
        isInvestor: l.isInvestor,
        source: l.source,
        adLabel: l.adLabel,
        askingFor: l.askingFor,
        budgetMax: l.budgetMax,
        bucket,
        reason,
        lastFrom,
        supplyOnly: (l.intents.length ? l.intents : [l.type]).every((t) => SUPPLY.includes(t)),
        waitingSince,
        shortlisted: l.opportunities.filter((o) => SHORTLISTED.includes(o.stage)).length,
        chat: chat
          ? {
              id: chat.id,
              channel: chat.channel,
              lastMessageAt: chat.lastMessageAt,
              lastPreview: chat.lastPreview,
              unread: chat.unreadCount,
              detailsToConfirm: chat.suggestions.length > 0,
            }
          : null,
        lastActivity: chat?.lastMessageAt ?? l.lastContactAt ?? l.createdAt,
      };
    });

    // Most urgent first within each column: waiting longest, then most recent.
    clients.sort((a, b) => {
      if (a.waitingSince && b.waitingSince) return a.waitingSince.getTime() - b.waitingSince.getTime();
      if (a.waitingSince) return -1;
      if (b.waitingSince) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    sendSuccess(res, clients);
  })
);

export default router;
