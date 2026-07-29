import { prisma } from '@propgroup/db';

/**
 * Human-friendly reference codes.
 *
 * One family, so a code always tells you which property it belongs to:
 *   PG-1042     the property
 *   PG-1042-1   its first unit
 *   PG-1042-2   its second unit
 *
 * Clients quote these over WhatsApp — "how much is PG-1042-2?" — so they must
 * be short and stable. Property numbers come from a Postgres sequence, which
 * keeps them unique under concurrent inserts and guarantees a deleted code is
 * never handed to a different property later. Listings deliberately have no
 * code of their own: a listing shows the code of whatever it is selling.
 */

const PREFIX = 'PG-';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function nextval(sequence: string, tx?: any): Promise<number> {
  const db = tx ?? prisma;
  const rows = (await db.$queryRawUnsafe(
    `SELECT nextval('${sequence}') AS nextval`
  )) as Array<{ nextval: bigint }>;
  return Number(rows[0].nextval);
}

export async function nextBuildingRef(tx?: any): Promise<string> {
  return `${PREFIX}${await nextval('building_ref_seq', tx)}`;
}

/**
 * Next unit code under a property: "PG-1042-3".
 *
 * Numbering continues past the highest suffix ever used rather than counting
 * units, so deleting unit 2 doesn't hand PG-1042-2 to a different flat later.
 * Returns null when the property has no code yet (legacy rows) — the unit is
 * then created without one and can be backfilled.
 */
export async function nextUnitRef(buildingId: string, tx?: any): Promise<string | null> {
  const db = tx ?? prisma;
  const building = await db.building.findUnique({
    where: { id: buildingId },
    select: { ref: true },
  });
  if (!building?.ref) return null;

  const siblings = await db.unit.findMany({
    where: { buildingId, ref: { startsWith: `${building.ref}-` } },
    select: { ref: true },
  });

  let max = 0;
  for (const { ref } of siblings as Array<{ ref: string | null }>) {
    const suffix = Number(ref?.slice(building.ref.length + 1));
    if (Number.isInteger(suffix) && suffix > max) max = suffix;
  }
  return `${building.ref}-${max + 1}`;
}

/**
 * Normalise whatever a client typed into a comparable code.
 * "pg 1042", "PG1042", " pg-1042 " all become "PG-1042", and
 * "pg 1042 2", "PG1042-2" become "PG-1042-2".
 */
export function normalizeRef(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, '');
  const m = cleaned.match(/^(?:PG)?-?(\d+)(?:-(\d+))?$/);
  if (!m) return cleaned;
  return m[2] ? `${PREFIX}${m[1]}-${m[2]}` : `${PREFIX}${m[1]}`;
}

/** True when the text looks like someone quoting a reference code. */
export function looksLikeRef(input: string): boolean {
  return /^PG\s*-?\s*\d+(\s*-\s*\d+)?$/i.test(input.trim());
}

/** The property-level code inside any ref: "PG-1042-2" → "PG-1042". */
export function buildingRefOf(ref: string): string {
  const m = normalizeRef(ref).match(/^(PG-\d+)/);
  return m ? m[1] : ref;
}

/** True when the ref points at a specific unit rather than a whole property. */
export function isUnitRef(ref: string): boolean {
  return /^PG-\d+-\d+$/.test(normalizeRef(ref));
}
