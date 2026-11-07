import { prisma } from '@propgroup/db';

/**
 * How much we earn on a sale, and when we get it.
 *
 * Commission is a percentage of the price from the seller plus one from the
 * buyer. Where those come from, first match wins:
 *   1. the deal itself (sellerPct / buyerPct set on the opportunity)
 *   2. the project (ProjectCommission — Georgia agrees terms per developer)
 *   3. the market default, editable in Settings → Commission
 *
 * Lebanon's standard is 2.5% from each side. Georgia's is 5.9% from the
 * developer and nothing from the buyer — and it is only paid once the buyer
 * has paid 30% of the price, which on a payment plan can be months after they
 * reserve. `payoutAtPct` is that threshold; 0 means we are paid on closing.
 *
 * A broker who shared the deal takes `brokerPct` of OUR commission.
 */

export type CommissionMarket = 'LEBANON' | 'INTERNATIONAL';

export interface MarketTerms {
  sellerPct: number;
  buyerPct: number;
  /** Paid once the client has paid this % of the price; 0 = when the sale closes. */
  payoutAtPct: number;
}

export type CommissionSettings = Record<CommissionMarket, MarketTerms>;

const SETTINGS_KEY = 'commission_settings';

export const DEFAULT_SETTINGS: CommissionSettings = {
  LEBANON: { sellerPct: 2.5, buyerPct: 2.5, payoutAtPct: 0 },
  INTERNATIONAL: { sellerPct: 5.9, buyerPct: 0, payoutAtPct: 30 },
};

const num = (v: unknown, fallback: number | null) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

export async function getCommissionSettings(): Promise<CommissionSettings> {
  const row = await prisma.systemSetting.findUnique({ where: { key: SETTINGS_KEY } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (row?.value ?? {}) as any;
  const read = (m: CommissionMarket): MarketTerms => ({
    sellerPct: num(v?.[m]?.sellerPct, DEFAULT_SETTINGS[m].sellerPct) as number,
    buyerPct: num(v?.[m]?.buyerPct, DEFAULT_SETTINGS[m].buyerPct) as number,
    payoutAtPct: num(v?.[m]?.payoutAtPct, DEFAULT_SETTINGS[m].payoutAtPct) as number,
  });
  return { LEBANON: read('LEBANON'), INTERNATIONAL: read('INTERNATIONAL') };
}

export async function saveCommissionSettings(next: CommissionSettings, userId?: string | null) {
  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: {
      key: SETTINGS_KEY, value: next as never, category: 'crm',
      description: 'Default commission terms per market', updatedBy: userId ?? null,
    },
    update: { value: next as never, updatedBy: userId ?? null },
  });
}

/** Lebanon, or everywhere else — the same split as the two websites. */
export const commissionMarketOf = (country?: string | null, leadMarket?: string | null): CommissionMarket =>
  country ? (country === 'LEBANON' ? 'LEBANON' : 'INTERNATIONAL')
    : leadMarket === 'LEBANON' ? 'LEBANON' : leadMarket ? 'INTERNATIONAL' : 'LEBANON';

export interface ResolvedTerms extends MarketTerms {
  market: CommissionMarket;
  /** Where each figure came from, for the form to say so. */
  source: 'project' | 'market';
}

/** The terms a deal on this project / in this market gets when it sets none of its own. */
export async function resolveTerms(opts: {
  buildingId?: string | null;
  country?: string | null;
  leadMarket?: string | null;
}): Promise<ResolvedTerms> {
  const [settings, building] = await Promise.all([
    getCommissionSettings(),
    opts.buildingId
      ? prisma.building.findUnique({ where: { id: opts.buildingId }, select: { country: true, commission: true } })
      : null,
  ]);
  const market = commissionMarketOf(building?.country ?? opts.country, opts.leadMarket);
  const base = settings[market];
  const p = building?.commission;
  const fromProject = Boolean(p && (p.sellerPct != null || p.buyerPct != null || p.payoutAtPct != null));
  return {
    market,
    source: fromProject ? 'project' : 'market',
    sellerPct: p?.sellerPct ?? base.sellerPct,
    buyerPct: p?.buyerPct ?? base.buyerPct,
    payoutAtPct: p?.payoutAtPct ?? base.payoutAtPct,
  };
}

/** The project a deal is about, through its listing when it has one. */
async function buildingOf(o: { buildingId?: string | null; listingId?: string | null }): Promise<string | null> {
  if (o.buildingId) return o.buildingId;
  if (!o.listingId) return null;
  const l = await prisma.listing.findUnique({
    where: { id: o.listingId },
    select: { buildingId: true, unit: { select: { buildingId: true } } },
  });
  return l?.buildingId ?? l?.unit?.buildingId ?? null;
}

type Terms = {
  stage: string;
  soldPrice: number | null; soldCurrency: string | null; commissionUsd: number | null;
  sellerPct: number | null; buyerPct: number | null; brokerPct: number | null; payoutAtPct: number | null;
  buildingId?: string | null; listingId?: string | null; leadId: string;
};

/**
 * The commission fields a deal should be saved with, given what it will look
 * like after this save (`next`) and whether the caller typed a figure itself.
 *
 * - Once a price is known, commission is worked out from the rates unless
 *   somebody entered it by hand in this save.
 * - The payout threshold is copied onto the deal as it is agreed, so a
 *   change to the default later does not move a deal already being paid off.
 * - The broker's cut always follows the commission.
 */
export async function commissionFields(next: Terms, typedCommission: boolean, becameAgreed = true) {
  const out: { commissionUsd?: number | null; brokerCutUsd: number | null; payoutAtPct?: number } = { brokerCutUsd: null };
  const agreed = next.stage === 'RESERVED' || next.stage === 'WON';
  const needsTerms = next.soldPrice != null || agreed;
  let commission = next.commissionUsd;
  if (needsTerms) {
    const lead = await prisma.lead.findUnique({ where: { id: next.leadId }, select: { market: true } });
    const terms = await resolveTerms({ buildingId: await buildingOf(next), leadMarket: lead?.market });
    if (!typedCommission) {
      const computed = computeCommission({
        soldPrice: next.soldPrice, soldCurrency: next.soldCurrency,
        sellerPct: next.sellerPct ?? terms.sellerPct, buyerPct: next.buyerPct ?? terms.buyerPct,
      });
      if (computed != null) { commission = computed; out.commissionUsd = computed; }
    }
    // Only as it is agreed: stamping a threshold onto deals closed long ago
    // would mark commission that was paid years back as still waiting.
    if (agreed && becameAgreed && next.payoutAtPct == null) out.payoutAtPct = terms.payoutAtPct;
  }
  out.brokerCutUsd = brokerCut(commission, next.brokerPct);
  return out;
}

/**
 * Commission in USD from a price and the two rates, and the broker's cut of
 * it. Null when the price is not in USD — a converted guess is worse than an
 * empty field someone fills in.
 */
export function computeCommission(opts: {
  soldPrice: number | null | undefined;
  soldCurrency?: string | null;
  sellerPct: number;
  buyerPct: number;
}): number | null {
  if (opts.soldPrice == null || (opts.soldCurrency && opts.soldCurrency !== 'USD')) return null;
  return Math.round((opts.soldPrice * (opts.sellerPct + opts.buyerPct)) / 100);
}

export const brokerCut = (commissionUsd: number | null | undefined, brokerPct: number | null | undefined) =>
  commissionUsd != null && brokerPct ? Math.round((commissionUsd * brokerPct) / 100) : null;

/**
 * Where our money on a deal stands.
 *   WAITING  — on a payment plan, the client has not reached the threshold yet
 *   DUE      — earned, not received
 *   RECEIVED — in the bank
 * Null for a deal that has not been agreed (nothing is owed on a viewing).
 */
export function payoutStatus(o: {
  stage: string;
  commissionUsd: number | null;
  paidPct: number | null;
  payoutAtPct: number | null;
  commissionReceivedAt: Date | string | null;
}): 'WAITING' | 'DUE' | 'RECEIVED' | null {
  if (o.stage !== 'WON' && o.stage !== 'RESERVED') return null;
  if (o.commissionReceivedAt) return 'RECEIVED';
  const threshold = o.payoutAtPct ?? 0;
  // Paid on closing, and it has not closed: nothing is owed yet.
  if (threshold === 0) return o.stage === 'WON' ? 'DUE' : 'WAITING';
  return (o.paidPct ?? 0) >= threshold ? 'DUE' : 'WAITING';
}
