/**
 * Weighted matching between what a client wants and what's available.
 *
 * The point is that a *majority* fit is useful — a buyer looking for a 3-bed in
 * Achrafieh at $300k should still see a 2-bed in Achrafieh at $320k. So instead
 * of filtering rows out, we score every candidate on independent criteria and
 * rank them. Criteria the lead didn't specify are simply not counted (they
 * neither help nor hurt), so a sparse lead still produces sensible results.
 *
 * Score is 0–100 = (points earned / points available) × 100, where "available"
 * only counts criteria the lead actually expressed.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MatchCriterion {
  label: string;
  weight: number;
  /** 0 = miss, 1 = exact, in-between = partial (e.g. slightly over budget). */
  score: number;
  detail?: string;
  /**
   * A miss so fundamental that no amount of fit elsewhere rescues it — someone
   * who wants land will not buy an apartment in a nice area. Fatal criteria
   * zero the whole match instead of merely costing it their weight.
   */
  fatal?: boolean;
}

export interface MatchResult {
  /** 0–100 */
  score: number;
  criteria: MatchCriterion[];
  /** Short human reasons, best first — shown as chips in the UI. */
  reasons: string[];
  misses: string[];
}

const WEIGHTS = {
  location: 35,
  unitKind: 25,
  budget: 25,
  beds: 10,
  intent: 5,
};

/** Case/space-insensitive comparison of location labels. */
function norm(v?: string | null): string {
  return (v ?? '').trim().toLowerCase();
}

/**
 * Location fit. Exact area hit scores full; same region scores partial — a
 * client asking for "Achrafieh" is still plausibly interested in Beirut.
 */
function scoreLocation(
  wantAreas: string[],
  wantRegions: string[],
  haveAreas: (string | null | undefined)[],
  haveRegion?: string | null,
): MatchCriterion | null {
  if (!wantAreas.length && !wantRegions.length) return null; // not specified

  const have = haveAreas.map(norm).filter(Boolean);
  const wantedAreas = wantAreas.map(norm).filter(Boolean);

  // Substring both ways so "Jal El Dib" matches "Jal El Dib Highway".
  const areaHit = wantedAreas.find((w) => have.some((h) => h === w || h.includes(w) || w.includes(h)));
  if (areaHit) {
    return { label: 'Location', weight: WEIGHTS.location, score: 1, detail: `In ${areaHit.replace(/\b\w/g, (c) => c.toUpperCase())}` };
  }

  if (wantRegions.length && haveRegion && wantRegions.includes(haveRegion)) {
    return { label: 'Location', weight: WEIGHTS.location, score: 0.6, detail: 'Same region, different area' };
  }

  return { label: 'Location', weight: WEIGHTS.location, score: 0, detail: 'Different area' };
}

/**
 * Property families for matching purposes.
 *
 * Substituting within a family is a conversation worth having — a villa hunter
 * might look at a townhouse, a shop hunter at a showroom. Substituting across
 * families never is: land, a flat, a warehouse and a parking spot are different
 * purchases, not different flavours of the same one.
 *
 * These are deliberately NOT the UI's groups in property-types.ts, which exist
 * to organise a dropdown — that file files land, storage and parking together
 * under "Other", which would make a parking spot a near-match for a land buyer.
 */
const KIND_FAMILY: Record<string, string> = {
  APARTMENT: 'RESIDENTIAL',
  STUDIO: 'RESIDENTIAL',
  DUPLEX: 'RESIDENTIAL',
  PENTHOUSE: 'RESIDENTIAL',
  VILLA: 'RESIDENTIAL',
  TOWNHOUSE: 'RESIDENTIAL',

  SHOP: 'COMMERCIAL',
  OFFICE: 'COMMERCIAL',
  SHOWROOM: 'COMMERCIAL',
  WAREHOUSE: 'COMMERCIAL',
  RESTAURANT: 'COMMERCIAL',
  CLINIC: 'COMMERCIAL',

  // An entire building is an investment product of its own — someone after one
  // apartment is not served by being sold the block it sits in.
  WHOLE_BUILDING: 'BUILDING',

  LAND_PARCEL: 'LAND',

  STORAGE: 'UTILITY',
  PARKING: 'UTILITY',
};

const familyOf = (kind?: string | null): string | null => (kind ? KIND_FAMILY[kind] ?? null : null);

const KIND_LABEL = (kind: string) =>
  kind.charAt(0) + kind.slice(1).toLowerCase().replace(/_/g, ' ');

/**
 * Type fit. An exact kind scores full, a different kind in the same family
 * scores partial, and a different family is fatal — see `fatal` on
 * MatchCriterion for why that isn't just a heavy penalty.
 */
function scoreUnitKind(want: string[], have?: string | null): MatchCriterion | null {
  if (!want.length) return null;
  if (!have) return { label: 'Type', weight: WEIGHTS.unitKind, score: 0, detail: 'Type unknown' };

  if (want.includes(have)) {
    return { label: 'Type', weight: WEIGHTS.unitKind, score: 1, detail: KIND_LABEL(have) };
  }

  const haveFamily = familyOf(have);
  const sameFamily = haveFamily != null && want.some((w) => familyOf(w) === haveFamily);
  if (sameFamily) {
    return {
      label: 'Type',
      weight: WEIGHTS.unitKind,
      score: 0.5,
      detail: `${KIND_LABEL(have)} — close to what they asked for`,
    };
  }

  const wanted = want.map(KIND_LABEL).join(' or ');
  return {
    label: 'Type',
    weight: WEIGHTS.unitKind,
    score: 0,
    fatal: true,
    detail: `Wants ${wanted}, this is ${KIND_LABEL(have)}`,
  };
}

/**
 * Budget fit with tolerance — within range is perfect, up to 20% over still
 * scores partially because most asking prices are negotiable.
 */
function scoreBudget(min: number | null, max: number | null, price?: number | null): MatchCriterion | null {
  if (min == null && max == null) return null;
  if (price == null) return { label: 'Budget', weight: WEIGHTS.budget, score: 0 };

  if (min != null && price < min) {
    // Cheaper than expected is rarely a dealbreaker.
    return { label: 'Budget', weight: WEIGHTS.budget, score: 0.8, detail: 'Below their range' };
  }
  if (max != null && price > max) {
    const over = (price - max) / max;
    if (over <= 0.1) return { label: 'Budget', weight: WEIGHTS.budget, score: 0.7, detail: `${Math.round(over * 100)}% over budget` };
    if (over <= 0.2) return { label: 'Budget', weight: WEIGHTS.budget, score: 0.4, detail: `${Math.round(over * 100)}% over budget` };
    return { label: 'Budget', weight: WEIGHTS.budget, score: 0, detail: 'Well over budget' };
  }
  return { label: 'Budget', weight: WEIGHTS.budget, score: 1, detail: 'In budget' };
}

/**
 * Bedroom fit. One bedroom short is worth a phone call — a family after a 3-bed
 * will look at a good 2-bed. Two or more short is a different product: someone
 * who needs three bedrooms cannot live in a studio, however well it scores on
 * location and price, so it's fatal rather than a 10-point deduction.
 */
function scoreBeds(want: number | null, have?: number | null): MatchCriterion | null {
  if (want == null) return null;
  if (have == null) return { label: 'Bedrooms', weight: WEIGHTS.beds, score: 0, detail: 'Bedrooms unknown' };
  if (have >= want) return { label: 'Bedrooms', weight: WEIGHTS.beds, score: 1, detail: `${have} beds` };
  if (want - have === 1) return { label: 'Bedrooms', weight: WEIGHTS.beds, score: 0.5, detail: `${have} beds (1 short)` };
  return {
    label: 'Bedrooms',
    weight: WEIGHTS.beds,
    score: 0,
    fatal: true,
    detail: `Needs ${want} beds, this has ${have}`,
  };
}

function finalize(criteria: (MatchCriterion | null)[]): MatchResult {
  const used = criteria.filter(Boolean) as MatchCriterion[];
  const reasons = used.filter((c) => c.score >= 0.6).map((c) => c.detail || c.label);
  const misses = used.filter((c) => c.score < 0.4).map((c) => c.detail || `${c.label} mismatch`);

  // A fatal miss ends it. Scoring on would let a strong location carry a
  // property the client fundamentally cannot use.
  const fatal = used.filter((c) => c.fatal);
  if (fatal.length) {
    return { score: 0, criteria: used, reasons: [], misses };
  }

  const available = used.reduce((s, c) => s + c.weight, 0);
  const earned = used.reduce((s, c) => s + c.weight * c.score, 0);
  const score = available === 0 ? 0 : Math.round((earned / available) * 100);

  return { score, criteria: used, reasons, misses };
}

/** How well a live listing fits a buyer/renter lead. */
export function matchListingToLead(lead: any, listing: any): MatchResult {
  const building = listing.building ?? listing.unit?.building;
  const unit = listing.unit;

  // Buying and renting are different transactions, not adjacent preferences —
  // showing a rental to a buyer wastes both their time and yours.
  const wantIntent = lead.type === 'RENTER' ? 'FOR_RENT' : 'FOR_SALE';
  const intentMatches = listing.intent === wantIntent;
  const intentCriterion: MatchCriterion = {
    label: 'Deal type',
    weight: WEIGHTS.intent,
    score: intentMatches ? 1 : 0,
    fatal: !intentMatches,
    detail: intentMatches
      ? listing.intent === 'FOR_RENT' ? 'For rent' : 'For sale'
      : `Wants ${wantIntent === 'FOR_RENT' ? 'to rent' : 'to buy'}, this is ${listing.intent === 'FOR_RENT' ? 'for rent' : 'for sale'}`,
  };

  return finalize([
    scoreLocation(
      lead.areas ?? [],
      lead.regions ?? [],
      [building?.city, building?.neighborhood, building?.caza],
      building?.mohafazat,
    ),
    scoreUnitKind(lead.unitKinds ?? [], unit?.kind),
    scoreBudget(lead.budgetMin ?? null, lead.budgetMax ?? null, listing.price != null ? Number(listing.price) : null),
    scoreBeds(lead.minBeds ?? null, unit?.bedrooms),
    intentCriterion,
  ]);
}

/**
 * How well a seller/landlord lead fits a buyer/renter lead — the "common
 * ground" case where we can introduce two clients to each other before the
 * property is even listed.
 */
export function matchLeadToLead(buyer: any, seller: any): MatchResult {
  // Both must be in the same market, otherwise there's nothing to broker.
  if (buyer.market !== seller.market) {
    return { score: 0, criteria: [], reasons: [], misses: ['Different market'] };
  }

  // The seller's asking price sits in budgetMin/Max too (what they want for it).
  const askingPrice = seller.budgetMin ?? seller.budgetMax ?? null;

  // Score against the seller's best-fitting kind, not whichever happens to be
  // first — a seller offering "shop or office" should match either request.
  const sellerKinds: string[] = seller.unitKinds ?? [];
  const kindCriterion = sellerKinds.length
    ? sellerKinds
        .map((k) => scoreUnitKind(buyer.unitKinds ?? [], k))
        .filter(Boolean)
        .sort((a, b) => (b as MatchCriterion).score - (a as MatchCriterion).score)[0] ?? null
    : scoreUnitKind(buyer.unitKinds ?? [], null);

  return finalize([
    scoreLocation(buyer.areas ?? [], buyer.regions ?? [], seller.areas ?? [], (seller.regions ?? [])[0]),
    kindCriterion,
    scoreBudget(buyer.budgetMin ?? null, buyer.budgetMax ?? null, askingPrice),
    scoreBeds(buyer.minBeds ?? null, seller.minBeds ?? null),
  ]);
}

/**
 * Minimum score for a pairing to be worth showing. Shared by the drawer's match
 * lists AND the "has matches to explore" counter — if these ever diverge, the
 * board shows a match the filter doesn't count (which is exactly what happened
 * when they were 45 and 60).
 */
export const MATCH_MIN_SCORE = 45;

/**
 * Statuses a counterpart can be in and still be worth pairing with. WON is
 * excluded because that client is done; NEW is included because a fresh lead is
 * a perfectly good match.
 */
export const PAIRABLE_STATUSES = ['NEW', 'ACTIVE', 'VIEWING', 'NEGOTIATING'];

/** Leads whose type means they have something to offer. */
export const SUPPLY_TYPES = ['SELLER', 'LANDLORD'];
/** Leads whose type means they're looking for something. */
export const DEMAND_TYPES = ['BUYER', 'RENTER', 'INVESTOR'];
