/**
 * Keep a unit's real-world lifecycle and its marketing listings consistent.
 *
 * Two status systems coexist on a unit:
 *   - Unit.lifecycle   (DRAFT / FOR_SALE / RESERVED / SOLD / FOR_RENT / RENTED / …)
 *     the asset's actual state.
 *   - Listing.status   (DRAFT / ACTIVE / UNDER_OFFER / CLOSED / ARCHIVED)
 *     the public marketing offer. ACTIVE + PUBLIC is what shows on the site.
 *
 * Historically these were edited independently, so an admin could mark a unit
 * SOLD while its listing stayed ACTIVE — the sold apartment kept showing as
 * available and customers could inquire on it. These helpers close that gap by
 * propagating a change on one side to the other. Each helper is conservative:
 * it only moves status in the "safe" direction and never resurrects a closed
 * listing or downgrades a more-final lifecycle.
 *
 * Both run inside the caller's Prisma transaction so the unit and its listings
 * commit together. `tx` is typed loosely to avoid coupling to the generated
 * Prisma client type here.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type UnitLifecycle =
  | 'DRAFT' | 'FOR_SALE' | 'RESERVED' | 'SOLD' | 'OWNER_OCCUPIED'
  | 'FOR_RENT' | 'RENTED' | 'VACANT' | 'OFF_MARKET';

export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'UNDER_OFFER' | 'CLOSED' | 'ARCHIVED';
export type ListingIntent = 'FOR_SALE' | 'FOR_RENT';

/** Lifecycles that mean "this unit is no longer on the market." */
export const TERMINAL_LIFECYCLES: UnitLifecycle[] = ['SOLD', 'RENTED', 'OWNER_OCCUPIED', 'OFF_MARKET'];

/** Lifecycles in which a unit is genuinely marketable as available. */
export const MARKETABLE_LIFECYCLES: UnitLifecycle[] = ['FOR_SALE', 'FOR_RENT', 'RESERVED'];

/**
 * A unit's lifecycle changed → reflect it on that unit's listings.
 *
 *   SOLD / RENTED / OWNER_OCCUPIED / OFF_MARKET → close any ACTIVE/UNDER_OFFER
 *     listing (CLOSED + closedAt + reason). The apartment stops showing publicly.
 *   RESERVED → move ACTIVE listings to UNDER_OFFER (still visible, "under offer").
 *   anything else → no change.
 *
 * Returns the number of listings updated (for audit / UI messaging).
 */
export async function syncListingsFromUnitLifecycle(
  tx: any,
  unitId: string,
  lifecycle: UnitLifecycle,
): Promise<number> {
  if (TERMINAL_LIFECYCLES.includes(lifecycle)) {
    const { count } = await tx.listing.updateMany({
      where: { unitId, status: { in: ['ACTIVE', 'UNDER_OFFER'] } },
      data: { status: 'CLOSED', closedAt: new Date(), closingReason: `Unit marked ${lifecycle}` },
    });
    return count;
  }
  if (lifecycle === 'RESERVED') {
    const { count } = await tx.listing.updateMany({
      where: { unitId, status: 'ACTIVE' },
      data: { status: 'UNDER_OFFER' },
    });
    return count;
  }
  if (lifecycle === 'FOR_SALE' || lifecycle === 'FOR_RENT') {
    // Deal fell through / unit re-listed: bring an UNDER_OFFER listing back to
    // ACTIVE so it shows publicly again. We deliberately do NOT reopen CLOSED
    // listings — a completed sale stays closed.
    const { count } = await tx.listing.updateMany({
      where: { unitId, status: 'UNDER_OFFER' },
      data: { status: 'ACTIVE', closedAt: null, closingReason: null },
    });
    return count;
  }
  return 0;
}

/**
 * A unit-listing's status changed → nudge the parent unit's lifecycle.
 *
 *   ACTIVE      → FOR_SALE / FOR_RENT  (only from a non-marketed state, so we
 *                 never clobber a RESERVED/SOLD unit by re-activating a listing)
 *   UNDER_OFFER → RESERVED             (only from FOR_SALE / FOR_RENT)
 *   CLOSED      → SOLD / RENTED        (the deal completed; never downgrade)
 *   DRAFT / ARCHIVED → no change       (purely a marketing-side action)
 *
 * Returns the new lifecycle if it changed, else null.
 */
export async function syncUnitLifecycleFromListing(
  tx: any,
  unitId: string,
  intent: ListingIntent,
  status: ListingStatus,
  currentLifecycle: UnitLifecycle,
): Promise<UnitLifecycle | null> {
  let target: UnitLifecycle | null = null;

  if (status === 'ACTIVE') {
    if (['DRAFT', 'VACANT', 'OFF_MARKET'].includes(currentLifecycle)) {
      target = intent === 'FOR_SALE' ? 'FOR_SALE' : 'FOR_RENT';
    }
  } else if (status === 'UNDER_OFFER') {
    if (['FOR_SALE', 'FOR_RENT'].includes(currentLifecycle)) {
      target = 'RESERVED';
    }
  } else if (status === 'CLOSED') {
    const done: UnitLifecycle = intent === 'FOR_SALE' ? 'SOLD' : 'RENTED';
    if (currentLifecycle !== done) target = done;
  }

  if (target && target !== currentLifecycle) {
    await tx.unit.update({ where: { id: unitId }, data: { lifecycle: target } });
    return target;
  }
  return null;
}
