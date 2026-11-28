import type { NextFunction, Request, Response } from 'express';
import { prisma } from '@propgroup/db';
import { logger } from '../utils/logger.js';

/**
 * The storefront sorts by "last modified" = Listing.updatedAt. A listing's own
 * row only changes when its price or status does, so an edit to the property
 * (photos, description, a unit, a finish) would leave it where it was. After
 * any successful admin write under /api/buildings/:id or /api/units/:id, this
 * bumps updatedAt on every listing of that property.
 *
 * Building.updatedAt can't be used instead: the public page increments
 * Building.views on every visit, which bumps it too.
 */
export function touchListingsAfterEdit(kind: 'building' | 'unit') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const id = req.path.split('/')[1];
    if (!id || id === 'mine') return next();

    // Resolve the property before the handler runs: a deleted unit can't be looked up after.
    let buildingId: string | null = null;
    try {
      buildingId = kind === 'building'
        ? id
        : (await prisma.unit.findUnique({ where: { id }, select: { buildingId: true } }))?.buildingId ?? null;
    } catch { /* not an id: leave it to the route */ }
    if (!buildingId) return next();

    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      prisma.listing
        .updateMany({
          where: { OR: [{ buildingId }, { unit: { buildingId } }] },
          data: { updatedAt: new Date() },
        })
        .catch((err) => logger.error('Failed to touch listings after property edit', err));
    });
    next();
  };
}
