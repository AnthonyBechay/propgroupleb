# PropGroup — Claude Code Instructions

Context for Claude (and human contributors) extending this codebase. Keep this file up to date whenever architectural decisions change.

---

## Testing & verification

- **Do NOT** run dev servers, `pnpm dev`, or previews unless explicitly asked.
- **Do NOT** run tests unless explicitly asked.
- For significant changes, verify with:
  - `pnpm --filter web run build`
  - `pnpm --filter propgroup-backend run build`
  - `pnpm --filter web run type-check`

---

## Project overview

- **Monorepo** (pnpm workspaces): `apps/web` (Next.js 15 App Router, React 19), `apps/backend` (Express 4)
- **Shared packages**: `packages/db` (Prisma schema + client), `packages/config` (Zod schemas, calculator formulas)
- **Database**: PostgreSQL + Prisma ORM
- **UI**: Tailwind CSS v4 + shadcn/ui. Component library is **local** to `apps/web` — there is no `@propgroup/ui` package (deleted).
- **Auth**: JWT in httpOnly cookies. Stateless — **no session store, no express-session**.
- **Storage**: Cloudflare R2, proxied through `/api/files/*` on the backend.
- **Email**: Resend (optional — feature-gated on `RESEND_API_KEY`).
- **AI**: Anthropic SDK for property search conversation (feature-gated on `ANTHROPIC_API_KEY`).
- **Focus**: one back office, two public websites. See **Markets** below.

---

## Markets (read before touching any public query)

One database and one admin serve two public sites:

| Site | Shows |
|---|---|
| propgrouplb.com | `Building.country = LEBANON` |
| propgrp.com | everything that **isn't** Lebanon (Georgia today; Cyprus/Greece exist in the enum) |

**Both frontends call this backend.** propgrp.com runs in its own container but
against this API and database, including its admin. So market scope is decided
**per request, never per process** — an env var would be wrong for one of the
two sites whatever value it held.

`apps/backend/src/utils/market.ts` owns it. `publicCountryFilter(req)` resolves,
in order:

1. `?country=` — explicit, and `?country=all` lifts the scope
2. **`X-Site-Scope: INTERNATIONAL`** header — the contract for propgrp.com. Works
   from the browser *and* from its server-side rendering, which an Origin-only
   scheme gets wrong: a Next.js server fetch sends no Origin header.
3. `Origin`/`Referer` matched against `INTERNATIONAL_ORIGINS` (default `propgrp.com`)
4. `SITE_SCOPE` env — last resort, correct only when a deployment serves one market

**A signed-in admin sees every market regardless**, which is what makes one back
office work. Add propgrp.com to `ALLOWED_ORIGINS`; auth cookies already use
`SameSite=None; Secure` in production, so cross-site login works.
- International is defined as "not Lebanon", never a fixed list — adding a
  country must never require a code change.
- Georgian stock lives in the same `Building`/`Unit`/`Listing` tables. There is
  no separate catalogue (one existed; it was removed as duplication).
- Location capture branches by country in `components/admin/LocationFields.tsx`:
  Lebanon uses the curated gazetteer (`lib/lebanon-locations.ts`), Georgia uses
  `GEORGIA_AREAS` from `lib/crm-locations.ts`. `mohafazat`/`caza` are Lebanese
  administrative divisions and stay null abroad.

---

## Reference codes

Human codes clients quote back over WhatsApp. `apps/backend/src/utils/reference.ts`.

- `PG-1042` a property · `PG-1042-2` a unit inside it.
- **One prefix on purpose.** Property type is mutable; a code must not be. The
  type badge sits next to the code anyway.
- A single-unit property shows just `PG-1042` — the `-1` adds nothing. The
  suffix appears only where several units must be told apart.
- Numbers come from a Postgres sequence, so a deleted code is never reissued.
- Listings have **no code of their own** — a listing shows the code of whatever
  it sells (`lib/reference.ts` on the web side).

---

## CRM (`apps/web/src/app/(admin)/admin/crm/**`)

Four views: **Overview** (state of the business), **Today** (what needs you now),
**Board** (pipeline), **All clients** (directory). Plus a drawer per client.

Vocabulary rules, learned the hard way:

- A client's status describes a **relationship**, not a deal. `WON` renders as
  **"Past client"** — you win a transaction, you don't win a person.
- **A live deal outranks a historical win.** Someone viewing their second
  property is not a past client. `deriveLeadStatus` checks live stages *before*
  WON for exactly this reason; the other order filed returning clients under
  "bought / sold" while a viewing sat booked for tomorrow.
- A past client **reactivates automatically** when you shortlist something new —
  keeping them is the point. `ARCHIVED` is excluded, because parking someone is
  itself a deliberate act.
- Deal stages (viewing, negotiating) belong to the **opportunity**, because one
  client can be viewing one property and negotiating another.
- There are **four intents**: buying, selling, looking to rent, renting out.
  An investor is a **buyer with a flag** (`Lead.isInvestor`), not a fifth type.
  `INVESTOR` remains in the DB enum only because Postgres can't drop a value.
- `Unit.isUnitType` marks a repeatable template ("1 bedroom" in a development
  many clients buy) rather than one specific apartment. Types never sell out —
  we broker stock, we don't own it. Which apartment a client actually got is
  recorded on the deal (`LeadOpportunity.soldUnitRef`).

Matching (`apps/backend/src/utils/lead-matching.ts`) scores on independent
criteria, but some misses are **fatal** rather than weighted: a different
property family, the wrong deal type, 2+ bedrooms short, or >50% over budget.
A strong location must never carry a property the client cannot use or afford.
Bedrooms aren't scored for investors or international stock.

---

## Visual conventions

- Grey-first neutrals (slate/gray) with a subtle charcoal primary. Avoid strong navy-forward styling in new work.
- CSS variables: bare HSL triples in `:root`, wrapped with `hsl(var(--…))` in the `@theme inline` block.
- Use `pg-` prefixed utilities from `src/styles/design-system.css` where available.
- **Three layouts**: main site (navbar + footer), `/portal/*` (its own sidebar), `/(admin)/admin/*` (sidebar + header). Pick the right one — don't wrap portal/admin pages in the marketing navbar.

---

## Caching strategy (important — read before adding any cache layer)

The app was cleaned up from a round of broken `unstable_cache` usage. The rules now:

- **Marketing pages** (`/`, `/about`, `/properties`, `/invest-in-*`): use per-page ISR via `export const revalidate = <seconds>`. Typical value: `60`. Admin CMS edits must surface within that window.
- **Portal and admin pages**: dynamic (server-rendered on demand). Don't cache.
- **No `unstable_cache`** unless you **also** wire up `revalidateTag(...)` at every mutation site. Historically the app had six `unstable_cache` wrappers with typo'd tags (`property-property`, `favorites-user`) that could never be invalidated, silently serving 5–60 min stale data. They were deleted wholesale. If you add one, test invalidation.
- **Prisma → API → page** is already fast enough. Prefer per-page `revalidate` over per-query caching.

---

## Prisma patterns

- **Client location**: generated into `node_modules/.pnpm/@prisma+client/…/.prisma/client`. Regenerated automatically by the `postinstall` hook in `packages/db/package.json`, so `pnpm install` never leaves you with stale types.
- **Include strategy**: `apps/backend/src/utils/prisma-includes.ts` exports three levels:
  - `PROPERTY_LIST_INCLUDE` — narrow, for list endpoints (public cards, admin tables). No full `agent`, unit data restricted to `{ id }`.
  - `PROPERTY_DETAIL_INCLUDE` — full, for single-property endpoints.
  - `PROPERTY_WITH_STATS_INCLUDE` — detail + aggregated counts.
  - **Never** use detail include for list views — it balloons payloads and query times.
- **User selects**: `USER_SELECT`, `USER_AUTH_SELECT`, `USER_ADMIN_SELECT` — pick the narrowest one.
- **Reserved models** (in `schema.prisma` but not yet wired into routes): `Developer`, `PropertyInvestmentData`, `Subscription`, `PropertyReservation`, `PropertyAmenity`, `PropertyPriceHistory`, `Tag`/`PropertyTag`, `PropertyOffer`, `PropertyTour`, `Transaction`, `Notification`, `Message`, `SystemSetting`. They're intentional — future features. Do **not** remove them without product sign-off.

---

## Backend patterns (`apps/backend/src/**`)

- **Routers**: one file per domain in `routes/*.ts`, all mounted in `index.ts`. Every new router must be imported + mounted there.
- **Handlers**: wrap in `asyncHandler(...)` from `utils/errors.ts` — surfaces rejections through the central error middleware.
- **Responses**: use helpers from `utils/response.ts`:
  - `sendSuccess(res, data, message?)`
  - `sendCreated(res, data, message?)`
  - `sendPaginated(res, items, pagination)`
  - `sendError(res, status, message)`
  - `sendNotFound(res, entityName)`
  - Don't write `res.status(...).json(...)` by hand unless you have a reason.
- **Pagination**: `parsePagination(req)` + `buildPaginationResponse(...)` from `utils/pagination.ts`.
- **Validation**: Zod schemas live in `schemas/index.ts`. Add new schemas there; use `.parse(req.body)`.
- **Env validation**: `utils/validate-env.ts` runs on boot. Required vars (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`) throw in production if missing. Recommended groups (R2, Google OAuth, Resend, Anthropic) warn only. When adding a new feature, wire its env vars into `RECOMMENDED_GROUPS`.
- **Admin audit**: any admin mutation must call `logAdminAction(action, targetType, targetId, metadata, req)` from `middleware/auth.ts`. This populates `AdminAuditLog` for compliance.
- **Upload pipeline**: `services/upload.service.ts` writes to R2 and returns a proxied URL (`${apiBase}/api/files/<key>`). `getFileBaseUrl()` throws in production if no base URL is configured — don't silently fall back to `localhost:3001` in prod.

---

## Auth flow (do not break)

- Signup / login hit backend, receive JWT in an httpOnly cookie named `token`.
- `authenticateToken` middleware decodes it on each request and attaches `req.user`.
- Logout is a single `res.clearCookie('token', …)` — stateless, no session to destroy.
- Google OAuth: Passport redirects to Google, callback sets the same JWT cookie.
- **Do not** add `express-session`, `passport.session()`, or `passport-jwt`. They were removed as dead code. JWT extraction happens inline in `authenticateToken`.

---

## Frontend patterns (`apps/web/src/**`)

- **Server components by default**; drop to `'use client'` only for interactivity.
- **API client**: `lib/api/client.ts` exports `apiClient` with typed methods for every endpoint. Add new methods here, don't inline `fetch` in components.
- **URL helpers**: `lib/utils/api-url.ts` — `normalizeApiUrl()` strips trailing `/api`, `normalizeFileUrl()` rewrites legacy R2 public URLs (`https://pub-*.r2.dev/…`) to the proxied form. Always route file URLs through `normalizeFileUrl` before rendering.
- **Contexts**: `AuthContext` (current user) and `ComparatorContext` (property comparison tray). Wrapped at the root in `app/layout.tsx`.
- **Dynamic imports** for heavy lazy-loaded client components: `dynamic(() => import('…'), { ssr: false, loading: () => null })`. Examples: `AIPropertySearch`, `CreatePropertyModal`, `EditPropertyModal`, `AIAssistantFab`.
- **Fonts**: `next/font/google` variable fonts only. Don't pass a `weight` array — that forces static weight files and bloats first paint.

---

## Share tokens

Two mechanisms coexist in `routes/share.ts`:

1. **`ShareToken` table** (current) — supports `PROPERTY`, `UNIT`, `UNIT_OPTION` scope; revocable; audit-logged.
2. **Legacy `Property.shareToken` column** — single property-level token, still honored as a fallback for previously shared links.

When generating new share links, always go through the `ShareToken` table. Don't extend the legacy field.

---

## What NOT to do

- ❌ Add `unstable_cache` without testing tag invalidation (silent staleness trap).
- ❌ Add `express-session`, `passport-jwt`, `connect-pg-simple`, `@types/express-session` — removed as dead deps.
- ❌ Re-create `@propgroup/ui` — components live in `apps/web/src/components/`.
- ❌ Use `PROPERTY_DETAIL_INCLUDE` in list endpoints.
- ❌ Return raw `res.json({...})` without status when a helper exists.
- ❌ Skip `logAdminAction` on admin mutations.
- ❌ Hardcode `http://localhost:3001` for file URLs in production code paths.
- ❌ Reference `SESSION_SECRET` — it was removed.
- ❌ Reference `docs/` or `COOLIFY_DEPLOYMENT.md` — both deleted.
- ❌ Write a data migration as SQL only — deployment uses `db push` and will never run it. Add a `once(...)` step in `utils/crm-bootstrap.ts`.
- ❌ Scope an admin query to one market. Admins see every country; only public pages are scoped.
- ❌ Add a fifth client "type". The four intents are fixed; anything else is a flag on the client.
- ❌ Put a deal stage on the client. Viewing/negotiating belong to the opportunity — a client can be at different stages on different properties.
- ❌ Assume a `Building`'s local `buildingSchema` in `routes/buildings.ts` is the shared one in `schemas/index.ts`. It shadows it; adding a field to the wrong one fails silently.

---

## Known deferred work (post-launch)

- Token blacklist / refresh token rotation
- Soft deletes for Property, User
- Bulk CSV/Excel export for admin
- MapView (placeholder removed; needs a real mapping library before re-adding)
- PKCE for Google OAuth
- Portfolio page real data integration
- Field-level encryption for PII
- Wire up reserved Prisma models (Transaction, Notification, Message, …) when those features land
- **propgrp.com still runs on its own codebase and database.** The unified back office holds its data; pointing that frontend at this API is unfinished. Options: a compatibility layer exposing the old `Property` shape, or updating that frontend to `/api/listings`.
- Mobile: the CRM board is horizontally-scrolling 228px columns — poor on a phone. Today and the client directory are fine.
- No duplicate detection when adding a client by hand.
- WhatsApp/Meta intake was built and then removed at the owner's request. If it returns, note that Coexistence (app + API on one number) requires Embedded Signup and Tech Provider status — a business cannot self-onboard its own number.

---

## Build & deploy

- `pnpm install` auto-runs `prisma generate` via the `postinstall` hook in `packages/db` — no manual step needed on fresh clones or after schema changes.
- `pnpm build` runs `scripts/build.js`: packages first (config → db), then backend, then web.
- Dockerfiles for both apps live alongside their code (`apps/backend/Dockerfile`, `apps/web/Dockerfile`). Root `docker-compose.yml` wires them for Coolify-style deploys.
- `apps/backend/Dockerfile` copies `scripts/` into `apps/backend/scripts` **on purpose** — Node resolves modules from a script's own directory, and pnpm's strict layout means a script at `/app/scripts` cannot see `@prisma/client`.

### Deployment runs `prisma db push`, not `migrate deploy`

This is the single most important thing to know before changing the schema.

- `db push --accept-data-loss` syncs columns to `schema.prisma` on every boot. It
  **drops anything the schema no longer declares**, and it **never runs a
  migration file**.
- So every sequence, backfill or data change lives in a boot routine instead:
  `utils/reference.ts` (`ensureReferenceCodes`) and `utils/crm-bootstrap.ts`
  (`normaliseCrmData`). Each step is guarded by a `SystemSetting` marker so it
  applies exactly once, and each has its own try/catch so one failure can't
  silently skip the next.
- **Adding a data migration means adding a `once(...)` step**, not just a
  migration file. A migration file alone will never run.
- Before deploying anything that removes a field, preview it:
  ```
  docker exec <backend> sh -c 'cd /app/apps/backend && sh scripts/preview-schema-changes.sh'
  ```
  It prints the exact SQL and changes nothing. Read every `DROP` before pushing.
### The `migrations/` folder does NOT reproduce the database

Verified, not assumed: `prisma migrate deploy` against an empty database fails
at `20260615000001_organizations` with *relation "buildings" does not exist*.
**No migration ever creates `buildings`** — the whole Building/Unit/Listing
model arrived through `db push`. The folder is a partial changelog, not a
runnable history, and several files describe columns that were later removed.

Treat migration files as documentation of intent. The schema of record is
`schema.prisma`; the data of record is production.

Switching to `migrate deploy` therefore needs a **squash**, not a resolve:

```
# 1. generate one baseline from the current schema
npx prisma migrate diff --from-empty \
  --to-schema-datamodel prisma/schema.prisma --script > baseline.sql
# 2. put it in a single migrations/<timestamp>_baseline/migration.sql
#    and archive everything older
# 3. on production, mark it as already applied
npx prisma migrate resolve --applied <timestamp>_baseline
# 4. change the compose command to `prisma migrate deploy`
```

Worth doing when there's a quiet week. Until then, the boot routines above are
the only reliable way to change data.
