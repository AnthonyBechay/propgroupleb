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
- **Focus**: Lebanon real estate. This instance should not include Georgia/Batumi/Tbilisi copy.

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

---

## Known deferred work (post-launch)

- Token blacklist / refresh token rotation
- Soft deletes for Property, User
- Bulk CSV/Excel export for admin
- MapView (placeholder removed; needs a real mapping library before re-adding)
- PKCE for Google OAuth
- Portfolio page real data integration
- Field-level encryption for PII
- Webhook system for external integrations
- Wire up reserved Prisma models (Transaction, Notification, Message, …) when those features land

---

## Build & deploy

- `pnpm install` auto-runs `prisma generate` via the `postinstall` hook in `packages/db` — no manual step needed on fresh clones or after schema changes.
- `pnpm build` runs `scripts/build.js`: packages first (config → db), then backend, then web.
- Dockerfiles for both apps live alongside their code (`apps/backend/Dockerfile`, `apps/web/Dockerfile`). Root `docker-compose.yml` wires them for Coolify-style deploys.
- Split deploys (Vercel + Render, etc.) work too — set env vars in the host panel, that's it.
