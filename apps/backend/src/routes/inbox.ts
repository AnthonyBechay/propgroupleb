import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireCrm } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';

// ─────────────────────────────────────────────────────────────────────────────
// CRM inbox — WhatsApp and Instagram threads mirrored from Meta's webhooks
// (routes/webhooks.ts). Read-only for now: replies are still typed in the phone
// apps and arrive here as echoes.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

router.use(authenticateToken, requireCrm);

// GET /api/crm/inbox — threads, most recent first
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const channel = req.query.channel;
    const where = {
      ...(channel === 'WHATSAPP' || channel === 'INSTAGRAM' ? { channel: channel as 'WHATSAPP' | 'INSTAGRAM' } : {}),
      ...(req.query.unread === 'true' ? { unreadCount: { gt: 0 } } : {}),
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

    sendSuccess(res, { ...conversation, messages: messages.reverse() });
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
