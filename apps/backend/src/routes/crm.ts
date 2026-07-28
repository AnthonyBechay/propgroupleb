import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound, sendError } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { matchListingToLead, matchLeadToLead, SUPPLY_TYPES, DEMAND_TYPES, MATCH_MIN_SCORE, PAIRABLE_STATUSES } from '../utils/lead-matching.js';
import { deriveLeadStatus, needsNewOptions, rejectionInsights } from '../utils/lead-pipeline.js';

// ─────────────────────────────────────────────────────────────────────────────
// CRM — the team's buyer/seller pipeline (replaces the follow-up spreadsheet).
// One pipeline across both markets: LEBANON (this site) and GEORGIA (propgrp.com).
// Every endpoint is admin-only.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

const UNIT_KINDS = ['APARTMENT', 'STUDIO', 'DUPLEX', 'PENTHOUSE', 'VILLA', 'TOWNHOUSE', 'SHOP', 'OFFICE', 'LAND_PARCEL', 'STORAGE', 'PARKING'] as const;
const LEAD_TYPES = ['BUYER', 'SELLER', 'RENTER', 'LANDLORD', 'INVESTOR'] as const;
const LEAD_STATUSES = ['NEW', 'ACTIVE', 'VIEWING', 'NEGOTIATING', 'WON', 'LOST', 'ARCHIVED'] as const;
const LEAD_SOURCES = ['MANUAL', 'INQUIRY', 'FAVORITE', 'SUBMISSION', 'REFERRAL', 'WHATSAPP', 'PHONE', 'WALK_IN'] as const;
const MARKETS = ['LEBANON', 'GEORGIA'] as const;
const CHANNELS = ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'VIEWING', 'NOTE'] as const;

const leadSchema = z.object({
  market: z.enum(MARKETS).default('LEBANON'),
  type: z.enum(LEAD_TYPES).default('BUYER'),
  status: z.enum(LEAD_STATUSES).default('NEW'),
  source: z.enum(LEAD_SOURCES).default('MANUAL'),
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(160).optional().nullable().or(z.literal('')),
  whatsapp: z.string().max(40).optional().nullable(),
  askingFor: z.string().max(200).optional().nullable(),
  unitKinds: z.array(z.enum(UNIT_KINDS)).default([]),
  areas: z.array(z.string().max(80)).default([]),
  regions: z.array(z.string().max(50)).default([]),
  minBeds: z.number().int().min(0).max(20).optional().nullable(),
  budgetMin: z.number().min(0).optional().nullable(),
  budgetMax: z.number().min(0).optional().nullable(),
  currency: z.enum(['USD', 'LBP']).default('USD'),
  lastContactAt: z.string().optional().nullable(),
  contactIntervalDays: z.number().int().min(1).max(365).default(7),
  nextContactAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  userId: z.string().optional().nullable(),
  listingId: z.string().optional().nullable(),
});

/** Derive the next follow-up date from the last contact + cadence. */
function computeNextContact(lastContactAt: Date | null, intervalDays: number): Date | null {
  if (!lastContactAt) return null;
  const next = new Date(lastContactAt);
  next.setDate(next.getDate() + intervalDays);
  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLeadData(data: z.infer<typeof leadSchema>): Record<string, any> {
  const last = data.lastContactAt ? new Date(data.lastContactAt) : null;
  const interval = data.contactIntervalDays;
  return {
    market: data.market,
    type: data.type,
    status: data.status,
    source: data.source,
    name: data.name.trim(),
    phone: data.phone || null,
    email: data.email || null,
    whatsapp: data.whatsapp || null,
    askingFor: data.askingFor || null,
    unitKinds: data.unitKinds,
    areas: data.areas,
    regions: data.regions,
    minBeds: data.minBeds ?? null,
    budgetMin: data.budgetMin ?? null,
    budgetMax: data.budgetMax ?? null,
    currency: data.currency,
    lastContactAt: last,
    contactIntervalDays: interval,
    // An explicit nextContactAt wins; otherwise derive it from the cadence.
    nextContactAt: data.nextContactAt ? new Date(data.nextContactAt) : computeNextContact(last, interval),
    notes: data.notes || null,
    userId: data.userId || null,
    listingId: data.listingId || null,
  };
}


/**
 * Attach a display subject to each opportunity. Rejected items are excluded
 * from the match endpoints by design, so the UI can't resolve their names from
 * there — we resolve them here instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hydrateOpportunities(opportunities: any[]): Promise<any[]> {
  if (opportunities.length === 0) return [];
  const listingIds = opportunities.map((o) => o.listingId).filter(Boolean) as string[];
  const leadIds = opportunities.map((o) => o.counterpartLeadId).filter(Boolean) as string[];

  const [listings, leads] = await Promise.all([
    listingIds.length
      ? prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true, slug: true, headline: true, price: true, currency: true,
            building: { select: { title: true, city: true, caza: true } },
            unit: { select: { building: { select: { title: true, city: true, caza: true } } } },
          },
        })
      : [],
    leadIds.length
      ? prisma.lead.findMany({
          where: { id: { in: leadIds } },
          select: { id: true, name: true, type: true, phone: true, whatsapp: true, askingFor: true },
        })
      : [],
  ]);

  const listingById = new Map(listings.map((x) => [x.id, x]));
  const leadById = new Map(leads.map((x) => [x.id, x]));

  return opportunities.map((o) => {
    const listing = o.listingId ? listingById.get(o.listingId) : null;
    const counterpart = o.counterpartLeadId ? leadById.get(o.counterpartLeadId) : null;
    const b = listing?.building ?? listing?.unit?.building;
    return {
      ...o,
      subject: counterpart
        ? { kind: 'CLIENT', title: counterpart.name, subtitle: counterpart.askingFor ?? counterpart.type, id: counterpart.id }
        : listing
          ? {
              kind: 'LISTING',
              title: listing.headline || b?.title || 'Property',
              subtitle: [b?.city, b?.caza].filter(Boolean).join(', ') || null,
              slug: listing.slug,
              id: listing.id,
            }
          : { kind: 'UNKNOWN', title: 'No longer available', subtitle: null },
    };
  });
}

// ── GET / — pipeline list with filters ────────────────────────────────────────

router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, string>);
    const q = req.query as Record<string, string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (q.market && MARKETS.includes(q.market as never)) where.market = q.market;
    if (q.type && LEAD_TYPES.includes(q.type as never)) where.type = q.type;
    if (q.status && LEAD_STATUSES.includes(q.status as never)) where.status = q.status;
    if (q.source && LEAD_SOURCES.includes(q.source as never)) where.source = q.source;

    // "overdue" = due a follow-up now (and still an open lead).
    if (q.overdue === 'true') {
      where.nextContactAt = { lte: new Date() };
      where.status = { notIn: ['WON', 'LOST', 'ARCHIVED'] };
    }
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { askingFor: { contains: q.search, mode: 'insensitive' } },
        { notes: { contains: q.search, mode: 'insensitive' } },
        { areas: { has: q.search } },
      ];
    }

    // Default order: most urgent first (soonest/overdue follow-up), then newest.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = [{ nextContactAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }];
    if (q.sort === 'newest') orderBy = [{ createdAt: 'desc' }];
    else if (q.sort === 'name') orderBy = [{ name: 'asc' }];

    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: { select: { contacts: true } },
          opportunities: { select: { id: true, stage: true, viewingAt: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    sendPaginated(res, items, buildPaginationResponse(page, limit, total));
  })
);

// ── GET /stats — pipeline counters for the dashboard header ───────────────────

router.get(
  '/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    const openStatuses = { notIn: ['WON', 'LOST', 'ARCHIVED'] as string[] };
    const [total, overdue, byMarket, byStatus] = await Promise.all([
      prisma.lead.count({ where: { status: openStatuses as never } }),
      prisma.lead.count({ where: { nextContactAt: { lte: new Date() }, status: openStatuses as never } }),
      prisma.lead.groupBy({ by: ['market'], _count: { _all: true }, where: { status: openStatuses as never } }),
      prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    sendSuccess(res, {
      openLeads: total,
      overdue,
      byMarket: Object.fromEntries(byMarket.map((r) => [r.market, r._count._all])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    });
  })
);

// ── GET /untapped — clients who have matches nobody has acted on yet ─────────
// The opposite of "needs new options": these clients have real potential
// sitting in our inventory (or in a counterpart client) that has never been
// shortlisted. Computed in one pass so the board can flag them.

router.get(
  '/untapped',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const minScore = Number(q.minScore ?? MATCH_MIN_SCORE);

    const openLeads = await prisma.lead.findMany({
      where: { status: { notIn: ['WON', 'LOST', 'ARCHIVED'] as never } },
      include: { opportunities: { select: { listingId: true, counterpartLeadId: true, leadId: true } } },
      take: 1000,
    });
    if (openLeads.length === 0) { sendSuccess(res, { counts: {}, total: 0 }); return; }

    const listings = await prisma.listing.findMany({
      where: { status: 'ACTIVE', visibility: 'PUBLIC' },
      take: 400,
      select: {
        id: true, price: true, intent: true,
        building: { select: { city: true, caza: true, neighborhood: true, mohafazat: true } },
        unit: {
          select: {
            kind: true, bedrooms: true,
            building: { select: { city: true, caza: true, neighborhood: true, mohafazat: true } },
          },
        },
      },
    });

    // Pairings are symmetric — a rejection recorded from either side counts for
    // both, so build one global set of already-paired lead couples.
    const pairedKey = (a: string, b: string) => [a, b].sort().join('::');
    const pairedCouples = new Set<string>();
    const shownListings = new Map<string, Set<string>>();
    for (const lead of openLeads) {
      for (const o of lead.opportunities) {
        if (o.counterpartLeadId) pairedCouples.add(pairedKey(o.leadId, o.counterpartLeadId));
        if (o.listingId) {
          if (!shownListings.has(o.leadId)) shownListings.set(o.leadId, new Set());
          shownListings.get(o.leadId)!.add(o.listingId);
        }
      }
    }

    const counts: Record<string, number> = {};
    for (const lead of openLeads) {
      const isDemand = DEMAND_TYPES.includes(lead.type);
      const seen = shownListings.get(lead.id) ?? new Set<string>();
      let n = 0;

      // Live inventory — only relevant to clients who are looking, in Lebanon.
      if (isDemand && lead.market === 'LEBANON') {
        for (const listing of listings) {
          if (seen.has(listing.id)) continue;
          if (matchListingToLead(lead, listing).score >= minScore) n++;
        }
      }

      // Counterpart clients — relevant to both sides.
      const counterpartTypes = isDemand ? SUPPLY_TYPES : DEMAND_TYPES;
      for (const other of openLeads) {
        if (other.id === lead.id) continue;
        if (other.market !== lead.market) continue;
        if (!counterpartTypes.includes(other.type)) continue;
        if (pairedCouples.has(pairedKey(lead.id, other.id))) continue;
        const m = isDemand ? matchLeadToLead(lead, other) : matchLeadToLead(other, lead);
        if (m.score >= minScore) n++;
      }

      if (n > 0) counts[lead.id] = n;
    }

    sendSuccess(res, { counts, total: Object.keys(counts).length });
  })
);

// ── GET /agenda — everything that needs the team today ───────────────────────
// Viewings booked, viewings done with no feedback recorded, and clients whose
// options are exhausted and are waiting on us for something new.

router.get(
  '/agenda',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    const marketWhere = q.market && MARKETS.includes(q.market as never) ? { market: q.market as never } : {};

    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const [upcomingViewings, awaitingFeedbackOps, leadsWithOps] = await Promise.all([
      prisma.leadOpportunity.findMany({
        where: { stage: 'VIEWING_BOOKED', viewingAt: { lte: in7Days } },
        orderBy: { viewingAt: 'asc' },
        take: 50,
        include: { lead: { select: { id: true, name: true, phone: true, market: true } } },
      }),
      prisma.leadOpportunity.findMany({
        where: { stage: 'VIEWED' },
        orderBy: { viewedAt: 'asc' },
        take: 50,
        include: { lead: { select: { id: true, name: true, phone: true, market: true } } },
      }),
      prisma.lead.findMany({
        where: { status: { notIn: ['NEW', 'WON', 'LOST', 'ARCHIVED'] as never }, ...marketWhere },
        select: { id: true, name: true, phone: true, market: true, status: true, opportunities: { select: { stage: true } } },
        take: 500,
      }),
    ]);

    const needsOptions = leadsWithOps
      .filter((l) => needsNewOptions(l, l.opportunities))
      .map(({ opportunities, ...l }) => l);

    sendSuccess(res, {
      upcomingViewings: upcomingViewings.filter((o) => !q.market || o.lead.market === q.market),
      awaitingFeedback: awaitingFeedbackOps.filter((o) => !q.market || o.lead.market === q.market),
      needsNewOptions: needsOptions,
    });
  })
);

// ── GET /export.csv — download the pipeline as a spreadsheet ─────────────────
// CSV with a UTF-8 BOM so Excel opens Arabic/accented names correctly.

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get(
  '/export.csv',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (q.market && MARKETS.includes(q.market as never)) where.market = q.market;
    if (q.status && LEAD_STATUSES.includes(q.status as never)) where.status = q.status;

    const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5000 });

    const headers = [
      'Client Name', 'Client Type', 'Market', 'Status', 'Source', 'Asking For',
      'Property Types', 'Areas', 'Regions', 'Beds', 'Budget Min / Asking Price', 'Budget Max', 'Currency',
      'Phone', 'WhatsApp', 'Email',
      'Last Contact Date', 'Interval (Days)', 'Next Contact Date', 'Urgent Status',
      'Notes / Actions', 'Created',
    ];

    const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const rows = leads.map((l) => {
      const overdue = l.nextContactAt && l.nextContactAt <= new Date() && !['WON', 'LOST', 'ARCHIVED'].includes(l.status);
      return [
        l.name, l.type, l.market, l.status, l.source, l.askingFor,
        l.unitKinds.join(' | '), l.areas.join(' | '), l.regions.join(' | '),
        l.minBeds, l.budgetMin, l.budgetMax, l.currency,
        l.phone, l.whatsapp, l.email,
        iso(l.lastContactAt), l.contactIntervalDays, iso(l.nextContactAt),
        overdue ? 'OVERDUE' : '',
        l.notes, iso(l.createdAt),
      ].map(csvCell).join(',');
    });

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="propgroup-crm-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  })
);

// ── GET /:id — detail with contact history ────────────────────────────────────

router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        contacts: { orderBy: { contactedAt: 'desc' } },
        opportunities: { orderBy: { updatedAt: 'desc' } },
      },
    });
    if (!lead) { sendNotFound(res, 'Lead'); return; }

    sendSuccess(res, {
      ...lead,
      opportunities: await hydrateOpportunities(lead.opportunities),
      insights: rejectionInsights(lead.opportunities),
      needsNewOptions: needsNewOptions(lead, lead.opportunities),
    });
  })
);

// ── GET /:id/matches — live listings that fit what this lead wants ────────────
// Simple, explainable matching: market/intent + unit kind + budget + location.

router.get(
  '/:id/matches',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) { sendNotFound(res, 'Lead'); return; }

    // Georgia leads are served by the sister site — we have no local inventory.
    if (lead.market !== 'LEBANON') { sendSuccess(res, []); return; }

    // Never re-suggest something this client has already been shown or ruled
    // out — that's the whole point of tracking opportunities.
    const seen = await prisma.leadOpportunity.findMany({
      where: { leadId: lead.id, listingId: { not: null } },
      select: { listingId: true },
    });
    const seenIds = seen.map((o) => o.listingId!).filter(Boolean);

    // Pull a broad candidate pool (cheap filters only) and rank it in memory —
    // scoring is what decides relevance, not a hard SQL filter, so a client
    // still sees near-misses that are worth a phone call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { status: 'ACTIVE', visibility: 'PUBLIC' };
    if (seenIds.length) where.id = { notIn: seenIds };

    const candidates = await prisma.listing.findMany({
      where,
      take: 400,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, headline: true, price: true, currency: true, intent: true,
        building: { select: { title: true, city: true, caza: true, neighborhood: true, mohafazat: true, images: true } },
        unit: {
          select: {
            kind: true, bedrooms: true, bathrooms: true, areaSqm: true,
            building: { select: { title: true, city: true, caza: true, neighborhood: true, mohafazat: true, images: true } },
          },
        },
      },
    });

    const MIN_SCORE = Number(req.query.minScore ?? MATCH_MIN_SCORE);
    const scored = candidates
      .map((listing) => ({ listing, match: matchListingToLead(lead, listing) }))
      .filter((r) => r.match.score >= MIN_SCORE)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 20);

    sendSuccess(res, scored);
  })
);

// ── GET /:id/lead-matches — other clients who are the other side of the deal ──
// A buyer looking in Achrafieh and a seller with an Achrafieh apartment are a
// potential introduction long before anything is listed publicly.

router.get(
  '/:id/lead-matches',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) { sendNotFound(res, 'Lead'); return; }

    const isDemand = DEMAND_TYPES.includes(lead.type);
    const counterpartTypes = isDemand ? SUPPLY_TYPES : DEMAND_TYPES;

    // A pairing is symmetric: it's stored once (from whichever side started it)
    // but must hide the other client from BOTH profiles. Querying only
    // `leadId = this lead` left the rejected counterpart visible on the other
    // side, so we look in both directions.
    const paired = await prisma.leadOpportunity.findMany({
      where: {
        OR: [
          { leadId: lead.id, counterpartLeadId: { not: null } },
          { counterpartLeadId: lead.id },
        ],
      },
      select: { leadId: true, counterpartLeadId: true },
    });
    const pairedIds = paired
      .flatMap((o) => [o.leadId, o.counterpartLeadId])
      .filter((id): id is string => !!id && id !== lead.id);

    const counterparts = await prisma.lead.findMany({
      where: {
        id: { notIn: [lead.id, ...pairedIds] },
        market: lead.market,
        type: { in: counterpartTypes as never },
        status: { in: PAIRABLE_STATUSES as never },
      },
      take: 300,
      orderBy: { createdAt: 'desc' },
    });

    const MIN_SCORE = Number(req.query.minScore ?? MATCH_MIN_SCORE);
    const scored = counterparts
      .map((other) => ({
        lead: other,
        // Always score demand-side wants against supply-side offering.
        match: isDemand ? matchLeadToLead(lead, other) : matchLeadToLead(other, lead),
      }))
      .filter((r) => r.match.score >= MIN_SCORE)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 20);

    sendSuccess(res, scored);
  })
);

// ── POST / — create a lead ────────────────────────────────────────────────────

router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const data = leadSchema.parse(req.body);

    const lead = await prisma.lead.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...toLeadData(data), createdBy: authReq.user?.id ?? null } as any,
    });

    await logAdminAction('CREATE_LEAD', 'lead', lead.id, { name: lead.name, market: lead.market }, authReq);
    sendCreated(res, lead, 'Lead created');
  })
);

// ── PUT /:id — update a lead ──────────────────────────────────────────────────

router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) { sendNotFound(res, 'Lead'); return; }

    const data = leadSchema.partial().parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = { ...data };
    if (data.email === '') patch.email = null;
    // Stamp when the relationship closed, and clear it if it reopens — the
    // board uses this to show only recent wins.
    if (data.status) {
      patch.closedAt = ['WON', 'LOST'].includes(data.status) ? new Date() : null;
    }
    if (data.lastContactAt !== undefined) patch.lastContactAt = data.lastContactAt ? new Date(data.lastContactAt) : null;
    if (data.nextContactAt !== undefined) patch.nextContactAt = data.nextContactAt ? new Date(data.nextContactAt) : null;

    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: patch });
    await logAdminAction('UPDATE_LEAD', 'lead', lead.id, { name: lead.name }, authReq);
    sendSuccess(res, lead, 'Lead updated');
  })
);

// ── POST /:id/contact — log a contact and roll the follow-up date forward ─────

const contactSchema = z.object({
  channel: z.enum(CHANNELS).default('CALL'),
  body: z.string().min(1).max(4000),
  outcome: z.string().max(200).optional().nullable(),
  contactedAt: z.string().optional().nullable(),
  // Optional overrides applied alongside the log entry
  status: z.enum(LEAD_STATUSES).optional(),
  contactIntervalDays: z.number().int().min(1).max(365).optional(),
});

router.post(
  '/:id/contact',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) { sendNotFound(res, 'Lead'); return; }

    const data = contactSchema.parse(req.body);
    const contactedAt = data.contactedAt ? new Date(data.contactedAt) : new Date();
    const interval = data.contactIntervalDays ?? lead.contactIntervalDays;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await prisma.$transaction(async (tx: any) => {
      await tx.leadContact.create({
        data: {
          leadId: lead.id,
          channel: data.channel,
          body: data.body,
          outcome: data.outcome || null,
          contactedAt,
          createdBy: authReq.user?.id ?? null,
        },
      });
      return tx.lead.update({
        where: { id: lead.id },
        data: {
          lastContactAt: contactedAt,
          contactIntervalDays: interval,
          nextContactAt: computeNextContact(contactedAt, interval),
          // First touch moves a NEW lead into the active pipeline.
          status: data.status ?? (lead.status === 'NEW' ? 'ACTIVE' : lead.status),
        },
        include: { contacts: { orderBy: { contactedAt: 'desc' } } },
      });
    });

    await logAdminAction('LOG_LEAD_CONTACT', 'lead', lead.id, { channel: data.channel }, authReq);
    sendSuccess(res, result, 'Contact logged');
  })
);

// ── DELETE /:id ───────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
    if (!existing) { sendNotFound(res, 'Lead'); return; }

    await prisma.lead.delete({ where: { id: req.params.id } });
    await logAdminAction('DELETE_LEAD', 'lead', req.params.id, { name: existing.name }, authReq);
    sendSuccess(res, { id: req.params.id }, 'Lead deleted');
  })
);

// ── POST /from-inquiry/:inquiryId — turn a website inquiry into a lead ───────
// One click from the Inquiries screen: pulls the contact details and the
// property they asked about into the pipeline instead of retyping them.

router.post(
  '/from-inquiry/:inquiryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const inquiry = await prisma.propertyInquiry.findUnique({
      where: { id: req.params.inquiryId },
      include: {
        building: { select: { title: true, city: true, caza: true, mohafazat: true } },
      },
    });
    if (!inquiry) { sendNotFound(res, 'Inquiry'); return; }

    // Don't create a duplicate if this person is already in the pipeline.
    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          ...(inquiry.phone ? [{ phone: inquiry.phone }] : []),
          ...(inquiry.email ? [{ email: inquiry.email }] : []),
        ],
      },
    });
    if (existing) { sendSuccess(res, existing, 'This client is already in the CRM'); return; }

    const now = new Date();
    const lead = await prisma.lead.create({
      data: {
        market: 'LEBANON',
        type: 'BUYER',
        status: 'NEW',
        source: 'INQUIRY',
        name: inquiry.name,
        phone: inquiry.phone,
        email: inquiry.email,
        askingFor: inquiry.building?.title ? `Enquired about ${inquiry.building.title}` : null,
        areas: [inquiry.building?.city, inquiry.building?.caza].filter(Boolean) as string[],
        regions: inquiry.building?.mohafazat ? [inquiry.building.mohafazat] : [],
        notes: inquiry.message,
        userId: inquiry.userId,
        lastContactAt: now,
        contactIntervalDays: 3,
        nextContactAt: computeNextContact(now, 3),
        createdBy: authReq.user?.id ?? null,
      },
    });

    await logAdminAction('CREATE_LEAD_FROM_INQUIRY', 'lead', lead.id, { inquiryId: inquiry.id }, authReq);
    sendCreated(res, lead, 'Client added to CRM');
  })
);

// ── Opportunities — one client's interest in one specific property ───────────
// A failed viewing rules out that property and returns the client to the
// search; it never ends the relationship.

const STAGES = ['SUGGESTED', 'SHARED', 'VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'WON', 'REJECTED'] as const;
const REJECTION_REASONS = [
  'PRICE_TOO_HIGH', 'TOO_SMALL', 'TOO_BIG', 'LOCATION', 'CONDITION', 'LAYOUT',
  'FLOOR_LEVEL', 'NO_PARKING', 'NOISE', 'NO_VIEW', 'NO_ELEVATOR', 'BUILDING_QUALITY',
  'CHANGED_MIND', 'BOUGHT_ELSEWHERE', 'UNAVAILABLE', 'OTHER',
] as const;

/** Recompute the client's pipeline status from their live deals. */
async function syncLeadStatus(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { opportunities: { select: { stage: true } } },
  });
  if (!lead) return;
  const next = deriveLeadStatus(lead.status, lead.opportunities);
  if (next && next !== lead.status) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: next as never,
        closedAt: ['WON', 'LOST'].includes(next) ? new Date() : null,
      },
    });
  }
}

const opportunitySchema = z.object({
  listingId: z.string().optional().nullable(),
  counterpartLeadId: z.string().optional().nullable(),
  stage: z.enum(STAGES).default('SUGGESTED'),
  matchScore: z.number().int().min(0).max(100).optional().nullable(),
  viewingAt: z.string().optional().nullable(),
  feedback: z.string().max(2000).optional().nullable(),
});

// POST /:id/opportunities — shortlist a property (or a counterpart client)
router.post(
  '/:id/opportunities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!lead) { sendNotFound(res, 'Lead'); return; }

    const data = opportunitySchema.parse(req.body);
    if (!data.listingId && !data.counterpartLeadId) {
      sendError(res, 400, 'Provide a listingId or a counterpartLeadId');
      return;
    }

    // Idempotent: re-adding an existing pairing just returns it.
    const existing = await prisma.leadOpportunity.findFirst({
      where: {
        leadId: lead.id,
        ...(data.listingId ? { listingId: data.listingId } : { counterpartLeadId: data.counterpartLeadId }),
      },
    });
    if (existing) { sendSuccess(res, existing, 'Already on the shortlist'); return; }

    const opportunity = await prisma.leadOpportunity.create({
      data: {
        leadId: lead.id,
        listingId: data.listingId || null,
        counterpartLeadId: data.counterpartLeadId || null,
        stage: data.stage,
        matchScore: data.matchScore ?? null,
        viewingAt: data.viewingAt ? new Date(data.viewingAt) : null,
        feedback: data.feedback || null,
        createdBy: authReq.user?.id ?? null,
      },
    });

    await syncLeadStatus(lead.id);
    await logAdminAction('CREATE_OPPORTUNITY', 'lead', lead.id, { opportunityId: opportunity.id }, authReq);
    sendCreated(res, opportunity, 'Added to shortlist');
  })
);

// PATCH /opportunities/:oid — move the deal along, book a viewing, or record
// the outcome. Rejecting sends the client back to searching automatically.
const opportunityUpdateSchema = z.object({
  stage: z.enum(STAGES).optional(),
  viewingAt: z.string().optional().nullable(),
  rejectionReason: z.enum(REJECTION_REASONS).optional().nullable(),
  feedback: z.string().max(2000).optional().nullable(),
});

router.patch(
  '/opportunities/:oid',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.leadOpportunity.findUnique({ where: { id: req.params.oid } });
    if (!existing) { sendNotFound(res, 'Opportunity'); return; }

    const data = opportunityUpdateSchema.parse(req.body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {};
    if (data.stage) patch.stage = data.stage;
    if (data.viewingAt !== undefined) patch.viewingAt = data.viewingAt ? new Date(data.viewingAt) : null;
    if (data.rejectionReason !== undefined) patch.rejectionReason = data.rejectionReason;
    if (data.feedback !== undefined) patch.feedback = data.feedback;
    // Stamp when the viewing actually happened, so "awaiting feedback" is real.
    if (data.stage === 'VIEWED' && !existing.viewedAt) patch.viewedAt = new Date();

    const opportunity = await prisma.leadOpportunity.update({ where: { id: req.params.oid }, data: patch });

    await syncLeadStatus(existing.leadId);
    await logAdminAction('UPDATE_OPPORTUNITY', 'lead', existing.leadId, { stage: opportunity.stage }, authReq);

    // Return the refreshed lead so the UI can re-render everything at once.
    const lead = await prisma.lead.findUnique({
      where: { id: existing.leadId },
      include: {
        contacts: { orderBy: { contactedAt: 'desc' } },
        opportunities: { orderBy: { updatedAt: 'desc' } },
      },
    });
    sendSuccess(
      res,
      lead ? { ...lead, opportunities: await hydrateOpportunities(lead.opportunities) } : lead,
      'Opportunity updated',
    );
  })
);

// DELETE /opportunities/:oid — remove a shortlist entry entirely
router.delete(
  '/opportunities/:oid',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const existing = await prisma.leadOpportunity.findUnique({ where: { id: req.params.oid } });
    if (!existing) { sendNotFound(res, 'Opportunity'); return; }

    await prisma.leadOpportunity.delete({ where: { id: req.params.oid } });
    await syncLeadStatus(existing.leadId);
    await logAdminAction('DELETE_OPPORTUNITY', 'lead', existing.leadId, {}, authReq);
    sendSuccess(res, { id: req.params.oid }, 'Removed from shortlist');
  })
);

// ── POST /import — bulk-create leads (spreadsheet migration) ──────────────────

router.post(
  '/import',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const rows = z.array(leadSchema).max(500).parse(req.body?.leads ?? []);

    const created = await prisma.$transaction(
      rows.map((row) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma.lead.create({ data: { ...toLeadData(row), createdBy: authReq.user?.id ?? null } as any })
      )
    );

    await logAdminAction('IMPORT_LEADS', 'lead', 'bulk', { count: created.length }, authReq);
    sendCreated(res, { count: created.length }, `${created.length} leads imported`);
  })
);

export default router;
