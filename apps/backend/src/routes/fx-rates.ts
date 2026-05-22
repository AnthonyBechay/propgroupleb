import express, { type Request, type Response, type Router } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import { fxRateSchema } from '../schemas/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

// ── GET / — get latest FX rate (no auth required) ────────────────────────────

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const rate = await prisma.fxRate.findFirst({
      orderBy: { date: 'desc' },
    });
    sendSuccess(res, rate);
  })
);

// ── GET /history — list all FX rates with pagination (no auth required) ───────

router.get(
  '/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);

    const [rates, total] = await Promise.all([
      prisma.fxRate.findMany({
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.fxRate.count(),
    ]);

    sendPaginated(res, rates, buildPaginationResponse(page, limit, total));
  })
);

// ── POST / — upsert FX rate for a date (requireAdmin) ────────────────────────

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { date, usdToLbp, source } = fxRateSchema.parse(req.body);

    // Normalize to midnight UTC so the daily uniqueness constraint is stable
    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);

    const rate = await prisma.fxRate.upsert({
      where: { date: parsedDate },
      update: {
        usdToLbp: new Decimal(usdToLbp),
        source: source ?? null,
        createdBy: authReq.user.id,
      },
      create: {
        date: parsedDate,
        usdToLbp: new Decimal(usdToLbp),
        source: source ?? null,
        createdBy: authReq.user.id,
      },
    });

    await logAdminAction('UPSERT_FX_RATE', 'fxRate', rate.id, {
      date: rate.date.toISOString().slice(0, 10),
      usdToLbp: rate.usdToLbp.toString(),
    }, authReq);

    sendCreated(res, rate, 'FX rate saved successfully');
  })
);

export default router;
