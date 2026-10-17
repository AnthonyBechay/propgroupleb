import express, { type Request, type Response, type Router } from 'express';
import { prisma } from '@propgroup/db';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';
import { adsConfigured, checkMetaConnection, fetchAdSpend } from '../services/meta-ads.service.js';
import { conversionsConfigured, reportLeadStage } from '../services/meta-conversions.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// What each Meta ad cost, next to what it produced.
//
// Meta knows spend and clicks; only the CRM knows which of those people became
// clients and which of them bought. Admin-only, because it carries commission.
// ─────────────────────────────────────────────────────────────────────────────

const router: Router = express.Router();

router.use(authenticateToken, requireAdmin);

// GET /api/crm/ads?days=90
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 90));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Our side: every client that arrived from an ad in the window, and what
    // their closed deals paid.
    const leads = await prisma.lead.findMany({
      where: { adId: { not: null }, createdAt: { gte: since } },
      select: {
        adId: true,
        adLabel: true,
        status: true,
        opportunities: { where: { stage: 'WON' }, select: { commissionUsd: true } },
      },
      take: 5000,
    });

    const byAd = new Map<string, { label: string | null; leads: number; won: number; commissionUsd: number }>();
    for (const l of leads) {
      const row = byAd.get(l.adId as string) ?? { label: null, leads: 0, won: 0, commissionUsd: 0 };
      row.label ??= l.adLabel;
      row.leads += 1;
      if (l.opportunities.length > 0) row.won += 1;
      row.commissionUsd += l.opportunities.reduce((t, o) => t + (o.commissionUsd ?? 0), 0);
      byAd.set(l.adId as string, row);
    }

    // Meta's side. A failure here must not hide what the CRM already knows.
    let currency = 'USD';
    let spendError: string | null = null;
    const spendByAd = new Map<string, { adName: string | null; campaignName: string | null; spend: number; clicks: number }>();
    if (adsConfigured()) {
      try {
        const account = await fetchAdSpend(days);
        currency = account.currency;
        for (const a of account.ads) spendByAd.set(a.adId, a);
      } catch (err) {
        spendError = (err as Error).message;
      }
    }

    const ids = new Set([...byAd.keys(), ...spendByAd.keys()]);
    const rows = [...ids].map((adId) => {
      const ours = byAd.get(adId);
      const theirs = spendByAd.get(adId);
      const spend = theirs?.spend ?? null;
      const leadCount = ours?.leads ?? 0;
      return {
        adId,
        name: theirs?.adName ?? ours?.label ?? null,
        campaign: theirs?.campaignName ?? null,
        spend,
        clicks: theirs?.clicks ?? null,
        leads: leadCount,
        won: ours?.won ?? 0,
        commissionUsd: ours?.commissionUsd ?? 0,
        // Null rather than 0 when there is nothing to divide — "free" would be a lie.
        costPerLead: spend !== null && leadCount > 0 ? Math.round((spend / leadCount) * 100) / 100 : null,
      };
    });
    rows.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0) || b.leads - a.leads);

    sendSuccess(res, {
      days,
      currency,
      spendConnected: adsConfigured(),
      spendError,
      totals: {
        spend: spendByAd.size > 0 ? rows.reduce((t, r) => t + (r.spend ?? 0), 0) : null,
        leads: rows.reduce((t, r) => t + r.leads, 0),
        won: rows.reduce((t, r) => t + r.won, 0),
        commissionUsd: rows.reduce((t, r) => t + r.commissionUsd, 0),
      },
      ads: rows,
    });
  })
);

// GET /api/crm/ads/test — is the link to Meta actually working, piece by piece?
router.get(
  '/test',
  asyncHandler(async (_req: Request, res: Response) => {
    const checks = await checkMetaConnection();

    // The other half: has anything from an ad actually arrived here?
    const [lastLead, adLeads] = await Promise.all([
      prisma.lead.findFirst({
        where: { OR: [{ adId: { not: null } }, { externalLeadId: { not: null } }] },
        orderBy: { createdAt: 'desc' },
        select: { name: true, createdAt: true, adLabel: true },
      }),
      prisma.lead.count({ where: { OR: [{ adId: { not: null } }, { externalLeadId: { not: null } }] } }),
    ]);
    checks.push({
      name: 'Leads received from ads',
      ok: adLeads > 0,
      detail: lastLead
        ? `${adLeads} so far. Latest: ${lastLead.name} on ${lastLead.createdAt.toISOString().slice(0, 10)}${lastLead.adLabel ? ` (${lastLead.adLabel})` : ''}.`
        : 'None yet. Create a test lead with Meta\'s Lead Ads testing tool, then run this again.',
    });

    sendSuccess(res, { ok: checks.every((c) => c.ok), checks });
  })
);

// POST /api/crm/ads/report-leads — tell Meta about every ad lead now: each one's
// furthest stage, once. For catching up after the dataset was first connected,
// and for seeing straight away whether Meta accepts the events.
router.post(
  '/report-leads',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!conversionsConfigured()) {
      sendSuccess(res, { sent: 0, skipped: 0, failed: 0, firstError: 'META_DATASET_ID is not set on the server.' });
      return;
    }
    const leads = await prisma.lead.findMany({
      where: { OR: [{ adId: { not: null } }, { externalLeadId: { not: null } }, { ctwaClid: { not: null } }] },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: 300,
    });
    const tally = { sent: 0, skipped: 0, failed: 0, firstError: null as string | null };
    for (const l of leads) {
      const outcome = await reportLeadStage(l.id);
      tally[outcome.status] += 1;
      if (outcome.status === 'failed' && !tally.firstError) tally.firstError = outcome.detail;
    }
    sendSuccess(res, { ...tally, leads: leads.length });
  })
);

export default router;
