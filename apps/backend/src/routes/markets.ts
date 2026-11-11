import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { countryLabel, countrySchema, normaliseCountry } from '../utils/market.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * The places we sell in — a list the office keeps, not one written into code.
 *
 * A project's `country` is free text, so nothing here limits what can be
 * saved. This list is what the property form offers to pick from: add
 * "Bulgaria" or "Dubai" once and it is a choice on every project from then on.
 * An entry is a market as the office thinks of it, which is why a city like
 * Dubai is as valid as a country.
 *
 * Lebanon is never on the list: it is the other website, not a value to add or
 * remove. Everything on the list appears on propgrp.com.
 */

const router: Router = express.Router();

const KEY = 'international_markets';

async function savedMarkets(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  const list = Array.isArray(row?.value) ? (row?.value as unknown[]) : [];
  return list.map((v) => normaliseCountry(v)).filter((v): v is string => Boolean(v) && v !== 'LEBANON');
}

async function save(list: string[], userId?: string | null): Promise<void> {
  const value = Array.from(new Set(list)).sort();
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value, category: 'markets', description: 'Places sold in outside Lebanon', updatedBy: userId ?? null },
    update: { value, updatedBy: userId ?? null },
  });
}

/** How many properties sit under each market, hidden ones included. */
async function usage(): Promise<Map<string, number>> {
  const rows = await prisma.building.groupBy({
    by: ['country'],
    where: { country: { not: 'LEBANON' } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.country, r._count._all]));
}

// GET /api/markets — the list, with how many properties each holds.
// A market already in use is always shown, whether or not anyone added it:
// the list can never hide a place we have stock in.
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (_req: Request, res: Response) => {
    const [saved, used] = await Promise.all([savedMarkets(), usage()]);
    const all = Array.from(new Set([...saved, ...used.keys()])).sort();
    sendSuccess(res, all.map((code) => ({ code, label: countryLabel(code), properties: used.get(code) ?? 0 })));
  })
);

// POST /api/markets — add one
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { name } = z.object({ name: countrySchema }).parse(req.body);
    if (name === 'LEBANON') { sendError(res, 400, 'Lebanon is the other website, not a market to add.'); return; }
    const saved = await savedMarkets();
    if (!saved.includes(name)) {
      await save([...saved, name], (req as AuthenticatedRequest).user?.id);
      await logAdminAction('ADD_MARKET', 'market', name, {}, req as AuthenticatedRequest);
    }
    sendSuccess(res, { code: name, label: countryLabel(name), properties: 0 }, `${countryLabel(name)} added`);
  })
);

// DELETE /api/markets/:code — take one off the list. Refused while any
// property is filed under it: the property would keep the value and the list
// would show it again anyway.
router.delete(
  '/:code',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const code = normaliseCountry(req.params.code);
    if (!code) { sendError(res, 400, 'Unknown market'); return; }
    const inUse = await prisma.building.count({ where: { country: code } });
    if (inUse > 0) {
      sendError(res, 409, `${inUse} propert${inUse === 1 ? 'y is' : 'ies are'} in ${countryLabel(code)}. Move or delete them first.`);
      return;
    }
    await save((await savedMarkets()).filter((c) => c !== code), (req as AuthenticatedRequest).user?.id);
    await logAdminAction('REMOVE_MARKET', 'market', code, {}, req as AuthenticatedRequest);
    sendSuccess(res, null, `${countryLabel(code)} removed`);
  })
);

export default router;
