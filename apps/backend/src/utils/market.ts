import type { Request } from 'express';

/**
 * Which market a request is about.
 *
 * One backend and one database serve two public websites:
 *
 *   propgrouplb.com   Lebanese real estate
 *   propgrp.com       everything else — Georgia today, Cyprus/Greece if they come back
 *
 * A property belongs to a site by its `country`. Visibility only says whether
 * it is live at all; `country` says where it appears.
 *
 * This is decided **per request, not per process**. An env var would be wrong
 * the moment both sites call the same backend — whichever value it held, the
 * other site would be served the wrong market's stock.
 */

export const COUNTRIES = ['LEBANON', 'GEORGIA', 'CYPRUS', 'GREECE'] as const;
export type MarketCountry = (typeof COUNTRIES)[number];

/** The two audiences. International is "not Lebanon", never a fixed list, so
 *  adding a country never needs a deploy. */
export type SiteScope = 'LEBANON' | 'INTERNATIONAL';

/** Hosts that serve the international site, for the Origin/Referer fallback. */
function internationalHosts(): string[] {
  return (process.env.INTERNATIONAL_ORIGINS ?? 'propgrp.com')
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

/** Fallback for requests that declare nothing at all. */
export function defaultScope(): SiteScope {
  return (process.env.SITE_SCOPE ?? '').toUpperCase() === 'INTERNATIONAL'
    ? 'INTERNATIONAL'
    : 'LEBANON';
}

/**
 * Which site is asking.
 *
 * Checked in order of reliability:
 *
 *  1. `X-Site-Scope` header — the contract for the other frontend. Works from a
 *     browser *and* from its server-side rendering, which is the case an
 *     Origin-only scheme gets wrong: a Next.js server fetch sends no Origin.
 *  2. Origin / Referer — covers a browser call where nobody set the header.
 *  3. SITE_SCOPE env — the last resort, and correct when a deployment really
 *     does serve one market.
 */
export function requestScope(req: Request): SiteScope {
  const declared = String(req.get('x-site-scope') ?? '').toUpperCase();
  if (declared === 'INTERNATIONAL' || declared === 'LEBANON') return declared;

  const origin = req.get('origin') ?? req.get('referer') ?? '';
  if (origin) {
    const host = origin.toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
    if (internationalHosts().some((h) => host === h || host.endsWith(`.${h}`))) {
      return 'INTERNATIONAL';
    }
  }

  return defaultScope();
}

/**
 * The Prisma `country` filter for a public request, or undefined for everything.
 *
 * `?country=` targets one country and `?country=all` lifts the scope, which is
 * what the shared admin uses.
 */
export function publicCountryFilter(
  req: Request
): MarketCountry | { not: 'LEBANON' } | undefined {
  const asked = String(req.query.country ?? '').toUpperCase();
  if (asked === 'ALL') return undefined;
  if ((COUNTRIES as readonly string[]).includes(asked)) return asked as MarketCountry;

  // One back office for both markets: a signed-in admin sees everything unless
  // they narrow it themselves. Scoping the admin to a single country is what
  // hid imported Georgian stock from /admin/buildings, and every future admin
  // screen would have had to remember to opt out.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (req as any).user?.role;
  if (role && ['ADMIN', 'SUPER_ADMIN', 'CRM_MANAGER'].includes(role)) return undefined;

  return requestScope(req) === 'INTERNATIONAL' ? { not: 'LEBANON' } : 'LEBANON';
}
