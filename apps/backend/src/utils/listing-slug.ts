import { prisma } from '@propgroup/db';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** `<base>-<4 random chars>`, unique among listings (current and previous slugs). */
export async function generateListingSlug(base: string, tx?: any): Promise<string> {
  const slugBase = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'property';
  const db = tx || prisma;
  for (;;) {
    const candidate = `${slugBase}-${Math.random().toString(36).substring(2, 6)}`;
    const exists = await db.listing.findFirst({
      where: { OR: [{ slug: candidate }, { previousSlugs: { has: candidate } }] },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
}

/** What a listing with no headline is named after: its property, plus the unit. */
export async function listingSlugSource(buildingId: string | null | undefined, unitId: string | null | undefined, tx?: any): Promise<string> {
  const db = tx || prisma;
  const u = unitId
    ? await db.unit.findUnique({ where: { id: unitId }, select: { name: true, unitNumber: true, buildingId: true } })
    : null;
  const bId = buildingId || u?.buildingId;
  const b = bId ? await db.building.findUnique({ where: { id: bId }, select: { title: true } }) : null;
  const source = [b?.title, u?.name, u?.unitNumber].filter(Boolean).join(' ');
  return source.replace(/[^a-z0-9]/gi, '') ? source : 'property';
}

/** The old auto-generated `listing-<timestamp>-<rand>` addresses. */
export const TIMESTAMP_SLUG = /^listing-\d{10,}-[a-z0-9]+$/;
