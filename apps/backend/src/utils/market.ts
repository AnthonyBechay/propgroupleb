import type { Request } from 'express';

/**
 * Which market a request is about.
 *
 * One admin, one database, two public websites:
 *
 *   propgrouplb.com   Lebanese real estate
 *   propgrp.com       everything else — Georgia today, Cyprus/Greece if they
 *                     come back
 *
 * A property belongs to a site by its `country`, and that is what decides where
 * it appears — not its visibility, which only says whether it is live at all.
 * Without this, publishing an imported Georgian tower would put it on the
 * Lebanese site.
 */

export const COUNTRIES = ['LEBANON', 'GEORGIA', 'CYPRUS', 'GREECE'] as const;
export type MarketCountry = (typeof COUNTRIES)[number];

/** The two audiences. Deliberately not one-country-per-site: the international
 *  site sells whatever isn't Lebanon, so adding a country never needs a deploy. */
export type SiteScope = 'LEBANON' | 'INTERNATIONAL';

/**
 * Which site this deployment is.
 *
 * Set SITE_SCOPE=INTERNATIONAL on the propgrp.com deployment. Left unset it
 * means Lebanon, so the existing site behaves exactly as it does today.
 */
export function siteScope(): SiteScope {
  return (process.env.SITE_SCOPE ?? '').toUpperCase() === 'INTERNATIONAL'
    ? 'INTERNATIONAL'
    : 'LEBANON';
}

/**
 * A Prisma `country` filter for a public request, or undefined for everything.
 *
 * `?country=` targets one country and `?country=all` lifts the scope for the
 * admin — which is the whole point of a single back office. Anything
 * unrecognised falls back to this site's own scope rather than leaking the
 * other market's stock.
 */
export function publicCountryFilter(
  req: Request
): MarketCountry | { not: 'LEBANON' } | undefined {
  const asked = String(req.query.country ?? '').toUpperCase();
  if (asked === 'ALL') return undefined;
  if ((COUNTRIES as readonly string[]).includes(asked)) return asked as MarketCountry;
  return siteScope() === 'INTERNATIONAL' ? { not: 'LEBANON' } : 'LEBANON';
}
