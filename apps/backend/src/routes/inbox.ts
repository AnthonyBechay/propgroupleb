import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireCrm, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { linkConversationToLead } from '../services/messaging-intake.service.js';
import { canSendOn, replyWindowOpen, sendReply } from '../services/messaging-send.service.js';
import { autoReplyEnabled } from '../services/auto-reply.service.js';

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
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = {
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
        include: { lead: { select: { id: true, name: true, status: true, market: true } } },
      }),
      prisma.conversation.count({ where }),
    ]);

    sendPaginated(res, conversations, buildPaginationResponse(page, limit, total));
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

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });

    sendSuccess(res, {
      ...conversation,
      messages: messages.reverse(),
      // Why the reply box is or is not usable, so the UI can say so up front.
      canReply: canSendOn(conversation.channel) && replyWindowOpen(conversation.lastInboundAt),
      sendingConfigured: canSendOn(conversation.channel),
      autoReplyOn: autoReplyEnabled(),
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
      include: { messages: { orderBy: { sentAt: 'desc' }, take: 12 } },
    });
    sendSuccess(
      res,
      conversations.map((c) => ({ ...c, messages: [...c.messages].reverse() }))
    );
  })
);

// GET /api/crm/inbox/unread/count — badge for the CRM toolbar
router.get(
  '/unread/count',
  asyncHandler(async (_req: Request, res: Response) => {
    const count = await prisma.conversation.count({ where: { unreadCount: { gt: 0 } } });
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
    const { aiPaused } = z.object({ aiPaused: z.boolean() }).parse(req.body);
    const { count } = await prisma.conversation.updateMany({
      where: { id: req.params.id },
      data: { aiPaused },
    });
    if (count === 0) {
      sendNotFound(res, 'Conversation');
      return;
    }
    sendSuccess(res, { aiPaused });
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
