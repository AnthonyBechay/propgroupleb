import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { z } from 'zod';
import { authenticateToken, logAdminAction, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendCreated, sendNotFound, sendSuccess } from '../utils/response.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  getCommissionSettings, saveCommissionSettings, resolveTerms, payoutStatus, type CommissionSettings,
  expectedPayoutDate, expectedPaidPct,
} from '../services/commission.service.js';
import { hydrateOpportunities } from './crm.js';

/**
 * The office's money: commission terms, brokers, expenses and the accounting
 * summary. Admin only, all of it — CRM_MANAGER never sees commission.
 */
const router: Router = express.Router();
router.use(authenticateToken, requireAdmin);

const pct = z.number().min(0).max(100);

// ── Commission terms ─────────────────────────────────────────────────────────

// GET /api/finance/commission/settings — the default terms per market.
router.get('/commission/settings', asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getCommissionSettings());
}));

const termsSchema = z.object({ sellerPct: pct, buyerPct: pct, payoutAtPct: pct });

router.put('/commission/settings', asyncHandler(async (req: Request, res: Response) => {
  const body = z.object({ LEBANON: termsSchema, INTERNATIONAL: termsSchema }).parse(req.body ?? {}) as CommissionSettings;
  await saveCommissionSettings(body, (req as AuthenticatedRequest).user?.id);
  await logAdminAction('UPDATE_COMMISSION_SETTINGS', 'setting', 'commission_settings', body, req as AuthenticatedRequest);
  sendSuccess(res, body);
}));

// GET /api/finance/commission/terms?buildingId=&market= — what a deal would get
// by default, so the deal form can prefill and say where the figure came from.
router.get('/commission/terms', asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  sendSuccess(res, await resolveTerms({ buildingId: q.buildingId || null, leadMarket: q.market || null, country: q.country || null }));
}));

// GET/PUT /api/finance/commission/projects/:buildingId — a project's own terms.
router.get('/commission/projects/:buildingId', asyncHandler(async (req: Request, res: Response) => {
  const row = await prisma.projectCommission.findUnique({ where: { buildingId: req.params.buildingId } });
  sendSuccess(res, row ?? { buildingId: req.params.buildingId, sellerPct: null, buyerPct: null, payoutAtPct: null });
}));

router.put('/commission/projects/:buildingId', asyncHandler(async (req: Request, res: Response) => {
  const body = z.object({ sellerPct: pct.nullable(), buyerPct: pct.nullable(), payoutAtPct: pct.nullable() }).parse(req.body ?? {});
  const building = await prisma.building.findUnique({ where: { id: req.params.buildingId }, select: { id: true } });
  if (!building) { sendNotFound(res, 'Project'); return; }
  // All three empty: the project goes back to the market's terms.
  const row = body.sellerPct == null && body.buyerPct == null && body.payoutAtPct == null
    ? await prisma.projectCommission.deleteMany({ where: { buildingId: building.id } }).then(() => null)
    : await prisma.projectCommission.upsert({
        where: { buildingId: building.id },
        create: { buildingId: building.id, ...body },
        update: body,
      });
  await logAdminAction('UPDATE_PROJECT_COMMISSION', 'building', building.id, body, req as AuthenticatedRequest);
  sendSuccess(res, row);
}));

// ── Brokers ──────────────────────────────────────────────────────────────────

const brokerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal('')),
  company: z.string().trim().max(120).optional().nullable(),
  sharePct: pct,
  takes: z.enum(['SHARE', 'SELLER_SIDE', 'BUYER_SIDE']).optional(),
  notes: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

// GET /api/finance/brokers — with what each has earned with us.
router.get('/brokers', asyncHandler(async (_req: Request, res: Response) => {
  const brokers = await prisma.broker.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      opportunities: {
        where: { stage: { in: ['RESERVED', 'WON'] as never } },
        select: { stage: true, brokerCutUsd: true, commissionReceivedAt: true },
      },
    },
  });
  sendSuccess(res, brokers.map(({ opportunities, ...b }) => ({
    ...b,
    deals: opportunities.length,
    owedUsd: opportunities.filter((o) => !o.commissionReceivedAt).reduce((t, o) => t + (o.brokerCutUsd ?? 0), 0),
    earnedUsd: opportunities.reduce((t, o) => t + (o.brokerCutUsd ?? 0), 0),
  })));
}));

router.post('/brokers', asyncHandler(async (req: Request, res: Response) => {
  const body = brokerSchema.parse(req.body ?? {});
  const broker = await prisma.broker.create({ data: { ...body, email: body.email || null } });
  await logAdminAction('CREATE_BROKER', 'broker', broker.id, { name: broker.name, sharePct: broker.sharePct }, req as AuthenticatedRequest);
  sendCreated(res, broker);
}));

router.put('/brokers/:id', asyncHandler(async (req: Request, res: Response) => {
  const body = brokerSchema.partial().parse(req.body ?? {});
  const existing = await prisma.broker.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, 'Broker'); return; }
  const broker = await prisma.broker.update({
    where: { id: existing.id },
    data: { ...body, ...(body.email !== undefined ? { email: body.email || null } : {}) },
  });
  await logAdminAction('UPDATE_BROKER', 'broker', broker.id, body, req as AuthenticatedRequest);
  sendSuccess(res, broker);
}));

// Deleting a broker who is on deals would quietly erase who was owed what, so
// such a broker is deactivated instead.
router.delete('/brokers/:id', asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.broker.findUnique({ where: { id: req.params.id }, include: { _count: { select: { opportunities: true } } } });
  if (!existing) { sendNotFound(res, 'Broker'); return; }
  if (existing._count.opportunities > 0) {
    await prisma.broker.update({ where: { id: existing.id }, data: { active: false } });
    await logAdminAction('DEACTIVATE_BROKER', 'broker', existing.id, { name: existing.name }, req as AuthenticatedRequest);
    sendSuccess(res, { id: existing.id, deactivated: true });
    return;
  }
  await prisma.broker.delete({ where: { id: existing.id } });
  await logAdminAction('DELETE_BROKER', 'broker', existing.id, { name: existing.name }, req as AuthenticatedRequest);
  sendSuccess(res, { id: existing.id, deleted: true });
}));

// ── Expenses ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['OFFICE', 'SALARIES', 'MARKETING', 'TRAVEL', 'FEES', 'TAX', 'OTHER'] as const;

const expenseSchema = z.object({
  date: z.string(),
  category: z.enum(CATEGORIES),
  amountUsd: z.number().min(0),
  description: z.string().trim().max(500).optional().nullable(),
  market: z.enum(['LEBANON', 'GEORGIA']).optional().nullable(),
});

const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The day a recurring expense falls on in a month: its day, or the month's last. */
function dayIn(year: number, month: number, dayOfMonth: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, dayOfMonth <= 0 ? last : Math.min(dayOfMonth, last), 12);
}

/**
 * Add every recurring expense's months that are due by today and missing.
 * Runs whenever the books are read, so nothing depends on a scheduler having
 * been up on the right night. The (recurringId, period) key makes a second run
 * a no-op. Deleting a month it added is how you skip that month, so a deleted
 * month is remembered (`recurring_skips_<id>`) and never added back.
 */
async function generateRecurring(now = new Date()) {
  const items = await prisma.recurringExpense.findMany({ where: { active: true, startsOn: { lte: now } } });
  for (const r of items) {
    const done = new Set(
      (await prisma.expense.findMany({ where: { recurringId: r.id }, select: { period: true } })).map((e) => e.period),
    );
    const skipped = new Set(((await prisma.systemSetting.findUnique({ where: { key: `recurring_skips_${r.id}` } }))?.value as string[] | undefined) ?? []);
    const start = new Date(r.startsOn);
    for (let y = start.getFullYear(), m = start.getMonth(); ; m++) {
      if (m > 11) { y++; m = 0; }
      const on = dayIn(y, m, r.dayOfMonth);
      if (on > now || (r.endsOn && on > r.endsOn)) break;
      if (on < start) continue;
      const period = monthOf(on);
      if (done.has(period) || skipped.has(period)) continue;
      await prisma.expense.create({
        data: {
          date: on, category: r.category, amountUsd: r.amountUsd, description: r.description,
          market: r.market, recurringId: r.id, period, createdBy: r.createdBy,
        },
      }).catch(() => {}); // a parallel read made it first
    }
  }
}

const recurringSchema = z.object({
  category: z.enum(['OFFICE', 'SALARIES', 'MARKETING', 'TRAVEL', 'FEES', 'TAX', 'OTHER']),
  amountUsd: z.number().min(0),
  description: z.string().trim().max(500).optional().nullable(),
  market: z.enum(['LEBANON', 'GEORGIA']).optional().nullable(),
  dayOfMonth: z.number().int().min(0).max(31),
  startsOn: z.string(),
  endsOn: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

router.get('/recurring', asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await prisma.recurringExpense.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] }));
}));

router.post('/recurring', asyncHandler(async (req: Request, res: Response) => {
  const body = recurringSchema.parse(req.body ?? {});
  const r = await prisma.recurringExpense.create({
    data: {
      ...body, startsOn: new Date(`${body.startsOn}T00:00:00`),
      endsOn: body.endsOn ? new Date(`${body.endsOn}T23:59:59`) : null,
      createdBy: (req as AuthenticatedRequest).user?.id ?? null,
    },
  });
  await logAdminAction('CREATE_RECURRING_EXPENSE', 'expense', r.id, { category: r.category, amountUsd: r.amountUsd }, req as AuthenticatedRequest);
  await generateRecurring();
  sendCreated(res, r);
}));

// Changes apply from now on: months already added keep the amount they had.
router.put('/recurring/:id', asyncHandler(async (req: Request, res: Response) => {
  const body = recurringSchema.partial().parse(req.body ?? {});
  const existing = await prisma.recurringExpense.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, 'Recurring expense'); return; }
  const r = await prisma.recurringExpense.update({
    where: { id: existing.id },
    data: {
      ...body,
      ...(body.startsOn ? { startsOn: new Date(`${body.startsOn}T00:00:00`) } : {}),
      ...(body.endsOn !== undefined ? { endsOn: body.endsOn ? new Date(`${body.endsOn}T23:59:59`) : null } : {}),
    },
  });
  await logAdminAction('UPDATE_RECURRING_EXPENSE', 'expense', r.id, body, req as AuthenticatedRequest);
  await generateRecurring();
  sendSuccess(res, r);
}));

// Stops it. The months it already added stay in the books.
router.delete('/recurring/:id', asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.recurringExpense.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, 'Recurring expense'); return; }
  await prisma.recurringExpense.delete({ where: { id: existing.id } });
  await logAdminAction('DELETE_RECURRING_EXPENSE', 'expense', existing.id, { description: existing.description }, req as AuthenticatedRequest);
  sendSuccess(res, { id: existing.id });
}));

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD, both inclusive; defaults to this year. */
function period(req: Request) {
  const q = req.query as Record<string, string>;
  const now = new Date();
  const from = q.from ? new Date(`${q.from}T00:00:00`) : new Date(now.getFullYear(), 0, 1);
  const to = q.to ? new Date(`${q.to}T23:59:59.999`) : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { from, to };
}

router.get('/expenses', asyncHandler(async (req: Request, res: Response) => {
  await generateRecurring();
  const { from, to } = period(req);
  sendSuccess(res, await prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' } }));
}));

router.post('/expenses', asyncHandler(async (req: Request, res: Response) => {
  const body = expenseSchema.parse(req.body ?? {});
  const expense = await prisma.expense.create({
    data: { ...body, date: new Date(body.date), createdBy: (req as AuthenticatedRequest).user?.id ?? null },
  });
  await logAdminAction('CREATE_EXPENSE', 'expense', expense.id, { category: expense.category, amountUsd: expense.amountUsd }, req as AuthenticatedRequest);
  sendCreated(res, expense);
}));

router.put('/expenses/:id', asyncHandler(async (req: Request, res: Response) => {
  const body = expenseSchema.partial().parse(req.body ?? {});
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, 'Expense'); return; }
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: { ...body, ...(body.date ? { date: new Date(body.date) } : {}) },
  });
  await logAdminAction('UPDATE_EXPENSE', 'expense', expense.id, body, req as AuthenticatedRequest);
  sendSuccess(res, expense);
}));

router.delete('/expenses/:id', asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) { sendNotFound(res, 'Expense'); return; }
  await prisma.expense.delete({ where: { id: existing.id } });
  // A month made by a recurring expense, deleted: that month is skipped, not
  // added straight back on the next read.
  if (existing.recurringId && existing.period) {
    const key = `recurring_skips_${existing.recurringId}`;
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    const skips = new Set(((row?.value as string[] | undefined) ?? []));
    skips.add(existing.period);
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: [...skips], category: 'finance', description: 'Months skipped for a recurring expense' },
      update: { value: [...skips] },
    });
  }
  await logAdminAction('DELETE_EXPENSE', 'expense', existing.id, { category: existing.category, amountUsd: existing.amountUsd }, req as AuthenticatedRequest);
  sendSuccess(res, { id: existing.id });
}));

// ── The accounting summary ───────────────────────────────────────────────────

/**
 * GET /api/finance/summary?from=&to= — profit for a period, on money actually
 * received: commission lands on the day it was received, net of the broker's
 * cut, and expenses on their date. Tax is kept apart so the page can show
 * profit before and after it.
 *
 * Alongside: what is owed to us now (due, not received) and what is still
 * waiting on clients' payment plans — neither is profit yet.
 */
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  await generateRecurring();
  const { from, to } = period(req);

  const [received, open, sellerSales, expenses] = await Promise.all([
    prisma.leadOpportunity.findMany({
      where: { stage: { in: ['RESERVED', 'WON'] as never }, commissionReceivedAt: { gte: from, lte: to } },
      include: { lead: { select: { id: true, name: true, market: true } }, broker: { select: { id: true, name: true } } },
      orderBy: { commissionReceivedAt: 'desc' },
    }),
    prisma.leadOpportunity.findMany({
      where: { stage: { in: ['RESERVED', 'WON'] as never }, commissionReceivedAt: null },
      include: { lead: { select: { id: true, name: true, market: true } }, broker: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    }),
    // A seller's own property sold through us — the other place a sale is recorded.
    prisma.leadProperty.findMany({
      where: { status: 'SOLD' as never, soldAt: { gte: from, lte: to }, commissionUsd: { not: null } },
      select: { id: true, title: true, soldAt: true, commissionUsd: true, lead: { select: { id: true, name: true } } },
    }),
    prisma.expense.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);

  const net = (o: { commissionUsd: number | null; brokerCutUsd: number | null }) => (o.commissionUsd ?? 0) - (o.brokerCutUsd ?? 0);
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const gross = received.reduce((t, o) => t + (o.commissionUsd ?? 0), 0);
  const brokerCuts = received.reduce((t, o) => t + (o.brokerCutUsd ?? 0), 0);
  const sellerSide = sellerSales.reduce((t, p) => t + (p.commissionUsd ?? 0), 0);
  const income = gross - brokerCuts + sellerSide;

  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountUsd;
  const tax = byCategory.TAX ?? 0;
  const costs = expenses.reduce((t, e) => t + e.amountUsd, 0) - tax;

  // Month by month across the period, empty months included.
  const months = new Map<string, { income: number; costs: number; tax: number }>();
  for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d.setMonth(d.getMonth() + 1)) {
    months.set(monthKey(d), { income: 0, costs: 0, tax: 0 });
  }
  for (const o of received) { const m = months.get(monthKey(o.commissionReceivedAt as Date)); if (m) m.income += net(o); }
  for (const p of sellerSales) { const m = months.get(monthKey(p.soldAt as Date)); if (m) m.income += p.commissionUsd ?? 0; }
  for (const e of expenses) { const m = months.get(monthKey(e.date)); if (m) { if (e.category === 'TAX') m.tax += e.amountUsd; else m.costs += e.amountUsd; } }

  const [namedReceived, namedOpen] = await Promise.all([hydrateOpportunities(received), hydrateOpportunities(open)]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (o: any, i: number, src: any[]) => ({
    id: o.id,
    lead: src[i].lead,
    broker: src[i].broker,
    title: o.subject?.title ?? o.externalTitle ?? 'Property',
    stage: o.stage,
    soldPrice: o.soldPrice,
    soldCurrency: o.soldCurrency,
    commissionUsd: o.commissionUsd,
    brokerCutUsd: o.brokerCutUsd,
    netUsd: net(o),
    paidPct: o.paidPct,
    payoutAtPct: o.payoutAtPct,
    downPaymentPct: o.downPaymentPct,
    planMonths: o.planMonths,
    planStartAt: o.planStartAt,
    expectedAt: expectedPayoutDate(o),
    expectedPaidNow: expectedPaidPct(o),
    closedAt: o.closedAt,
    commissionReceivedAt: o.commissionReceivedAt,
    status: payoutStatus(o),
  });
  const openRows = namedOpen.map((o, i) => row(o, i, open));

  sendSuccess(res, {
    from, to,
    income: { gross, brokerCuts, sellerSide, net: income },
    expenses: { byCategory, costs, tax, total: costs + tax },
    profitBeforeTax: income - costs,
    profitAfterTax: income - costs - tax,
    months: [...months].map(([month, m]) => ({ month, ...m, profit: m.income - m.costs - m.tax })),
    received: namedReceived.map((o, i) => row(o, i, received)),
    sellerSales,
    due: openRows.filter((r) => r.status === 'DUE'),
    waiting: openRows.filter((r) => r.status === 'WAITING'),
    // Payment plans, by the month the commission should be ours. Past that
    // month and not received: ping the developer.
    plans: openRows
      .filter((r) => (r.payoutAtPct ?? 0) > 0)
      .map((r) => ({
        ...r,
        chase: (r.expectedAt != null && r.expectedAt <= new Date()) || (r.paidPct ?? 0) >= (r.payoutAtPct ?? 0),
      }))
      .sort((a, b) => (a.expectedAt?.getTime() ?? Infinity) - (b.expectedAt?.getTime() ?? Infinity)),
  });
}));

// POST /api/finance/deals/:id/received — the commission on a deal arrived (or,
// with { received: false }, it did not after all).
router.post('/deals/:id/received', asyncHandler(async (req: Request, res: Response) => {
  const body = z.object({ received: z.boolean().default(true), date: z.string().optional() }).parse(req.body ?? {});
  const existing = await prisma.leadOpportunity.findUnique({ where: { id: req.params.id }, select: { id: true, leadId: true } });
  if (!existing) { sendNotFound(res, 'Deal'); return; }
  const at = body.received ? (body.date ? new Date(`${body.date}T12:00:00`) : new Date()) : null;
  await prisma.leadOpportunity.update({ where: { id: existing.id }, data: { commissionReceivedAt: at } });
  await logAdminAction('COMMISSION_RECEIVED', 'lead', existing.leadId, { opportunityId: existing.id, received: body.received, date: at }, req as AuthenticatedRequest);
  sendSuccess(res, { id: existing.id, commissionReceivedAt: at });
}));

export default router;
