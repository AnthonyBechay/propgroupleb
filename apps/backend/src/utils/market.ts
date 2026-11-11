import type { Request } from 'express';
import { z } from 'zod';

/**
 * Which market a request is about.
 *
 * One backend and one database serve two public websites:
 *
 *   propgrouplb.com   Lebanese real estate
 *   propgrp.com       everything else, whichever countries that is
 *
 * A property belongs to a site by its `country`. Visibility only says whether
 * it is live at all; `country` says where it appears.
 *
 * This is decided **per request, not per process**. An env var would be wrong
 * the moment both sites call the same backend — whichever value it held, the
 * other site would be served the wrong market's stock.
 */

/**
 * A country, as stored: upper-case, words joined by underscores — "LEBANON",
 * "GEORGIA", "UNITED_ARAB_EMIRATES".
 *
 * There is no list of countries anywhere in the code. There used to be an enum
 * of four, so listing a project in a fifth needed a schema change and a deploy.
 * The only country the code ever names is LEBANON; every other value is simply
 * "international" and appears on propgrp.com the moment it is saved.
 */
export function normaliseCountry(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.length >= 2 && cleaned.length <= 60 ? cleaned : null;
}

/** "UNITED_ARAB_EMIRATES" → "United Arab Emirates". */
export function countryLabel(country: unknown): string {
  const code = normaliseCountry(country);
  if (!code) return '';
  return code
    .split('_')
    .map((w) => (['OF', 'AND', 'THE'].includes(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

/** A country on a request body: any name, stored normalised. */
export const countrySchema = z
  .string()
  .max(80)
  .transform((v, ctx) => {
    const code = normaliseCountry(v);
    if (!code) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a country name' });
      return z.NEVER;
    }
    return code;
  });

/**
 * Which side of the business a CLIENT belongs to. Two values, not a country:
 * Lebanon is local sale and rent, international is everything sold abroad.
 */
export const MARKETS = ['LEBANON', 'INTERNATIONAL'] as const;
export type Market = (typeof MARKETS)[number];

/**
 * A market from outside the code: a request, an env var, a saved setting.
 * Anything written before "international" existed named the one country sold
 * abroad at the time; it means the same thing, so it is read as such.
 */
export function normaliseMarket(value: unknown): Market | null {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'LEBANON') return 'LEBANON';
  if (v === 'INTERNATIONAL' || v === LEGACY_INTERNATIONAL) return 'INTERNATIONAL';
  return null;
}
/** The pre-rename name of the international market, in old env vars and saved settings. */
const LEGACY_INTERNATIONAL = 'GEORGIA';

/** The market a property's country puts it in. */
export function marketOfCountry(country: unknown): Market {
  return normaliseCountry(country) === 'LEBANON' || !country ? 'LEBANON' : 'INTERNATIONAL';
}

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
): string | { not: 'LEBANON' } | undefined {
  const asked = String(req.query.country ?? '').trim();
  if (asked.toUpperCase() === 'ALL') return undefined;
  // One named country, whichever it is.
  const one = asked ? normaliseCountry(asked) : null;
  if (one) return one;

  // One back office for both markets: a signed-in admin sees everything unless
  // they narrow it themselves. Scoping the admin to a single country is what
  // hid imported international stock from /admin/buildings, and every future
  // admin screen would have had to remember to opt out.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (req as any).user?.role;
  if (role && ['ADMIN', 'SUPER_ADMIN', 'CRM_MANAGER'].includes(role)) return undefined;

  return requestScope(req) === 'INTERNATIONAL' ? { not: 'LEBANON' } : 'LEBANON';
}
