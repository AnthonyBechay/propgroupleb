import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireCrm, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { deleteFile, extractKeyFromUrl } from '../services/upload.service.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { linkConversationToLead } from '../services/messaging-intake.service.js';
import { canSendOn, replyWindowOpen, sendReply } from '../services/messaging-send.service.js';
import { autoReplyEnabled, autoReplyStatus, runAutoReplyNow } from '../services/auto-reply.service.js';
import { cardCaption, cardsByRef, searchCatalogue, type Market } from '../services/catalogue.service.js';
import { AppError } from '../utils/errors.js';
import { recordListingsShared } from '../services/deal-sync.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// CRM inbox — WhatsApp and Instagram threads mirrored from Meta's webhooks
// (routes/webhooks.ts). Replies typed in the phone apps arrive here as echoes;
// replies typed here go out through services/messaging-send.service.ts.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

router.use(authenticateToken, requireCrm);

// GET /api/crm/inbox — threads, most recent first
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const channel = req.query.channel;
    // Archived threads are out of the way unless asked for.
    const archived = req.query.archived === 'true';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = {
      archivedAt: archived ? { not: null } : null,
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' as const } },
              { externalId: { contains: search.replace(/[^\d\w]/g, '') || search } },
              { lastPreview: { contains: search, mode: 'insensitive' as const } },
              { lead: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
      ...(channel === 'WHATSAPP' || channel === 'INSTAGRAM' ? { channel: channel as 'WHATSAPP' | 'INSTAGRAM' } : {}),
      ...(req.query.unread === 'true' ? { unreadCount: { gt: 0 } } : {}),
      ...(typeof req.query.leadId === 'string' ? { leadId: req.query.leadId } : {}),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          lead: { select: { id: true, name: true, status: true, market: true } },
          // Only to know whether anybody has answered yet.
          messages: { where: { direction: 'OUT' }, select: { id: true }, take: 1 },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    sendPaginated(
      res,
      conversations.map(({ messages, ...c }) => ({ ...c, answered: messages.length > 0 })),
      buildPaginationResponse(page, limit, total)
    );
  })
);

// GET /api/crm/inbox/:id — one thread with its latest messages, oldest first
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { lead: { select: { id: true, name: true, status: true, market: true } } },
    });
    if (!conversation) {
      sendNotFound(res, 'Conversation');
      return;
    }

    // Newest first from the database, so a long thread opens on its latest
    // messages; `take` grows when the reader asks for earlier ones.
    const take = Math.min(2000, Math.max(1, Number(req.query.take) || 100));
    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { sentAt: 'desc' },
        take,
      }),
      prisma.chatMessage.count({ where: { conversationId: conversation.id } }),
    ]);

    sendSuccess(res, {
      ...conversation,
      messages: messages.reverse(),
      hasEarlier: total > messages.length,
      // Why the reply box is or is not usable, so the UI can say so up front.
      suggestion: await prisma.leadSuggestion.findFirst({
        where: { conversationId: conversation.id, status: 'PENDING' },
      }),
      canReply: canSendOn(conversation.channel) && replyWindowOpen(conversation.lastInboundAt),
      sendingConfigured: canSendOn(conversation.channel),
      autoReplyOn: autoReplyEnabled(),
      // Whether the assistant would answer THIS thread's next message — and
      // when it would not, the reason, so nobody has to guess.
      autoReply: await autoReplyStatus(conversation.id),
    });
  })
);

// GET /api/crm/inbox/by-lead/:leadId — a client's threads with their latest
// messages, for the activity tab of the client drawer
router.get(
  '/by-lead/:leadId',
  asyncHandler(async (req: Request, res: Response) => {
    const conversations = await prisma.conversation.findMany({
      where: { leadId: req.params.leadId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: { orderBy: { sentAt: 'desc' }, take: 12 },
        suggestions: { where: { status: 'PENDING' }, take: 1 },
      },
    });
    sendSuccess(
      res,
      conversations.map((c) => ({ ...c, messages: [...c.messages].reverse() }))
    );
  })
);

// ── What the chat AI understood, waiting for a person ────────────────────────

const UNIT_KINDS = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL'];

// POST /api/crm/inbox/suggestions/:sid/accept — apply it to the client
router.post(
  '/suggestions/:sid/accept',
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const suggestion = await prisma.leadSuggestion.findUnique({ where: { id: req.params.sid } });
    if (!suggestion || suggestion.status !== 'PENDING') {
      sendNotFound(res, 'Suggestion');
      return;
    }

    // Accepting what a stranger wants is also the decision that they are a client.
    const lead = await linkConversationToLead(suggestion.conversationId, {
      leadId: suggestion.leadId ?? undefined,
      createdBy: authReq.user?.id ?? null,
    });
    if (!lead) {
      sendNotFound(res, 'Conversation');
      return;
    }

    const patch = (suggestion.patch ?? {}) as Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {};
    const changes: string[] = [];
    const note = (label: string, from: unknown, to: unknown) =>
      changes.push(from === null || from === undefined || from === '' ? `${label}: ${to}` : `${label}: ${from} → ${to}`);

    if (['BUYER', 'RENTER', 'SELLER', 'LANDLORD'].includes(patch.intent) && patch.intent !== lead.type) {
      data.type = patch.intent;
      data.intents = Array.from(new Set([patch.intent, ...(lead.intents ?? [])]));
      note('Looking to', lead.type, patch.intent);
    }
    if ((patch.market === 'LEBANON' || patch.market === 'GEORGIA') && patch.market !== lead.market) {
      data.market = patch.market;
      note('Market', lead.market, patch.market);
    }
    if (Number.isFinite(patch.budgetMax) && patch.budgetMax !== lead.budgetMax) {
      data.budgetMax = patch.budgetMax;
      note('Budget up to', lead.budgetMax, patch.budgetMax);
    }
    if (Number.isInteger(patch.minBeds) && patch.minBeds !== lead.minBeds) {
      data.minBeds = patch.minBeds;
      note('Bedrooms from', lead.minBeds, patch.minBeds);
    }
    if (UNIT_KINDS.includes(patch.kind) && !(lead.unitKinds ?? []).includes(patch.kind)) {
      data.unitKinds = [...(lead.unitKinds ?? []), patch.kind];
      note('Property type', null, patch.kind);
    }
    if (typeof patch.isInvestor === 'boolean' && patch.isInvestor !== lead.isInvestor) {
      data.isInvestor = patch.isInvestor;
      note('Investor', lead.isInvestor ? 'yes' : 'no', patch.isInvestor ? 'yes' : 'no');
    }
    // Areas on a client come from the curated location catalogue, so a name
    // the client typed goes into the free-text line, not into `areas`.
    const asking = [suggestion.summary, patch.area ? `Area: ${patch.area}` : null].filter(Boolean).join(' · ');
    if (asking && asking !== lead.askingFor) {
      data.askingFor = asking.slice(0, 200);
      note('Asking for', lead.askingFor, asking);
    }

    await prisma.$transaction([
      prisma.lead.update({ where: { id: lead.id }, data }),
      prisma.leadSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'ACCEPTED', leadId: lead.id, resolvedAt: new Date(), resolvedBy: authReq.user?.id ?? null },
      }),
      // The trail: what changed, from what, and that it came from the chat.
      prisma.leadContact.create({
        data: {
          leadId: lead.id,
          channel: 'NOTE',
          body: `Updated from chat\n${changes.join('\n') || suggestion.summary}`.slice(0, 4000),
          createdBy: authReq.user?.id ?? null,
        },
      }),
    ]);
    await logAdminAction('ACCEPT_CHAT_SUGGESTION', 'lead', lead.id, { changes }, authReq);
    sendSuccess(res, { leadId: lead.id, changes });
  })
);

// POST /api/crm/inbox/suggestions/:sid/dismiss
router.post(
  '/suggestions/:sid/dismiss',
  asyncHandler(async (req: Request, res: Response) => {
    const { count } = await prisma.leadSuggestion.updateMany({
      where: { id: req.params.sid, status: 'PENDING' },
      data: { status: 'DISMISSED', resolvedAt: new Date(), resolvedBy: (req as AuthenticatedRequest).user?.id ?? null },
    });
    if (count === 0) {
      sendNotFound(res, 'Suggestion');
      return;
    }
    sendSuccess(res, null);
  })
);

// ── Offering stock from the thread ───────────────────────────────────────────

// GET /api/crm/inbox/:id/listings — public stock that fits this client
router.get(
  '/:id/listings',
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        lead: { select: { market: true, budgetMax: true, minBeds: true, unitKinds: true, type: true } },
        suggestions: { where: { status: 'PENDING' }, take: 1 },
      },
    });
    if (!conversation) {
      sendNotFound(res, 'Conversation');
      return;
    }
    // What they said in this chat wins over what is on file — it is newer.
    const said = (conversation.suggestions[0]?.patch ?? {}) as Record<string, any>;
    const lead = conversation.lead;
    const market: Market =
      said.market ?? lead?.market ??
      ((process.env.LEAD_MARKET_WHATSAPP ?? '').toUpperCase() === 'LEBANON' ? 'LEBANON' : 'GEORGIA');

    // Selling or renting out is not a search for stock; only a renter rents.
    const intent = said.intent ?? lead?.type;
    const query = {
      market,
      deal: (req.query.deal === 'RENT' || (req.query.deal !== 'SALE' && intent === 'RENTER') ? 'RENT' : 'SALE') as 'RENT' | 'SALE',
      area: typeof req.query.area === 'string' ? req.query.area : said.area ?? null,
      budgetMax: said.budgetMax ?? lead?.budgetMax ?? null,
      minBeds: said.minBeds ?? lead?.minBeds ?? null,
      kind: said.kind ?? null,
      limit: 8,
    };
    let cards = await searchCatalogue(query);
    // Nothing in the area they named: show what fits the budget anyway, rather
    // than an empty box.
    if (cards.length === 0 && query.area) cards = await searchCatalogue({ ...query, area: null });
    sendSuccess(res, {
      basis: { market, deal: query.deal, budgetMax: query.budgetMax, minBeds: query.minBeds, area: query.area },
      cards,
    });
  })
);

// POST /api/crm/inbox/:id/listings — send one as a photo card
router.post(
  '/:id/listings',
  asyncHandler(async (req: Request, res: Response) => {
    const { ref } = z.object({ ref: z.string().trim().min(1).max(40) }).parse(req.body);
    const [card] = await cardsByRef([ref]);
    if (!card) throw new AppError('That property is not publicly available', 404);
    await sendReply(req.params.id, cardCaption(card), 'CRM', card.image ?? undefined);
    // Sending a property is the "Details sent" step of a deal — put it on the board.
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      select: { leadId: true },
    });
    if (conversation?.leadId) {
      await recordListingsShared(conversation.leadId, [card.buildingId], (req as AuthenticatedRequest).user?.id);
    }
    await logAdminAction('INBOX_SEND_LISTING', 'Conversation', req.params.id, { ref: card.ref }, req as AuthenticatedRequest);
    sendSuccess(res, null);
  })
);

// GET /api/crm/inbox/unread/count — badge for the CRM toolbar
router.get(
  '/unread/count',
  asyncHandler(async (_req: Request, res: Response) => {
    const count = await prisma.conversation.count({ where: { unreadCount: { gt: 0 }, archivedAt: null } });
    sendSuccess(res, { count });
  })
);

// POST /api/crm/inbox/:id/reply — send a message on the thread
router.post(
  '/:id/reply',
  asyncHandler(async (req: Request, res: Response) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(4000) }).parse(req.body);
    await sendReply(req.params.id, text, 'CRM');
    await logAdminAction('INBOX_REPLY', 'Conversation', req.params.id, {}, req as AuthenticatedRequest);
    sendSuccess(res, null);
  })
);

// POST /api/crm/inbox/:id/archive — hide from the list (or bring back). A new
// message from them brings it back on its own.
router.post(
  '/:id/archive',
  asyncHandler(async (req: Request, res: Response) => {
    const { archived } = z.object({ archived: z.boolean() }).parse(req.body);
    const { count } = await prisma.conversation.updateMany({
      where: { id: req.params.id },
      data: { archivedAt: archived ? new Date() : null, ...(archived ? { unreadCount: 0 } : {}) },
    });
    if (count === 0) {
      sendNotFound(res, 'Conversation');
      return;
    }
    sendSuccess(res, { archived });
  })
);

// DELETE /api/crm/inbox/:id — remove the conversation from the CRM for good:
// its messages, transcripts, stored photos and voice notes. The client record,
// their deals and the chat on the phone are not touched. Admin only.
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { where: { mediaUrl: { not: null } }, select: { mediaUrl: true } } },
    });
    if (!conversation) {
      sendNotFound(res, 'Conversation');
      return;
    }

    // Only files this inbox stored itself — a property photo it merely linked
    // to belongs to the listing and must stay.
    const keys = conversation.messages
      .map((m) => extractKeyFromUrl(m.mediaUrl as string))
      .filter((k): k is string => Boolean(k && k.startsWith('chats/')));
    for (const key of keys) {
      await deleteFile(key).catch((err) => logger.warn('Chat file not deleted', { key, error: (err as Error).message }));
    }

    await prisma.conversation.delete({ where: { id: conversation.id } });
    await logAdminAction(
      'DELETE_CONVERSATION', 'Conversation', conversation.id,
      { channel: conversation.channel, files: keys.length, leadId: conversation.leadId },
      req as AuthenticatedRequest
    );
    logger.info('Conversation deleted', { conversation: conversation.id, files: keys.length });
    sendSuccess(res, null);
  })
);

// POST /api/crm/inbox/:id/ai-reply — have the assistant answer now. Also the
// way to find out why it is not answering: the outcome comes back in words.
router.post(
  '/:id/ai-reply',
  asyncHandler(async (req: Request, res: Response) => {
    let outcome;
    try {
      outcome = await runAutoReplyNow(req.params.id);
    } catch (err) {
      // The model or the send failed. That message is the diagnosis.
      outcome = { sent: false, reason: (err as Error).message };
    }
    await logAdminAction('INBOX_AI_REPLY', 'Conversation', req.params.id, { sent: outcome.sent }, req as AuthenticatedRequest);
    sendSuccess(res, outcome);
  })
);

// POST /api/crm/inbox/:id/lead — make the sender a client, or attach to one
router.post(
  '/:id/lead',
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({ leadId: z.string().optional(), name: z.string().trim().max(120).optional() })
      .parse(req.body ?? {});
    const lead = await linkConversationToLead(req.params.id, {
      ...body,
      createdBy: (req as AuthenticatedRequest).user?.id ?? null,
    });
    if (!lead) {
      sendNotFound(res, 'Conversation or client');
      return;
    }
    await logAdminAction('INBOX_LINK_CLIENT', 'Conversation', req.params.id, { leadId: lead.id }, req as AuthenticatedRequest);
    sendSuccess(res, { leadId: lead.id });
  })
);

// PATCH /api/crm/inbox/:id — pause or resume automatic replies on one thread
router.patch(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const body = z
      .object({ aiPaused: z.boolean().optional(), aiAlways: z.boolean().optional() })
      .parse(req.body);
    const { count } = await prisma.conversation.updateMany({
      where: { id: req.params.id },
      data: {
        // Resuming hands the thread back to the assistant for 24 hours, even
        // though a person has been replying on it.
        ...(body.aiPaused === true
          ? { aiPaused: true, aiPausedReason: 'Paused by the team', aiPausedAt: new Date(), aiResumedAt: null }
          : body.aiPaused === false
            ? { aiPaused: false, aiPausedReason: null, aiPausedAt: null, aiResumedAt: new Date() }
            : {}),
        // Always-on also lifts any pause: it means "answer, whatever happens".
        ...(body.aiAlways === true ? { aiAlways: true, aiPaused: false, aiPausedReason: null, aiPausedAt: null } : {}),
        ...(body.aiAlways === false ? { aiAlways: false } : {}),
      },
    });
    if (count === 0) {
      sendNotFound(res, 'Conversation');
      return;
    }
    sendSuccess(res, body);
  })
);

// POST /api/crm/inbox/:id/read — clear the unread badge
router.post(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const { count } = await prisma.conversation.updateMany({
      where: { id: req.params.id },
      data: { unreadCount: 0 },
    });
    if (count === 0) {
      sendNotFound(res, 'Conversation');
      return;
    }
    sendSuccess(res, null);
  })
);

export default router;
