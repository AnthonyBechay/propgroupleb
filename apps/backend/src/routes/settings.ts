import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// Known settings + their defaults. Anything stored in SystemSetting overrides
// these; this keeps the app working before an admin ever opens the page.
// `public: true` means the value is safe to expose to the public site so the
// frontend can respect it (e.g. hide the AI widgets when disabled).
const SETTING_DEFS = {
  aiSearchEnabled: { default: true, public: true },
  aiFabEnabled: { default: true, public: true },
  aiDefaultSearchMode: { default: false, public: true },
  aiMaxResults: { default: 50, public: false },
  aiResponseTimeout: { default: 10, public: false },
} as const;

type SettingKey = keyof typeof SETTING_DEFS;
const KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

async function readSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: KEYS } } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, unknown> = {};
  for (const k of KEYS) {
    out[k] = stored.has(k) ? stored.get(k) : SETTING_DEFS[k].default;
  }
  return out;
}

// ── GET /public — settings the public site is allowed to read ─────────────────
router.get(
  '/public',
  asyncHandler(async (_req: Request, res: Response) => {
    const all = await readSettings();
    const out: Record<string, unknown> = {};
    for (const k of KEYS) if (SETTING_DEFS[k].public) out[k] = all[k];
    // Short cache — these rarely change and the FAB asks on every page.
    res.set('Cache-Control', 'public, max-age=60');
    sendSuccess(res, out);
  })
);

// ── GET / — all settings + real AI usage stats (admin) ────────────────────────
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await readSettings();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    let searchesThisMonth = 0;
    let topQueries: Array<{ query: string; count: number }> = [];
    try {
      searchesThisMonth = await prisma.analyticsEvent.count({
        where: { type: 'search', createdAt: { gte: monthStart } },
      });
      const rows = await prisma.$queryRaw<Array<{ query: string; count: bigint }>>`
        SELECT meta->>'query' AS query, COUNT(*) AS count
        FROM analytics_events
        WHERE type = 'search' AND meta->>'query' IS NOT NULL AND meta->>'query' <> ''
        GROUP BY meta->>'query'
        ORDER BY count DESC
        LIMIT 5`;
      topQueries = rows.map((r) => ({ query: r.query, count: Number(r.count) }));
    } catch (err) {
      logger.error('Failed to compute AI search stats', err);
    }

    sendSuccess(res, { settings, stats: { searchesThisMonth, topQueries } });
  })
);

// ── PUT / — persist a batch of settings (admin) ───────────────────────────────
const putSchema = z.object({
  settings: z.record(z.unknown()),
});

router.put(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) { sendError(res, 400, 'Invalid settings payload'); return; }

    const incoming = parsed.data.settings;
    const updates = KEYS.filter((k) => k in incoming);

    await prisma.$transaction(
      updates.map((k) =>
        prisma.systemSetting.upsert({
          where: { key: k },
          create: { key: k, value: incoming[k] as object, category: 'ai', isPublic: SETTING_DEFS[k].public, updatedBy: authReq.user?.id },
          update: { value: incoming[k] as object, updatedBy: authReq.user?.id },
        })
      )
    );

    await logAdminAction('UPDATE_SETTINGS', 'systemSetting', 'ai', { keys: updates }, authReq);
    sendSuccess(res, await readSettings(), 'Settings saved');
  })
);

export default router;
