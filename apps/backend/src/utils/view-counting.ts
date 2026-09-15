import type { Request } from 'express';

/**
 * Whether a request should count as a human viewing a property.
 *
 * Views used to be incremented as a side effect of *any* read of a building
 * detail endpoint. That made the counter a measure of machine traffic, not
 * interest: the Georgia storefront's list page hydrates every building in the
 * catalogue through `/api/buildings/slug/:slug` (because the list response
 * truncates units), so a single visitor to propgrp.com/properties recorded
 * **18 views** — one per project. Compounded by ISR and crawlers, projects
 * reached ~37,000 views.
 *
 * So a read is only a view when the caller says it is. Machine reads —
 * hydration, sitemap generation, prefetch, warming — send `X-Prefetch: 1` and
 * are not counted.
 *
 * This is deliberately opt-out rather than opt-in: an un-instrumented caller
 * still counts, so we never silently under-report real traffic. If the counter
 * looks inflated again, look for a new machine caller that isn't sending the
 * header.
 */
export function shouldCountView(req: Request): boolean {
  const prefetch = req.get('X-Prefetch');
  if (prefetch && prefetch !== '0' && prefetch.toLowerCase() !== 'false') return false;

  // Common crawler/preview signals. Not exhaustive, and not meant to be —
  // it just keeps the obvious non-humans out of the number.
  const ua = (req.get('User-Agent') || '').toLowerCase();
  if (!ua) return false;
  if (/bot|crawler|spider|slurp|headless|preview|lighthouse|curl|wget|node-fetch|axios|python-requests/.test(ua)) {
    return false;
  }

  return true;
}
