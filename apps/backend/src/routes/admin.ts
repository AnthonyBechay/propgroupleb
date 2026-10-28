import express, { type Request, type Response, type Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, requireSuperAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { aiBudget } from '../utils/ai-budget.js';

type MarketScope = 'LEBANON' | 'INTERNATIONAL' | null;

const OPEN_LEAD_STATUSES = ['NEW', 'ACTIVE', 'VIEWING', 'NEGOTIATING'] as const;

/** A lead's market is GEORGIA where a building's is "not Lebanon". */
const leadMarketWhere = (market: MarketScope) =>
  market === 'LEBANON' ? { market: 'LEBANON' as const }
  : market === 'INTERNATIONAL' ? { market: 'GEORGIA' as const }
  : {};

/** A listing hangs off a building directly, or through one of its units. */
const listingMarketWhere = (market: MarketScope) => {
  if (!market) return {};
  const country = market === 'LEBANON' ? { country: 'LEBANON' as const } : { country: { not: 'LEBANON' as const } };
  return { OR: [{ building: { is: country } }, { unit: { is: { building: { is: country } } } }] };
};

/**
 * What needs doing now: the chats and clients waiting on the team.
 *
 * Conversations are not narrowed by market — a WhatsApp thread has no country
 * until someone links it to a client, and an unanswered one must never vanish
 * from the dashboard because of a filter.
 */
async function workSnapshot(market: MarketScope) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const leadScope = leadMarketWhere(market);
  const [waiting, handedOver, followUpsDue, newLeads, openLeads, leadsByStatus, budget] = await Promise.all([
    prisma.conversation.count({ where: { archivedAt: null, unreadCount: { gt: 0 } } }),
    prisma.conversation.count({ where: { archivedAt: null, aiPaused: true, unreadCount: { gt: 0 } } }),
    prisma.lead.count({
      where: { ...leadScope, status: { in: [...OPEN_LEAD_STATUSES] }, nextContactAt: { lte: now } },
    }),
    prisma.lead.count({ where: { ...leadScope, createdAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { ...leadScope, status: { in: [...OPEN_LEAD_STATUSES] } } }),
    prisma.lead.groupBy({ by: ['status'], where: leadScope, _count: { _all: true } }),
    aiBudget(),
  ]);
  return {
    waiting,
    handedOver,
    followUpsDue,
    newLeadsThisWeek: newLeads,
    openLeads,
    leadsByStatus: leadsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    ai: { todayUsd: budget.dailyUsd, dailyLimitUsd: budget.dailyLimitUsd, monthUsd: budget.monthlyUsd, monthlyLimitUsd: budget.monthlyLimitUsd, exhausted: budget.exhausted },
  };
}

const router: Router = express.Router();

/**
 * Dashboard numbers, for a back office that now runs two websites.
 *
 * Every figure here used to be a single blended count — "83 buildings" was
 * Lebanon plus Georgia added together, with no split and no way to ask for one,
 * and "Buildings by City" ranked Beirut against Batumi in one bar chart as a
 * percentage of a total that spanned two countries. The only market signal
 * anywhere was a small list buried inside that card.
 *
 * So: `?market=LEBANON|INTERNATIONAL` narrows everything that *has* a market,
 * and the response always carries `byMarket` so the split is visible even when
 * nothing is narrowed.
 *
 * Not everything has a market, and the response says which is which rather than
 * implying otherwise:
 *   - buildings, units, listings, views  → the building's `country`
 *   - inquiries, favourites              → the building they point at, when
 *                                          they point at one
 *   - contact messages                   → the `site` they arrived from
 *   - users                              → nothing. An account is not Lebanese
 *                                          or Georgian; it is one login for the
 *                                          platform. Reported unscoped, and
 *                                          labelled as such on the dashboard.
 */
router.get(
  '/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const asked = String(req.query.market ?? '').toUpperCase();
    const market: 'LEBANON' | 'INTERNATIONAL' | null =
      asked === 'LEBANON' || asked === 'INTERNATIONAL' ? asked : null;

    /** The Prisma filter for a building in the chosen market. */
    const countryWhere =
      market === 'LEBANON' ? { country: 'LEBANON' as const }
      : market === 'INTERNATIONAL' ? { country: { not: 'LEBANON' as const } }
      : {};

    // A record that hangs off a building inherits its market. `is:` rather than
    // a bare object so a row with no building is excluded rather than matching
    // — a general enquiry belongs to neither site and is counted separately.
    const viaBuilding = market ? { building: { is: countryWhere } } : {};
    const siteWhere = market ? { site: market } : {};

    const [
      totalUsers,
      totalBuildings,
      totalInquiries,
      unattributedInquiries,
      totalFavorites,
      totalContactMessages,
      unattributedContacts,
      totalDocuments,
      totalUnits,
      activeListings,
      viewsAgg,
      newUsersThisWeek,
      newInquiriesThisWeek,
      newUsersThisMonth,
      newInquiriesThisMonth,
      newBuildingsThisWeek,
      recentUsers,
      recentInquiries,
      recentBuildings,
      recentContacts,
      userStats,
      buildingsByCityRaw,
      inquiryStatusStats,
      buildingStatusStats,
      buildingsByCountry,
      unitsByCountryRaw,
      listingsByCountryRaw,
      inquiriesByCountryRaw,
      viewsByCountryRaw,
      work,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.building.count({ where: countryWhere }),
      prisma.propertyInquiry.count({ where: viaBuilding }),
      // Enquiries with no property attached — they belong to neither site, and
      // silently dropping them from a filtered view would lose them entirely.
      prisma.propertyInquiry.count({ where: { buildingId: null } }),
      prisma.favoriteProperty.count({ where: viaBuilding }),
      prisma.contactMessage.count({ where: siteWhere }),
      // Messages that predate the `site` column genuinely don't know.
      prisma.contactMessage.count({ where: { site: null } }),
      prisma.propertyDocument.count({ where: market ? { building: { is: countryWhere } } : {} }),
      prisma.unit.count({ where: market ? { building: { is: countryWhere } } : {} }),
      prisma.listing.count({
        where: {
          status: 'ACTIVE',
          ...(market ? { building: { is: countryWhere } } : {}),
        },
      }),
      prisma.building.aggregate({ where: countryWhere, _sum: { views: true } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.propertyInquiry.count({ where: { ...viaBuilding, createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.propertyInquiry.count({ where: { ...viaBuilding, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.building.count({ where: { ...countryWhere, createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.propertyInquiry.findMany({
        where: viaBuilding,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          buildingTitle: true,
          status: true,
          createdAt: true,
          building: { select: { id: true, title: true, country: true } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.building.findMany({
        where: countryWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        // `country` so the row can say which site it is on, instead of the
        // dashboard printing "Lebanon" as a fallback for a missing city.
        select: { id: true, title: true, city: true, country: true, status: true, createdAt: true },
      }),
      prisma.contactMessage.findMany({
        where: siteWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, subject: true, site: true, createdAt: true },
      }),
      prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
      // Grouped by country as well as city, so Beirut and Batumi are never
      // ranked against each other as if they were the same list.
      prisma.building.groupBy({
        by: ['city', 'country'],
        where: countryWhere,
        _count: { _all: true },
      }),
      prisma.propertyInquiry.groupBy({ by: ['status'], where: viaBuilding, _count: { status: true } }),
      prisma.building.groupBy({ by: ['status'], where: countryWhere, _count: { status: true } }),
      prisma.building.groupBy({ by: ['country'], _count: { _all: true } }),
      prisma.unit.groupBy({ by: ['buildingId'], _count: { _all: true } }),
      prisma.listing.groupBy({ by: ['buildingId'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      prisma.propertyInquiry.groupBy({ by: ['buildingId'], _count: { _all: true } }),
      prisma.building.groupBy({ by: ['country'], _count: { _all: true }, _sum: { views: true } }),
      workSnapshot(market),
    ]);

    // ── Per-market rollup ─────────────────────────────────────────────────────
    // Units, listings and enquiries are grouped by building id because Prisma
    // can't group a child table by a parent's column; one lookup turns those
    // into countries. Bounded by the number of buildings, which is in the low
    // hundreds — this is not a per-row query.
    const buildingCountries = await prisma.building.findMany({
      select: { id: true, country: true },
    });
    const countryOf = new Map(buildingCountries.map((b) => [b.id, b.country]));
    const bucketOf = (country?: string | null) =>
      (country ?? 'LEBANON') === 'LEBANON' ? 'LEBANON' : 'INTERNATIONAL';

    const rollup: Record<'LEBANON' | 'INTERNATIONAL', {
      buildings: number; units: number; activeListings: number; inquiries: number; views: number;
    }> = {
      LEBANON: { buildings: 0, units: 0, activeListings: 0, inquiries: 0, views: 0 },
      INTERNATIONAL: { buildings: 0, units: 0, activeListings: 0, inquiries: 0, views: 0 },
    };

    for (const r of buildingsByCountry) rollup[bucketOf(r.country)].buildings += r._count._all;
    for (const r of viewsByCountryRaw) rollup[bucketOf(r.country)].views += r._sum.views ?? 0;
    for (const r of unitsByCountryRaw) {
      if (r.buildingId) rollup[bucketOf(countryOf.get(r.buildingId))].units += r._count._all;
    }
    for (const r of listingsByCountryRaw) {
      if (r.buildingId) rollup[bucketOf(countryOf.get(r.buildingId))].activeListings += r._count._all;
    }
    for (const r of inquiriesByCountryRaw) {
      if (r.buildingId) rollup[bucketOf(countryOf.get(r.buildingId))].inquiries += r._count._all;
    }

    sendSuccess(res, {
      market: market ?? 'all',
      work,
      overview: {
        totalUsers,
        totalBuildings,
        totalUnits,
        activeListings,
        totalViews: viewsAgg._sum.views ?? 0,
        totalInquiries,
        totalFavorites,
        totalContactMessages,
        totalDocuments,
        // Counted, not hidden — see the note on `unattributedInquiries` above.
        unattributedInquiries,
        unattributedContacts,
      },
      trends: {
        newUsersThisWeek, newInquiriesThisWeek,
        newUsersThisMonth, newInquiriesThisMonth,
        newBuildingsThisWeek,
      },
      recent: { users: recentUsers, inquiries: recentInquiries, buildings: recentBuildings, contacts: recentContacts },
      byMarket: [
        { market: 'LEBANON' as const, site: 'propgrouplb.com', ...rollup.LEBANON },
        { market: 'INTERNATIONAL' as const, site: 'propgrp.com', ...rollup.INTERNATIONAL },
      ],
      statistics: {
        usersByRole: userStats,
        buildingsByCity: buildingsByCityRaw.map((r) => ({
          city: r.city,
          country: r.country,
          count: r._count._all,
        })),
        inquiriesByStatus: inquiryStatusStats,
        buildingsByStatus: buildingStatusStats,
        buildingsByCountry: buildingsByCountry.map((r) => ({
          country: r.country, count: r._count._all,
        })),
      },
    });
  })
);

/**
 * GET /api/admin/analytics — the trends behind the dashboard, counted in SQL.
 *
 * The analytics page used to build these by downloading lists with
 * `?limit=500` — which the API caps at 100 — so every total quietly stopped at
 * 100, and it fetched from the Next server, where the login cookie (set on
 * api.propgrouplb.com) is not present. Now one authenticated call, counted
 * where the data is.
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const asked = String(req.query.market ?? '').toUpperCase();
    const market: MarketScope = asked === 'LEBANON' || asked === 'INTERNATIONAL' ? asked : null;
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const countryWhere =
      market === 'LEBANON' ? { country: 'LEBANON' as const }
      : market === 'INTERNATIONAL' ? { country: { not: 'LEBANON' as const } }
      : {};
    const leadScope = leadMarketWhere(market);
    const listingScope = listingMarketWhere(market);
    const inquiryScope = market ? { building: { is: countryWhere } } : {};

    const [
      leadsBySource, leadsByStatus, leadsPeriod, wonPeriod,
      convByChannel, inboundPeriod, outboundByOrigin,
      leadRows, inquiryRows,
      listingsByStatus, listingsByIntent, priceAgg,
      buildings,
    ] = await Promise.all([
      prisma.lead.groupBy({ by: ['source'], where: { ...leadScope, createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['status'], where: leadScope, _count: { _all: true } }),
      prisma.lead.count({ where: { ...leadScope, createdAt: { gte: since } } }),
      prisma.lead.count({ where: { ...leadScope, status: 'WON', closedAt: { gte: since } } }),
      prisma.conversation.groupBy({ by: ['channel'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.chatMessage.count({ where: { direction: 'IN', createdAt: { gte: since } } }),
      prisma.chatMessage.groupBy({ by: ['origin'], where: { direction: 'OUT', createdAt: { gte: since } }, _count: { _all: true } }),
      prisma.lead.findMany({ where: { ...leadScope, createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.propertyInquiry.findMany({ where: { ...inquiryScope, createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.listing.groupBy({ by: ['status'], where: listingScope, _count: { _all: true } }),
      prisma.listing.groupBy({ by: ['intent'], where: { ...listingScope, status: 'ACTIVE' }, _count: { _all: true } }),
      prisma.listing.aggregate({
        where: { ...listingScope, status: 'ACTIVE', currency: 'USD', intent: 'FOR_SALE', price: { gt: 0 } },
        _min: { price: true }, _max: { price: true }, _avg: { price: true },
      }),
      prisma.building.findMany({ where: countryWhere, select: { country: true, city: true, mohafazat: true } }),
    ]);

    // Six calendar months, oldest first, so a quiet month shows as zero.
    const months: Array<{ key: string; label: string; leads: number; inquiries: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en', { month: 'short', year: '2-digit' }),
        leads: 0,
        inquiries: 0,
      });
    }
    const slot = (d: Date) => months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
    for (const r of leadRows) { const m = slot(r.createdAt); if (m) m.leads += 1; }
    for (const r of inquiryRows) { const m = slot(r.createdAt); if (m) m.inquiries += 1; }

    // Lebanon by governorate, everywhere else by city — see the dashboard.
    const regions = new Map<string, number>();
    for (const b of buildings) {
      const key = b.country === 'LEBANON'
        ? String(b.mohafazat || b.city || 'Unspecified').replace(/_/g, ' ')
        : (b.city || String(b.country) || 'Unspecified');
      regions.set(key, (regions.get(key) ?? 0) + 1);
    }

    const replies = Object.fromEntries(outboundByOrigin.map((r) => [r.origin ?? 'unknown', r._count._all]));

    sendSuccess(res, {
      market: market ?? 'all',
      days,
      leads: {
        newInPeriod: leadsPeriod,
        wonInPeriod: wonPeriod,
        bySource: leadsBySource.map((r) => ({ source: r.source, count: r._count._all })).sort((a, b) => b.count - a.count),
        byStatus: leadsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      },
      chats: {
        newConversations: convByChannel.map((r) => ({ channel: r.channel, count: r._count._all })),
        inboundMessages: inboundPeriod,
        replies,
      },
      monthly: months.map(({ label, leads, inquiries }) => ({ label, leads, inquiries })),
      catalogue: {
        listingsByStatus: listingsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
        activeByIntent: listingsByIntent.map((r) => ({ intent: r.intent, count: r._count._all })),
        salePriceUsd: {
          min: Number(priceAgg._min.price ?? 0),
          max: Number(priceAgg._max.price ?? 0),
          avg: Math.round(Number(priceAgg._avg.price ?? 0)),
        },
        regions: [...regions.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      },
    });
  })
);

// Get audit logs
router.get(
  '/audit-logs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const { action, adminId } = req.query;

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (adminId) where.adminId = adminId;

    const [auditLogs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        include: { admin: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    sendPaginated(res, auditLogs, buildPaginationResponse(page, limit, total));
  })
);

// Create super admin (super admin only)
router.post(
  '/create-super-admin',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Bad Request', message: 'Email and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ error: 'Bad Request', message: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const superAdmin = await prisma.user.create({
      data: { email, password: hashedPassword, role: 'SUPER_ADMIN', isActive: true, emailVerifiedAt: new Date() },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAdminAction('CREATE_SUPER_ADMIN', 'user', superAdmin.id, {
      email,
      createdBy: authReq.user.email,
    }, authReq);

    sendCreated(res, superAdmin, 'Super admin created successfully');
  })
);

// System health (admin only)
router.get(
  '/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    await prisma.$queryRaw`SELECT 1`;

    sendSuccess(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
    });
  })
);

export default router;
