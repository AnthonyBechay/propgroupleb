/**
 * Which open clients are actually in play.
 *
 * "Open" (any status but WON / LOST / ARCHIVED) counts everybody who was never
 * closed off — every imported contact and every chat that went nowhere six
 * months ago. That is how the Overview said "125 open clients" while the board
 * showed a few dozen. A client is ACTIVE when something is happening with them:
 *
 *   - a live deal (a viewing or anything past it)
 *   - a chat message, or contact logged by hand, in the last 30 days
 *   - a follow-up planned, or someone put them on hold
 *   - they came in during the last 30 days
 *
 * Everyone else open is DORMANT: still on file, nothing moving.
 */

export const CLOSED_STATUSES = ['WON', 'LOST', 'ARCHIVED'];
export const LIVE_DEAL_STAGES = ['VIEWING_BOOKED', 'VIEWED', 'INTERESTED', 'OFFER_MADE', 'RESERVED'];
export const ACTIVE_WINDOW_DAYS = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function activeClientWhere(now = new Date()): Record<string, any> {
  const since = new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    status: { notIn: CLOSED_STATUSES },
    OR: [
      { opportunities: { some: { stage: { in: LIVE_DEAL_STAGES } } } },
      { conversations: { some: { lastMessageAt: { gte: since } } } },
      { lastContactAt: { gte: since } },
      { nextContactAt: { not: null } },
      { holdAt: { not: null } },
      { createdAt: { gte: since } },
    ],
  };
}
