import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin, logAdminAction } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess, sendCreated, sendPaginated, sendNotFound } from '../utils/response.js';
import { parsePagination, buildPaginationResponse } from '../utils/pagination.js';
import type { AuthenticatedRequest } from '../types/index.js';

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
  mohafazat: z.string().max(50).optional().nullable(),
  caza: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
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
    mohafazat: data.mohafazat || null,
    caza: data.caza || null,
    city: data.city || null,
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
        { city: { contains: q.search, mode: 'insensitive' } },
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
        include: { _count: { select: { contacts: true } } },
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

// ── GET /:id — detail with contact history ────────────────────────────────────

router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { contacts: { orderBy: { contactedAt: 'desc' } } },
    });
    if (!lead) { sendNotFound(res, 'Lead'); return; }
    sendSuccess(res, lead);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { status: 'ACTIVE', visibility: 'PUBLIC' };
    where.intent = lead.type === 'RENTER' ? 'FOR_RENT' : 'FOR_SALE';

    if (lead.budgetMin != null || lead.budgetMax != null) {
      where.price = {
        ...(lead.budgetMin != null ? { gte: lead.budgetMin } : {}),
        ...(lead.budgetMax != null ? { lte: lead.budgetMax } : {}),
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unitFilter: Record<string, any> = {};
    if (lead.unitKinds.length) unitFilter.kind = { in: lead.unitKinds };
    if (lead.minBeds != null) unitFilter.bedrooms = { gte: lead.minBeds };
    if (Object.keys(unitFilter).length) where.unit = unitFilter;

    // Location: any of the lead's areas / city / caza / mohafazat, matched
    // against the building either directly or through its unit.
    const areaTerms = [...lead.areas, lead.city, lead.caza].filter(Boolean) as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const locationOr: any[] = [];
    for (const term of areaTerms) {
      for (const field of ['city', 'neighborhood', 'caza']) {
        locationOr.push({ building: { [field]: { contains: term, mode: 'insensitive' } } });
        locationOr.push({ unit: { building: { [field]: { contains: term, mode: 'insensitive' } } } });
      }
    }
    if (!areaTerms.length && lead.mohafazat) {
      locationOr.push({ building: { mohafazat: lead.mohafazat } });
      locationOr.push({ unit: { building: { mohafazat: lead.mohafazat } } });
    }
    if (locationOr.length) where.OR = locationOr;

    const matches = await prisma.listing.findMany({
      where,
      take: 12,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, headline: true, price: true, currency: true, intent: true,
        building: { select: { title: true, city: true, caza: true, images: true } },
        unit: {
          select: {
            kind: true, bedrooms: true, bathrooms: true, areaSqm: true,
            building: { select: { title: true, city: true, caza: true, images: true } },
          },
        },
      },
    });

    sendSuccess(res, matches);
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
        city: inquiry.building?.city ?? null,
        caza: inquiry.building?.caza ?? null,
        mohafazat: inquiry.building?.mohafazat ?? null,
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
