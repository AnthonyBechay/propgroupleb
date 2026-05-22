import { Decimal } from '@prisma/client/runtime/library';

type Unit = { id: string; areaSqm: number | null; generatorAmpere: number | null };
type Reading = { unitId: string; consumed: Decimal };
type OccupantCount = { unitId: string; count: number };
type FixedShare = { unitId: string; share: number };

export interface AllocationInput {
  bill: { totalAmount: Decimal; currency: string; totalConsumed: Decimal | null };
  units: Unit[];
  method: 'METERED' | 'AREA_PROPORTIONAL' | 'FIXED_SHARE' | 'OCCUPANT_COUNT';
  readings?: Reading[];
  occupantCounts?: OccupantCount[];
  unitShares?: FixedShare[];
}

export interface AllocationResult {
  unitId: string;
  method: string;
  basis: number | null;
  share: number;
  amount: Decimal;
  currency: string;
}

export function allocateBill(input: AllocationInput): AllocationResult[] {
  const { bill, units, method } = input;
  if (units.length === 0) return [];

  const total = new Decimal(bill.totalAmount);
  const currency = bill.currency;

  if (method === 'METERED') {
    const readings = input.readings ?? [];
    const consumed = new Map<string, Decimal>();
    for (const r of readings) {
      if (r.consumed) {
        consumed.set(r.unitId, (consumed.get(r.unitId) ?? new Decimal(0)).add(new Decimal(r.consumed)));
      }
    }
    const totalConsumed = bill.totalConsumed
      ? new Decimal(bill.totalConsumed)
      : [...consumed.values()].reduce((a, b) => a.add(b), new Decimal(0));

    if (totalConsumed.isZero()) return fallbackEqualSplit(units, total, currency, method);

    return units.map((u) => {
      const basis = consumed.get(u.id) ?? new Decimal(0);
      const share = basis.div(totalConsumed);
      return {
        unitId: u.id,
        method,
        basis: basis.toNumber(),
        share: share.toNumber(),
        amount: total.mul(share).toDecimalPlaces(2),
        currency,
      };
    });
  }

  if (method === 'AREA_PROPORTIONAL') {
    const validUnits = units.filter((u) => u.areaSqm != null && u.areaSqm > 0);
    if (validUnits.length === 0) return fallbackEqualSplit(units, total, currency, method);
    const totalArea = validUnits.reduce((sum, u) => sum + u.areaSqm!, 0);
    return units.map((u) => {
      const area = u.areaSqm ?? 0;
      const basis = area;
      const share = totalArea > 0 ? new Decimal(area).div(new Decimal(totalArea)) : new Decimal(0);
      return {
        unitId: u.id,
        method,
        basis,
        share: share.toNumber(),
        amount: total.mul(share).toDecimalPlaces(2),
        currency,
      };
    });
  }

  if (method === 'FIXED_SHARE') {
    const shares = new Map((input.unitShares ?? []).map((s) => [s.unitId, s.share]));
    return units.map((u) => {
      const share = new Decimal(shares.get(u.id) ?? 0);
      return {
        unitId: u.id,
        method,
        basis: share.toNumber(),
        share: share.toNumber(),
        amount: total.mul(share).toDecimalPlaces(2),
        currency,
      };
    });
  }

  if (method === 'OCCUPANT_COUNT') {
    const counts = new Map((input.occupantCounts ?? []).map((o) => [o.unitId, o.count]));
    const totalCount = [...counts.values()].reduce((a, b) => a + b, 0) || units.length;
    return units.map((u) => {
      const count = counts.get(u.id) ?? 1;
      const share = new Decimal(count).div(new Decimal(totalCount));
      return {
        unitId: u.id,
        method,
        basis: count,
        share: share.toNumber(),
        amount: total.mul(share).toDecimalPlaces(2),
        currency,
      };
    });
  }

  return fallbackEqualSplit(units, total, currency, method);
}

function fallbackEqualSplit(units: Unit[], total: Decimal, currency: string, method: string): AllocationResult[] {
  const share = new Decimal(1).div(new Decimal(units.length));
  return units.map((u) => ({
    unitId: u.id,
    method,
    basis: null,
    share: share.toNumber(),
    amount: total.mul(share).toDecimalPlaces(2),
    currency,
  }));
}
