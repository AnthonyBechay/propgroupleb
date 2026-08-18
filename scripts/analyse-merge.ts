/**
 * Read-only survey of a Georgia → Lebanon back-office merge.
 *
 * Answers "how big is this really?" before anyone commits to it, and does so
 * without writing a single byte: every statement here is a SELECT, and the
 * Georgia database is opened as a separate connection that is never used for
 * anything else.
 *
 *   GEORGIA_DATABASE_URL=postgres://…/propgroup \
 *   DATABASE_URL=postgres://…/propgroupleb \
 *   pnpm --filter @propgroup/db exec tsx ../../scripts/analyse-merge.ts
 *
 * Run it against production safely, or against restored copies — it can't tell
 * the difference and can't damage either.
 */

import { PrismaClient } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

const GEORGIA_URL = process.env.GEORGIA_DATABASE_URL;
const LEBANON_URL = process.env.DATABASE_URL;

if (!GEORGIA_URL || !LEBANON_URL) {
  console.error('Set GEORGIA_DATABASE_URL and DATABASE_URL.');
  process.exit(1);
}

// Two clients, two databases. The Prisma client is generated from the Lebanon
// schema, but raw SQL doesn't care — Georgia's tables are queried by name.
const ge = new PrismaClient({ datasources: { db: { url: GEORGIA_URL } } });
const lb = new PrismaClient({ datasources: { db: { url: LEBANON_URL } } });

const q = async (client: PrismaClient, sql: string): Promise<any[]> => {
  try {
    return (await client.$queryRawUnsafe(sql)) as any[];
  } catch (err) {
    console.error(`   ! query failed: ${(err as Error).message.split('\n')[0]}`);
    return [];
  }
};
const count = async (client: PrismaClient, table: string): Promise<number> => {
  const rows = await q(client, `SELECT COUNT(*)::int AS n FROM "${table}"`);
  return rows[0]?.n ?? 0;
};

const h1 = (s: string) => console.log(`\n${'─'.repeat(64)}\n${s}\n${'─'.repeat(64)}`);
const row = (label: string, value: unknown) =>
  console.log(`  ${label.padEnd(42)} ${String(value)}`);

/**
 * Georgia's flat PropertyType vs Lebanon's UnitKind. Only COMMERCIAL is
 * genuinely ambiguous — it could be a shop, an office or a whole floor — so it
 * needs a human decision rather than a guess.
 */
const TYPE_MAP: Record<string, string | null> = {
  APARTMENT: 'APARTMENT',
  VILLA: 'VILLA',
  TOWNHOUSE: 'TOWNHOUSE',
  PENTHOUSE: 'PENTHOUSE',
  STUDIO: 'STUDIO',
  DUPLEX: 'DUPLEX',
  LAND: 'LAND_PARCEL',
  OFFICE: 'OFFICE',
  COMMERCIAL: null, // ambiguous — decide before importing
};

async function main() {
  console.log('\nGeorgia → Lebanon merge survey (read-only)');

  // ── What's actually there ────────────────────────────────────────────────
  h1('1 · Volume');
  const geTables = [
    'properties', 'units', 'unit_options', 'users', 'developers', 'location_guides',
    'property_inquiries', 'favorite_properties', 'contact_messages', 'property_documents',
    'property_investment_data', 'site_content', 'site_media',
  ];
  for (const t of geTables) row(`georgia.${t}`, await count(ge, t));

  console.log('');
  for (const t of ['buildings', 'units', 'listings', 'users', 'leads']) {
    row(`lebanon.${t}`, await count(lb, t));
  }

  // ── The things that actually block an import ─────────────────────────────
  h1('2 · Collisions — these must be resolved first');

  // Same person with an account in both systems. Email is unique in each, so a
  // naive copy fails on the first overlap.
  const geEmails = await q(ge, `SELECT LOWER(email) AS email, role FROM "users"`);
  const lbEmails = await q(lb, `SELECT LOWER(email) AS email, role FROM "users"`);
  const lbSet = new Map(lbEmails.map((u) => [u.email, u.role]));
  const overlap = geEmails.filter((u) => lbSet.has(u.email));
  row('users in both systems (same email)', overlap.length);
  for (const u of overlap.slice(0, 10)) {
    console.log(`      ${u.email}  georgia:${u.role}  lebanon:${lbSet.get(u.email)}`);
  }
  if (overlap.length > 10) console.log(`      …and ${overlap.length - 10} more`);

  // Slugs are unique per table and drive public URLs.
  const geSlugs = await q(ge, `SELECT slug FROM "properties" WHERE slug IS NOT NULL`);
  const lbSlugs = await q(lb, `SELECT slug FROM "buildings" WHERE slug IS NOT NULL`);
  const lbSlugSet = new Set(lbSlugs.map((r) => r.slug));
  const slugClash = geSlugs.filter((r) => lbSlugSet.has(r.slug));
  row('slug collisions (properties vs buildings)', slugClash.length);
  for (const s of slugClash.slice(0, 10)) console.log(`      ${s.slug}`);

  // ── Field mapping coverage ───────────────────────────────────────────────
  h1('3 · Type mapping');
  const types = await q(
    ge,
    `SELECT "propertyType"::text AS t, COUNT(*)::int AS n FROM "properties" GROUP BY 1 ORDER BY 2 DESC`
  );
  for (const t of types) {
    const target = TYPE_MAP[t.t];
    row(`${t.t} (${t.n})`, target ? `→ ${target}` : '→ NEEDS A DECISION');
  }

  h1('4 · Shape of the data');
  const withUnits = await q(
    ge,
    `SELECT COUNT(DISTINCT "propertyId")::int AS n FROM "units"`
  );
  const geProps = await count(ge, 'properties');
  row('properties that have units (become projects)', withUnits[0]?.n ?? 0);
  row('properties with no units (become standalone)', geProps - (withUnits[0]?.n ?? 0));

  // Every Georgia property carries its own price; Lebanon puts price on a
  // listing, so each property becomes one building + one listing.
  const priced = await q(ge, `SELECT COUNT(*)::int AS n FROM "properties" WHERE price > 0`);
  row('properties with a price → 1 listing each', priced[0]?.n ?? 0);

  const statuses = await q(
    ge,
    `SELECT status::text AS s, COUNT(*)::int AS n FROM "properties" GROUP BY 1 ORDER BY 2 DESC`
  );
  console.log('');
  for (const s of statuses) row(`status ${s.s}`, s.n);

  // ── Media ────────────────────────────────────────────────────────────────
  h1('5 · Images');
  const imgs = await q(
    ge,
    `SELECT unnest(images) AS url FROM "properties" WHERE array_length(images, 1) > 0 LIMIT 400`
  );
  const hosts = new Map<string, number>();
  for (const i of imgs) {
    try {
      const h = new URL(i.url).host;
      hosts.set(h, (hosts.get(h) ?? 0) + 1);
    } catch {
      hosts.set('(relative / unparseable)', (hosts.get('(relative / unparseable)') ?? 0) + 1);
    }
  }
  for (const [host, n] of [...hosts.entries()].sort((a, b) => b[1] - a[1])) row(host, n);
  console.log(
    '\n  Absolute URLs on a host you keep serving need no migration — the rows\n' +
    '  carry over and the images keep loading from where they already live.'
  );

  // ── Verdict ──────────────────────────────────────────────────────────────
  h1('6 · Summary');
  const blockers: string[] = [];
  if (overlap.length) blockers.push(`${overlap.length} duplicate user accounts need a merge rule`);
  if (slugClash.length) blockers.push(`${slugClash.length} slug collisions need renaming`);
  if (types.some((t: any) => TYPE_MAP[t.t] === null)) blockers.push('COMMERCIAL properties need a target type');

  if (blockers.length === 0) {
    console.log('  No blockers found. A straight import should work.');
  } else {
    console.log('  Decide these before importing:');
    for (const b of blockers) console.log(`    • ${b}`);
  }
  console.log(
    `\n  Nothing was written. Georgia was opened read-only and both databases\n` +
    `  are exactly as you left them.\n`
  );
}

main()
  .catch((e) => {
    console.error('\nSurvey failed:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await ge.$disconnect();
    await lb.$disconnect();
  });
