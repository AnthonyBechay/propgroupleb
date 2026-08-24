/**
 * Keeps a client's pipeline status honest, derived from their live deals.
 *
 * The broker reality this encodes: a client is only "Viewing" while a viewing
 * is actually booked, and only "Negotiating" while an offer is out. When a
 * viewing falls through, the client isn't lost — they drop back to Active and
 * become someone who needs fresh options. Asking the team to remember to move
 * cards by hand is how a pipeline goes stale, so we compute it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type OpportunityStage =
  | 'SUGGESTED' | 'SHARED' | 'VIEWING_BOOKED' | 'VIEWED'
  | 'INTERESTED' | 'OFFER_MADE' | 'WON' | 'REJECTED';

/** Stages that mean the deal is finished, one way or the other. */
export const CLOSED_STAGES: OpportunityStage[] = ['WON', 'REJECTED'];
/** Stages where the ball is in the client's court / in motion. */
export const LIVE_STAGES: OpportunityStage[] = ['SHARED', 'VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE'];

/**
 * The status a lead should have, given its opportunities. Returns null when the
 * current status should be left alone (manual states we never override).
 */
export function deriveLeadStatus(
  currentStatus: string,
  opportunities: Array<{ stage: string }>,
): string | null {
  const stages = opportunities.map((o) => o.stage);
  const hasLive = stages.some((s) => LIVE_STAGES.includes(s as OpportunityStage));

  // Terminal states are the team's call, not ours — with one exception. A past
  // client who comes back is the whole point of keeping them: shortlisting
  // something new for them is a deliberate act, and leaving them filed under
  // "past client" while a live deal runs would hide the work. ARCHIVED is
  // excluded because parking someone is itself deliberate.
  if (currentStatus === 'WON' || currentStatus === 'LOST') {
    return hasLive ? 'ACTIVE' : null;
  }
  if (currentStatus === 'ARCHIVED') return null;

  // A live deal outranks a historical win. Someone viewing their second
  // property is not a past client, whatever they bought last year — and
  // checking WON first hid exactly that: the board filed them under
  // "bought / sold" while a viewing was booked for tomorrow.
  if (stages.includes('OFFER_MADE') || stages.includes('INTERESTED')) return 'NEGOTIATING';
  if (stages.includes('VIEWING_BOOKED')) return 'VIEWING';
  if (hasLive) return 'ACTIVE';

  // Nothing in flight, but they closed something: they're a past client.
  if (stages.includes('WON')) return 'WON';

  // No live deals. A client we've already engaged goes back to searching rather
  // than sitting in a stage that no longer reflects anything.
  if (currentStatus === 'NEW') return null; // never touched yet — leave as New
  return 'ACTIVE';
}

/**
 * True when this client is waiting on *us* for fresh options: we've engaged
 * them, everything we showed is closed out, and nothing is in flight. This is
 * the single most actionable signal in the CRM.
 */
export function needsNewOptions(
  lead: { status: string },
  opportunities: Array<{ stage: string }>,
): boolean {
  if (['NEW', 'WON', 'LOST', 'ARCHIVED'].includes(lead.status)) return false;
  if (opportunities.length === 0) return false; // nothing shown yet — different problem
  const hasLive = opportunities.some((o) => LIVE_STAGES.includes(o.stage as OpportunityStage));
  const hasRejection = opportunities.some((o) => o.stage === 'REJECTED');
  return !hasLive && hasRejection;
}

/** True when a viewing happened but nobody recorded what the client thought. */
export function awaitingFeedback(opportunities: Array<{ stage: string }>): boolean {
  return opportunities.some((o) => o.stage === 'VIEWED');
}

/**
 * Rejection reasons that say something actionable about the client's criteria,
 * mapped to the advice we surface to the broker.
 */
export const REASON_INSIGHT: Record<string, string> = {
  PRICE_TOO_HIGH: 'Show cheaper options or revisit their budget',
  TOO_SMALL: 'Raise the minimum area / bedrooms',
  TOO_BIG: 'Try smaller units',
  LOCATION: 'Their area preferences may need rethinking',
  CONDITION: 'Filter for newer or renovated properties',
  LAYOUT: 'Check the layout before the next viewing',
  FLOOR_LEVEL: 'Note their preferred floor',
  NO_PARKING: 'Only show properties with parking',
  NOISE: 'Avoid main roads / busy areas',
  NO_VIEW: 'Prioritise properties with a view',
  NO_ELEVATOR: 'Only show buildings with an elevator',
  BUILDING_QUALITY: 'Focus on better-maintained buildings',
};

/**
 * Turn a client's rejection history into short hints for the broker — e.g.
 * three "too small" rejections means the search criteria are wrong, not the
 * properties.
 */
export function rejectionInsights(
  opportunities: Array<{ stage: string; rejectionReason?: string | null }>,
): Array<{ reason: string; count: number; advice: string }> {
  const counts = new Map<string, number>();
  for (const o of opportunities) {
    if (o.stage !== 'REJECTED' || !o.rejectionReason) continue;
    counts.set(o.rejectionReason, (counts.get(o.rejectionReason) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([reason, count]) => count >= 2 && REASON_INSIGHT[reason])
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count, advice: REASON_INSIGHT[reason] }));
}
