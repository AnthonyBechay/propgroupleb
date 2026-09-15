import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, optionalAuthenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { sendSuccess } from '../utils/response.js';
import { requestScope, type SiteScope } from '../utils/market.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router: Router = express.Router();

const EVENT_TYPES = [
  'page_view', 'listing_view', 'listing_click',
  'inquiry_click', 'phone_click', 'whatsapp_click',
  'search', 'favorite',
] as const;

const trackSchema = z.object({
  type: z.enum(EVENT_TYPES),
  path: z.string().max(512).optional(),
  listingId: z.string().max(64).optional(),
  buildingId: z.string().max(64).optional(),
  unitId: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
  meta: z.record(z.unknown()).optional(),
});

// ── POST /track — record a behavioural event (public, fire-and-forget) ────────
//
// Called from the public site. Cheap append-only insert. We never block the
// caller on it failing — analytics must never break the user experience.
router.post(
  '/track',
  optionalAuthenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) {
      // Bad payloads are silently accepted (204) — don't surface tracking errors.
      res.status(204).end();
      return;
    }
    const d = parsed.data;
    const referrer = (req.headers.referer || req.headers.referrer) as string | undefined;
    const userAgent = req.headers['user-agent'];

    try {
      await prisma.analyticsEvent.create({
        data: {
          type: d.type,
          path: d.path ?? null,
          listingId: d.listingId ?? null,
          buildingId: d.buildingId ?? null,
          unitId: d.unitId ?? null,
          sessionId: d.sessionId ?? null,
          userId: authReq.user?.id ?? null,
          referrer: referrer ? referrer.slice(0, 512) : null,
          userAgent: userAgent ? userAgent.slice(0, 512) : null,
          // Resolved on write, from the same X-Site-Scope / Origin rule the
          // rest of the API uses. Deciding this later from `referrer` would
          // guess: it is empty for direct navigation and names the referring
          // page rather than the site being used.
          site: requestScope(req),
          meta: (d.meta ?? undefined) as object | undefined,
        },
      });
    } catch (err) {
      logger.error('Analytics track insert failed', err);
    }
    res.status(204).end();
  })
);

// ── GET /dashboard — aggregated behavioural metrics (admin) ───────────────────
router.get(
  '/dashboard',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? '30'), 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // One back office, two websites. `?site=` narrows to one; anything else
    // reports both together, and `bySite` below always says how they split —
    // a blended figure with no breakdown is what made this unreadable.
    const asked = String(req.query.site ?? '').toUpperCase();
    const site: SiteScope | null =
      asked === 'LEBANON' || asked === 'INTERNATIONAL' ? (asked as SiteScope) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope: Record<string, any> = { createdAt: { gte: since }, ...(site ? { site } : {}) };
    // Raw SQL can't take the Prisma filter object, so it gets the value.
    const siteSql = site ?? null;

    // How the whole range splits between the two sites, whatever the filter.
    const bySiteRaw = await prisma.analyticsEvent.groupBy({
      by: ['site'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });
    const bySite = bySiteRaw.map((r) => ({
      // Events recorded before the column existed genuinely don't know.
      site: r.site ?? 'UNKNOWN',
      events: r._count._all,
    }));

    // Totals by event type
    const byTypeRaw = await prisma.analyticsEvent.groupBy({
      by: ['type'],
      where: scope,
      _count: { type: true },
    });
    const byType: Record<string, number> = {};
    for (const r of byTypeRaw) byType[r.type] = r._count.type;

    // Unique anonymous visitors (distinct session) + total events
    const uniqueRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "sessionId") AS count
      FROM analytics_events
      WHERE "createdAt" >= ${since}
        AND "sessionId" IS NOT NULL
        AND (${siteSql}::text IS NULL OR "site" = ${siteSql}::text)`;
    const uniqueVisitors = Number(uniqueRows[0]?.count ?? 0);
    const totalEvents = Object.values(byType).reduce((a, b) => a + b, 0);

    // Daily time series for page & listing views
    const seriesRows = await prisma.$queryRaw<Array<{ day: Date; type: string; count: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day, type, COUNT(*) AS count
      FROM analytics_events
      WHERE "createdAt" >= ${since}
        AND type IN ('page_view', 'listing_view')
        AND (${siteSql}::text IS NULL OR "site" = ${siteSql}::text)
      GROUP BY day, type
      ORDER BY day ASC`;
    const seriesMap = new Map<string, { date: string; pageViews: number; listingViews: number }>();
    for (const r of seriesRows) {
      const key = new Date(r.day).toISOString().slice(0, 10);
      const entry = seriesMap.get(key) ?? { date: key, pageViews: 0, listingViews: 0 };
      if (r.type === 'page_view') entry.pageViews = Number(r.count);
      else if (r.type === 'listing_view') entry.listingViews = Number(r.count);
      seriesMap.set(key, entry);
    }
    const series = Array.from(seriesMap.values());

    // Top viewed listings
    const topAgg = await prisma.analyticsEvent.groupBy({
      by: ['listingId'],
      where: { ...scope, type: 'listing_view', listingId: { not: null } },
      _count: { listingId: true },
      orderBy: { _count: { listingId: 'desc' } },
      take: 10,
    });
    const topIds = topAgg.map((r) => r.listingId).filter((id): id is string => !!id);
    const topListingsMeta = topIds.length
      ? await prisma.listing.findMany({
          where: { id: { in: topIds } },
          select: {
            id: true, slug: true, headline: true, intent: true, status: true,
            building: { select: { title: true, country: true } },
            unit: { select: { name: true, unitNumber: true, building: { select: { country: true } } } },
          },
        })
      : [];
    const metaById = new Map(topListingsMeta.map((l) => [l.id, l]));
    const topListings = topAgg.map((r) => {
      const l = metaById.get(r.listingId as string);
      const label =
        l?.headline ||
        l?.unit?.name ||
        (l?.unit?.unitNumber ? `Unit ${l.unit.unitNumber}` : null) ||
        l?.building?.title ||
        'Listing';
      return {
        listingId: r.listingId,
        slug: l?.slug ?? null,
        label,
        intent: l?.intent ?? null,
        status: l?.status ?? null,
        // A listing belongs to a market through whatever property it sells.
        country: l?.building?.country ?? l?.unit?.building?.country ?? null,
        views: r._count.listingId,
      };
    });

    // Contact funnel — how listing views convert to contact intent
    const listingViews = byType['listing_view'] ?? 0;
    const contactClicks =
      (byType['inquiry_click'] ?? 0) + (byType['phone_click'] ?? 0) + (byType['whatsapp_click'] ?? 0);

    sendSuccess(res, {
      rangeDays: days,
      site: site ?? 'all',
      bySite,
      totals: {
        totalEvents,
        uniqueVisitors,
        pageViews: byType['page_view'] ?? 0,
        listingViews,
        listingClicks: byType['listing_click'] ?? 0,
        inquiryClicks: byType['inquiry_click'] ?? 0,
        phoneClicks: byType['phone_click'] ?? 0,
        whatsappClicks: byType['whatsapp_click'] ?? 0,
        searches: byType['search'] ?? 0,
        favorites: byType['favorite'] ?? 0,
        contactClicks,
        viewToContactRate: listingViews > 0 ? Math.round((contactClicks / listingViews) * 1000) / 10 : 0,
      },
      byType,
      series,
      topListings,
    });
  })
);

export default router;
