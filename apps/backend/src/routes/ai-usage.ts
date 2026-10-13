import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { autoReplyEnabled } from '../services/auto-reply.service.js';
import { aiBudget } from '../utils/ai-budget.js';

// What the AI features have cost — read from AiUsage, one row per model call.

const router: Router = express.Router();

router.use(authenticateToken, requireAdmin);

// GET /api/crm/ai-usage?days=30
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [budget, byFeature, byDay, repliesToday] = await Promise.all([
      aiBudget(),
      prisma.aiUsage.groupBy({
        by: ['feature', 'model'],
        where: { createdAt: { gte: since } },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ day: Date; cost: number; calls: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, sum("costUsd")::float AS cost, count(*) AS calls
        FROM ai_usage WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.chatMessage.count({ where: { origin: 'AI', sentAt: { gte: dayAgo } } }),
    ]);

    const limit = Number(process.env.AUTO_REPLY_DAILY_LIMIT);
    sendSuccess(res, {
      days,
      autoReplyOn: autoReplyEnabled(),
      // One budget for every model and feature; AI stops when either is spent.
      budget,
      last24h: {
        messages: repliesToday,
        messageLimit: Number.isFinite(limit) && limit > 0 ? limit : 200,
      },
      totalUsd: byFeature.reduce((t, r) => t + (r._sum.costUsd ?? 0), 0),
      byFeature: byFeature.map((r) => ({
        feature: r.feature,
        model: r.model,
        calls: r._count._all,
        inputTokens: r._sum.inputTokens ?? 0,
        outputTokens: r._sum.outputTokens ?? 0,
        costUsd: r._sum.costUsd ?? 0,
      })),
      byDay: byDay.map((r) => ({ day: r.day, costUsd: r.cost, calls: Number(r.calls) })),
    });
  })
);

export default router;
