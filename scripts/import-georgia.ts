/**
 * Import the Georgia system (propgrp) into this one.
 *
 * Three properties make this safe to point at production:
 *
 *   Read-only at source  Georgia is opened with SELECTs and nothing else. If
 *                        the import is wrong, the original is still the truth.
 *   Idempotent           Every created row is recorded in `imported_records`,
 *                        so a second run skips what already exists instead of
 *                        duplicating it. Re-run it as often as you like.
 *   Reversible           `--undo <batch>` deletes exactly what a batch created
 *                        and nothing else.
 *
 * Usage:
 *   # See what would happen. Writes nothing.
 *   GEORGIA_DATABASE_URL=… DATABASE_URL=… tsx scripts/import-georgia.ts --dry-run
 *
 *   # Do it.
 *   GEORGIA_DATABASE_URL=… DATABASE_URL=… tsx scripts/import-georgia.ts
 *
 *   # Change your mind.
 *   DATABASE_URL=… tsx scripts/import-georgia.ts --undo georgia-2026-08-05
 *
 * Take a database backup first anyway. This is careful, not magic.
 */

import { PrismaClient } from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

const DRY = process.argv.includes('--dry-run');
const UNDO = process.argv[process.argv.indexOf('--undo') + 1];
const IS_UNDO = process.argv.includes('--undo');
const SOURCE_SYSTEM = 'propgrp';
const BATCH = process.env.IMPORT_BATCH ?? `georgia-${new Date().toISOString().slice(0, 10)}`;

const lb = new PrismaClient();
const ge = process.env.GEORGIA_DATABASE_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.GEORGIA_DATABASE_URL } } })
  : null;

const log = (s = '') => console.log(s);
const h1 = (s: string) => log(`\n${'─'.repeat(64)}\n${s}\n${'─'.repeat(64)}`);

/**
 * Georgia's flat PropertyType → this system's UnitKind.
 *
 * COMMERCIAL is the only ambiguous one: it covers shops, offices and anything
 * else non-residential, so the title decides. SHOP is the fallback because it
 * is the most common and the least wrong — a mislabelled shop is easy to spot
 * and fix, and the matcher treats shops and offices as the same family anyway.
 */
const TYPE_MAP: Record<string, string> = {
  APARTMENT: 'APARTMENT', VILLA: 'VILLA', TOWNHOUSE: 'TOWNHOUSE',
  PENTHOUSE: 'PENTHOUSE', STUDIO: 'STUDIO', DUPLEX: 'DUPLEX',
  LAND: 'LAND_PARCEL', OFFICE: 'OFFICE', COMMERCIAL: 'SHOP',
};

const COMMERCIAL_HINTS: Array<[RegExp, string]> = [
  [/office|bureau|مكتب/i, 'OFFICE'],
  [/warehouse|depot|مستودع/i, 'WAREHOUSE'],
  [/showroom|صالة/i, 'SHOWROOM'],
  [/restaurant|cafe|مطعم/i, 'RESTAURANT'],
  [/clinic|medical|عيادة/i, 'CLINIC'],
  [/shop|retail|store|محل/i, 'SHOP'],
];

function unitKindFor(propertyType: string | null, title: string): string {
  if (!propertyType) return 'APARTMENT';
  if (propertyType !== 'COMMERCIAL') return TYPE_MAP[propertyType] ?? 'APARTMENT';
  const hit = COMMERCIAL_HINTS.find(([re]) => re.test(title));
  return hit ? hit[1] : TYPE_MAP.COMMERCIAL;
}

/**
 * Where the Georgia bucket is served from publicly.
 * Override with GEORGIA_ASSETS_URL if the CDN domain ever changes.
 */
const GEORGIA_ASSETS = (process.env.GEORGIA_ASSETS_URL ?? 'https://assets.propgrp.com').replace(/\/+$/, '');

let rewrittenUrls = 0;

/** Per-property preview, printed on a dry run so nothing lands unseen. */
interface Preview {
  title: string; slug: string; slugChanged: boolean; kind: string;
  unitKinds: string[]; units: number; options: number; price: number | null;
  currency: string; developer: string | null; guide: boolean; investment: boolean;
  docs: number; images: number; proxied: number; warnings: string[];
}
const previews: Preview[] = [];

/**
 * Convert a Georgia backend-proxy file URL to its public CDN form.
 *
 * Some Georgia media is stored as https://api.propgrp.com/api/files/<key>.
 * This app's `normalizeFileUrl` treats *any* /api/files/<key> URL as its own
 * and rewrites it onto the Lebanon bucket — where that key does not exist, so
 * the image 404s. Pinning them to the Georgia CDN host up front avoids that
 * entirely: an absolute URL on another host is passed through untouched.
 */
function fixUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/^https?:\/\/[^/]+\/api\/files\/(.+)$/);
  if (!m) return String(url);
  rewrittenUrls++;
  return `${GEORGIA_ASSETS}/${m[1]}`;
}

const fixUrls = (urls: string[] | null | undefined): string[] =>
  (urls ?? []).map((u) => fixUrl(u)).filter(Boolean) as string[];

const q = async (client: PrismaClient, sql: string): Promise<any[]> =>
  (await client.$queryRawUnsafe(sql)) as any[];

/** Has this source row already been imported? Returns the target id if so. */
async function existing(sourceTable: string, sourceId: string, targetTable: string) {
  const row = await lb.importedRecord.findUnique({
    where: {
      sourceSystem_sourceTable_sourceId_targetTable: {
        sourceSystem: SOURCE_SYSTEM, sourceTable, sourceId, targetTable,
      },
    },
  });
  return row?.targetId ?? null;
}

async function record(sourceTable: string, sourceId: string, targetTable: string, targetId: string) {
  if (DRY) return;
  await lb.importedRecord.create({
    data: { batch: BATCH, sourceSystem: SOURCE_SYSTEM, sourceTable, sourceId, targetTable, targetId },
  });
}

/** Slugs are unique and drive public URLs, so a clash gets a market suffix. */
async function freeSlug(base: string, taken: Set<string>): Promise<string> {
  let slug = base || `property-${Math.random().toString(36).slice(2, 8)}`;
  if (!taken.has(slug)) { taken.add(slug); return slug; }
  slug = `${base}-ge`;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-ge-${n++}`;
  taken.add(slug);
  return slug;
}

// ── Undo ────────────────────────────────────────────────────────────────────

async function undo(batch: string) {
  h1(`Undoing batch ${batch}`);
  const rows = await lb.importedRecord.findMany({ where: { batch } });
  if (rows.length === 0) { log('  Nothing recorded under that batch.'); return; }

  // Children first — buildings cascade to units and listings, but being
  // explicit means the counts in the report are honest.
  const order = [
    'favorite_properties', 'property_documents', 'building_investment_data',
    'unit_options', 'listings', 'units', 'buildings', 'location_guides',
    'developers', 'users',
  ];
  for (const table of order) {
    const ids = rows.filter((r) => r.targetTable === table).map((r) => r.targetId);
    if (ids.length === 0) continue;
    if (table === 'users') {
      log(`  ${ids.length} users left alone — accounts are not deleted automatically.`);
      continue;
    }
    const DELEGATES: Record<string, string> = {
      buildings: 'building', units: 'unit', listings: 'listing',
      location_guides: 'locationGuide', property_documents: 'propertyDocument',
      favorite_properties: 'favoriteProperty', building_investment_data: 'buildingInvestmentData',
      unit_options: 'unitOption', developers: 'developer',
    };
    const delegate = (lb as any)[DELEGATES[table]];
    if (!delegate) continue;
    const res = await delegate.deleteMany({ where: { id: { in: ids } } });
    log(`  deleted ${res.count} from ${table}`);
  }
  await lb.importedRecord.deleteMany({ where: { batch } });
  log(`\n  Batch ${batch} reversed.`);
}

// ── Import ──────────────────────────────────────────────────────────────────

async function run() {
  if (!ge) throw new Error('Set GEORGIA_DATABASE_URL');

  h1(`Georgia → Lebanon import${DRY ? '  (DRY RUN — nothing is written)' : ''}`);
  log(`  batch: ${BATCH}`);

  const stats = {
    users: 0, usersMerged: 0, developers: 0, guides: 0, buildings: 0, units: 0,
    unitOptions: 0, listings: 0, investment: 0, documents: 0, favourites: 0, skipped: 0,
  };
  const notes: string[] = [];

  // ── Users. Lebanon wins on a duplicate email, per the agreed rule. ────────
  const geUsers = await q(ge, `SELECT * FROM "users"`);
  const userMap = new Map<string, string>(); // georgia id -> lebanon id

  for (const u of geUsers) {
    const already = await existing('users', u.id, 'users');
    if (already) { userMap.set(u.id, already); stats.skipped++; continue; }

    const mine = await lb.user.findUnique({ where: { email: u.email.toLowerCase() } });
    if (mine) {
      // Keep the Lebanon account; just remember they're the same person so
      // Georgia's properties attach to the right agent.
      userMap.set(u.id, mine.id);
      await record('users', u.id, 'users', mine.id);
      stats.usersMerged++;
      continue;
    }

    if (DRY) { userMap.set(u.id, `dry-${u.id}`); stats.users++; continue; }
    const created = await lb.user.create({
      data: {
        email: u.email.toLowerCase(),
        password: u.password,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        phone: u.phone ?? null,
        role: u.role,
        isActive: u.isActive ?? true,
        createdAt: u.createdAt,
      },
    });
    userMap.set(u.id, created.id);
    await record('users', u.id, 'users', created.id);
    stats.users++;
  }

  // ── Developers. Properties reference them, so they go first. ─────────────
  const devMap = new Map<string, string>();
  const devNames = new Map<string, string>();
  for (const d of await q(ge, `SELECT * FROM "developers"`)) {
    devNames.set(d.id, d.name);
    const already = await existing('developers', d.id, 'developers');
    if (already) { devMap.set(d.id, already); stats.skipped++; continue; }
    if (DRY) { devMap.set(d.id, `dry-${d.id}`); stats.developers++; continue; }

    const created = await lb.developer.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        website: d.website ?? null,
        logo: fixUrl(d.logo),
        country: d.country ?? 'GEORGIA',
        createdAt: d.createdAt,
      } as any,
    });
    devMap.set(d.id, created.id);
    await record('developers', d.id, 'developers', created.id);
    stats.developers++;
  }

  // ── Location guides. Properties reference them, so they go first. ────────
  const guideMap = new Map<string, string>();
  for (const g of await q(ge, `SELECT * FROM "location_guides"`)) {
    const already = await existing('location_guides', g.id, 'location_guides');
    if (already) { guideMap.set(g.id, already); stats.skipped++; continue; }
    if (DRY) { guideMap.set(g.id, `dry-${g.id}`); stats.guides++; continue; }

    // Georgia's guides are country-level (no city/caza), which is why those
    // columns are left null rather than invented.
    const created = await lb.locationGuide.create({
      data: {
        country: g.country ?? 'GEORGIA',
        title: g.title,
        content: g.content ?? null,
        imageUrl: fixUrl(g.imageUrl),
        createdAt: g.createdAt,
      } as any,
    });
    guideMap.set(g.id, created.id);
    await record('location_guides', g.id, 'location_guides', created.id);
    stats.guides++;
  }

  // ── Properties → Building (+ Unit) (+ Listing) ────────────────────────────
  const taken = new Set<string>(
    (await lb.building.findMany({ select: { slug: true } })).map((b) => b.slug).filter(Boolean) as string[]
  );

  const props = await q(ge, `SELECT * FROM "properties" ORDER BY "createdAt" ASC`);
  const geUnits = await q(ge, `SELECT * FROM "units" ORDER BY "createdAt" ASC`);
  const unitsByProp = new Map<string, any[]>();
  for (const u of geUnits) {
    if (!unitsByProp.has(u.propertyId)) unitsByProp.set(u.propertyId, []);
    unitsByProp.get(u.propertyId)!.push(u);
  }

  for (const p of props) {
    if (await existing('properties', p.id, 'buildings')) { stats.skipped++; continue; }

    const children = unitsByProp.get(p.id) ?? [];
    const slug = await freeSlug(p.slug ?? '', taken);
    if (p.slug && slug !== p.slug) notes.push(`slug "${p.slug}" taken → "${slug}"`);

    const buildingData = {
      // Georgia stock is Georgian — the country field keeps the two markets
      // apart on a site that only ever shows Lebanon.
      country: p.country ?? 'GEORGIA',
      kind: children.length > 1 ? 'PROJECT' : 'STANDALONE',
      title: p.title,
      description: p.description ?? null,
      shortDescription: p.shortDescription ?? null,
      slug,
      city: p.city ?? null,
      neighborhood: p.district ?? null,
      address: p.address ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      locationUrl: p.locationUrl ?? null,
      status: p.status,
      // Imported stock stays hidden until it's reviewed — nothing appears on
      // the public Lebanon site by surprise.
      visibility: 'HIDDEN',
      images: fixUrls(p.images),
      youtubeUrls: p.youtubeUrls ?? [],
      videoUrl: fixUrl(p.videoUrl),
      virtualTourUrl: fixUrl(p.virtualTourUrl),
      highlightedFeatures: p.highlightedFeatures ?? [],
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      builtYear: p.builtYear ?? null,
      totalFloors: p.floors ?? null,
      parkingSpaces: p.parkingSpaces ?? 0,
      hasPool: p.hasPool ?? false,
      hasGym: p.hasGym ?? false,
      hasGarden: p.hasGarden ?? false,
      hasSecurity: p.hasSecurity ?? false,
      hasElevator: p.hasElevator ?? false,
      zipCode: p.zipCode ?? null,
      featured: p.featured ?? false,
      views: p.views ?? 0,
      agentId: p.agentId ? userMap.get(p.agentId) ?? null : null,
      locationGuideId: p.locationGuideId ? guideMap.get(p.locationGuideId) ?? null : null,
      developerId: p.developerId ? devMap.get(p.developerId) ?? null : null,
      hasCentralAC: p.hasCentralAC ?? false,
      availableFrom: p.availableFrom ?? null,
      reservedUntil: p.reservedUntil ?? null,
      soldAt: p.soldAt ?? null,
      createdAt: p.createdAt,
      publishedAt: p.publishedAt ?? null,
    };

    if (DRY) {
      // Everything a person would check before letting this touch the database.
      const kinds = (children.length ? children : [{ propertyType: null, name: '' }]).map(
        (u: any) => unitKindFor(u.propertyType ?? p.propertyType, `${p.title} ${u.name ?? ''}`)
      );
      const optionCount = children.length
        ? (
            await q(
              ge,
              `SELECT COUNT(*)::int AS n FROM "unit_options" WHERE "unitId" IN (${children
                .map((c: any) => `'${c.id}'`)
                .join(',')})`
            )
          )[0]?.n ?? 0
        : 0;
      const docCount =
        (await q(ge, `SELECT COUNT(*)::int AS n FROM "property_documents" WHERE "propertyId" = '${p.id}'`))[0]?.n ?? 0;
      const hasInv =
        ((await q(ge, `SELECT COUNT(*)::int AS n FROM "property_investment_data" WHERE "propertyId" = '${p.id}'`))[0]?.n ?? 0) > 0;

      const imgs: string[] = p.images ?? [];
      const proxied = imgs.filter((u) => /\/api\/files\//.test(u)).length;

      const warnings: string[] = [];
      if (!p.price || p.price <= 0) warnings.push('no price — no listing will be created');
      if (imgs.length === 0) warnings.push('no images');
      if (!p.description) warnings.push('no description');
      if (children.length === 0) warnings.push('no units — one will be implied from the property');
      if (p.developerId && !devMap.has(p.developerId)) warnings.push('developer not found');

      previews.push({
        title: p.title,
        slug,
        slugChanged: !!p.slug && slug !== p.slug,
        kind: children.length > 1 ? 'PROJECT' : 'STANDALONE',
        unitKinds: Array.from(new Set(kinds)),
        units: Math.max(children.length, 1),
        options: optionCount,
        price: p.price ?? null,
        currency: p.currency ?? 'USD',
        developer: p.developerId ? devNames.get(p.developerId) ?? null : null,
        guide: !!p.locationGuideId,
        investment: hasInv,
        docs: docCount,
        images: imgs.length,
        proxied,
        warnings,
      });

      stats.buildings++;
      stats.units += Math.max(children.length, 1);
      stats.unitOptions += optionCount;
      stats.listings += p.price && p.price > 0 ? 1 : 0;
      stats.investment += hasInv ? 1 : 0;
      stats.documents += docCount;
      rewrittenUrls += proxied;
      continue;
    }

    const building = await lb.building.create({ data: buildingData as any });
    await record('properties', p.id, 'buildings', building.id);
    stats.buildings++;

    // A property with no units still describes one physical thing, so it gets
    // a unit — that's where type, price and specs live in this model.
    const rows = children.length
      ? children
      : [{ id: `${p.id}-implied`, name: p.title, bedrooms: null, bathrooms: null, area: null, floor: p.floors, parkingSpaces: p.parkingSpaces, images: [], propertyType: null, availabilityStatus: p.availabilityStatus, notes: null, createdAt: p.createdAt }];

    const createdUnits: any[] = [];
    for (const u of rows) {
      const unit = await lb.unit.create({
        data: {
          buildingId: building.id,
          name: u.name ?? null,
          unitNumber: u.unitNumber ?? null,
          kind: unitKindFor(u.propertyType ?? p.propertyType, `${p.title} ${u.name ?? ''}`) as any,
          bedrooms: u.bedrooms ?? null,
          bathrooms: u.bathrooms ?? null,
          areaSqm: u.area ?? null,
          floor: u.floor ?? null,
          parkingSpaces: u.parkingSpaces ?? 0,
          images: fixUrls(u.images),
          notes: u.notes ?? null,
          createdAt: u.createdAt,
        } as any,
      });
      if (!String(u.id).endsWith('-implied')) {
        await record('units', u.id, 'units', unit.id);

        // Payment / finish choices attached to the unit. Identical shape on
        // both sides, and they carry the pricing a buyer actually sees.
        for (const o of await q(ge, `SELECT * FROM "unit_options" WHERE "unitId" = '${u.id}'`)) {
          if (await existing('unit_options', o.id, 'unit_options')) { stats.skipped++; continue; }
          const opt = await lb.unitOption.create({
            data: {
              unitId: unit.id,
              name: o.name,
              pricePerSqm: o.pricePerSqm ?? 0,
              currency: o.currency ?? 'USD',
              initialPayment: o.initialPayment ?? null,
              paymentPlanDetails: o.paymentPlanDetails ?? undefined,
              description: o.description ?? null,
              createdAt: o.createdAt,
            } as any,
          });
          await record('unit_options', o.id, 'unit_options', opt.id);
          stats.unitOptions++;
        }
      }
      createdUnits.push(unit);
      stats.units++;
    }

    // Investment metrics are the whole pitch for international stock, so they
    // come across with the property rather than being re-entered by hand.
    const inv = (await q(ge, `SELECT * FROM "property_investment_data" WHERE "propertyId" = '${p.id}'`))[0];
    if (inv) {
      await lb.buildingInvestmentData.create({
        data: {
          buildingId: building.id,
          expectedROI: inv.expectedROI ?? null,
          rentalYield: inv.rentalYield ?? null,
          capitalGrowth: inv.capitalGrowth ?? null,
          annualAppreciation: inv.annualAppreciation ?? null,
          minInvestment: inv.minInvestment ?? null,
          maxInvestment: inv.maxInvestment ?? null,
          downPaymentPercentage: inv.downPaymentPercentage ?? null,
          paymentPlan: inv.paymentPlan ?? null,
          paymentPlanDetails: inv.paymentPlanDetails ?? undefined,
          installmentYears: inv.installmentYears ?? null,
          isGoldenVisaEligible: inv.isGoldenVisaEligible ?? false,
          goldenVisaMinAmount: inv.goldenVisaMinAmount ?? null,
        } as any,
      });
      await record('property_investment_data', inv.id, 'building_investment_data', building.id);
      stats.investment++;
    }

    // Documents keep their existing file URLs — they point at a bucket that
    // stays online, so nothing has to be copied.
    for (const d of await q(ge, `SELECT * FROM "property_documents" WHERE "propertyId" = '${p.id}'`)) {
      if (await existing('property_documents', d.id, 'property_documents')) { stats.skipped++; continue; }
      const doc = await lb.propertyDocument.create({
        data: {
          buildingId: building.id,
          title: d.title,
          description: d.description ?? null,
          fileUrl: fixUrl(d.fileUrl) as string,
          fileSize: d.fileSize ?? null,
          mimeType: d.mimeType ?? null,
          type: d.type,
          isPublic: d.isPublic ?? false,
          createdAt: d.createdAt,
        } as any,
      });
      await record('property_documents', d.id, 'property_documents', doc.id);
      stats.documents++;
    }

    // Saved properties only mean something if the user came across too.
    for (const f of await q(ge, `SELECT * FROM "favorite_properties" WHERE "propertyId" = '${p.id}'`)) {
      const userId = userMap.get(f.userId);
      if (!userId) continue;
      if (await existing('favorite_properties', f.id, 'favorite_properties')) { stats.skipped++; continue; }
      try {
        const fav = await lb.favoriteProperty.create({
          data: { userId, buildingId: building.id, createdAt: f.createdAt } as any,
        });
        await record('favorite_properties', f.id, 'favorite_properties', fav.id);
        stats.favourites++;
      } catch {
        // Already a favourite of theirs on this side — harmless.
      }
    }

    // Price lives on the property in Georgia and on the listing here, so each
    // property becomes exactly one listing.
    if (p.price && p.price > 0) {
      const single = createdUnits.length === 1;
      const listing = await lb.listing.create({
        data: {
          subjectType: single ? 'UNIT' : 'BUILDING',
          buildingId: building.id,
          unitId: single ? createdUnits[0].id : null,
          intent: 'FOR_SALE',
          price: p.price,
          currency: (p.currency === 'LBP' ? 'LBP' : 'USD') as any,
          headline: p.title,
          description: p.description ?? null,
          slug: `${slug}-sale`,
          status: p.availabilityStatus === 'SOLD' ? 'CLOSED' : 'DRAFT',
          visibility: 'HIDDEN',
          createdAt: p.createdAt,
        } as any,
      });
      await record('properties', p.id, 'listings', listing.id);
      stats.listings++;
    }
  }

  // ── Report ───────────────────────────────────────────────────────────────
  h1('Result');
  log(`  users created            ${stats.users}`);
  log(`  users matched to existing ${stats.usersMerged}   (Lebanon account kept)`);
  log(`  developers               ${stats.developers}`);
  log(`  location guides          ${stats.guides}`);
  log(`  buildings                ${stats.buildings}`);
  log(`  units                    ${stats.units}`);
  log(`  unit options             ${stats.unitOptions}`);
  log(`  listings                 ${stats.listings}`);
  log(`  investment data          ${stats.investment}`);
  log(`  documents                ${stats.documents}`);
  log(`  favourites               ${stats.favourites}`);
  log(`  media URLs re-pointed    ${rewrittenUrls}   (proxy → ${GEORGIA_ASSETS})`);
  log(`  already imported, skipped ${stats.skipped}`);

  if (notes.length) {
    log('\n  Adjustments made:');
    for (const n of notes.slice(0, 20)) log(`    • ${n}`);
    if (notes.length > 20) log(`    …and ${notes.length - 20} more`);
  }

  if (DRY && previews.length) {
    h1('What will land, property by property');
    for (const v of previews) {
      log('');
      log(`  ${v.title}`);
      log(`    → ${v.kind}  ·  ${v.units} unit${v.units === 1 ? '' : 's'} (${v.unitKinds.join(', ')})  ·  ${v.options} option${v.options === 1 ? '' : 's'}`);
      log(`    → slug: ${v.slug}${v.slugChanged ? '   (renamed — original was taken)' : ''}`);
      log(
        `    → listing: ${v.price ? `${v.currency} ${Number(v.price).toLocaleString()}` : 'NONE'}` +
        `  ·  developer: ${v.developer ?? '—'}` +
        `  ·  guide: ${v.guide ? 'yes' : '—'}`
      );
      log(
        `    → investment data: ${v.investment ? 'yes' : '—'}` +
        `  ·  documents: ${v.docs}` +
        `  ·  images: ${v.images}${v.proxied ? ` (${v.proxied} re-pointed)` : ''}`
      );
      for (const w of v.warnings) log(`    !  ${w}`);
    }

    const totalWarnings = previews.reduce((n, v) => n + v.warnings.length, 0);
    h1('Before you run it for real');
    log(`  ${previews.length} properties reviewed, ${totalWarnings} thing${totalWarnings === 1 ? '' : 's'} worth a look above.`);
    log(`  Media is re-pointed to: ${GEORGIA_ASSETS}`);
    log(`  Open one of those URLs in a browser to confirm the host serves them.`);
    log(`  Everything lands HIDDEN, so nothing appears on either website until you publish it.`);
  }

  if (DRY) {
    log('\n  DRY RUN — nothing was written. Re-run without --dry-run to apply.');
  } else {
    log(`\n  Imported as batch "${BATCH}".`);
    log(`  Everything landed HIDDEN — review it, then publish what you want live.`);
    log(`  To reverse:  tsx scripts/import-georgia.ts --undo ${BATCH}`);
  }
}

(IS_UNDO ? undo(UNDO) : run())
  .catch((e) => {
    console.error('\nFailed:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await lb.$disconnect();
    await ge?.$disconnect();
  });
