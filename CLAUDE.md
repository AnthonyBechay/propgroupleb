# PropGroup — Shared Backend & Central Back Office

> **This file describes `~/development/propgroupleb`** — the single backend, the
> central back office, and the Lebanon storefront (propgrouplb.com). It owns all
> property data, the CRM, and SEO generation **for both public sites**.
>
> Its sibling `~/development/propgroup` is the Georgia storefront (propgrp.com)
> and has its own CLAUDE.md with the same section headings.
>
> ⚠️ **176 of `propgroup`'s files share an identical relative path with a
> different file in this repo** — including `apps/backend/src/routes/properties.ts`,
> `packages/db/prisma/schema.prisma` and this file. Every workspace package name
> is identical too. In a session with both directories open, a bare path or a
> bare `pnpm --filter` is ambiguous. Read *Working across both repos* first.
>
> Quick tell you are in the right repo: this one's `packages/db/prisma/schema.prisma`
> has **38 models**. `propgroup`'s has 4.

---

## Working across both repos — read this first

Two repos, one platform. If your session has **both** directories open, both of
these CLAUDE.md files are in your context at once, and almost every path in them
is ambiguous.

| Repo | Absolute path | Owns | Deployed as |
|---|---|---|---|
| `propgroup` | `~/development/propgroup` | propgrp.com — **Georgia storefront**. Its own users, auth, CMS. No property data. | Coolify app (web + thin backend) |
| `propgroupleb` | `~/development/propgroupleb` | **The single backend + central back office**, plus propgrouplb.com (Lebanon storefront). Owns all property data, the CRM, SEO generation. | Coolify app (web + backend) |

### The collision hazard (this is not theoretical)

**176 of `propgroup`'s 207 tracked files have an identical relative path to a
different file in `propgroupleb`.** Both repos contain:

- `apps/backend/src/routes/properties.ts` — *different code, different purpose*
- `apps/backend/src/routes/{admin,auth,content,files,share,upload,users,location-guides}.ts`
- `apps/backend/src/{index.ts,schemas/index.ts}`
- `packages/db/prisma/schema.prisma` — **4 models vs 38**
- `apps/web/src/components/PropertyCard.tsx`, `lib/api/client.ts`
- `CLAUDE.md`, `README.md`, `docker-compose.yml`

**And every workspace package name is identical**: root `propgroup`, backend
`propgroup-backend`, web `web`, `@propgroup/db`, `@propgroup/config`.

### Rules that follow from that

1. **Never use a bare relative path.** Prefix every path with the repo:
   `propgroup/apps/backend/...` or `propgroupleb/apps/backend/...`, or use the
   absolute path. "Edit `routes/properties.ts`" is a coin flip.
2. **Never use a bare `pnpm --filter`.** `pnpm --filter propgroup-backend run build`
   resolves against whichever directory you happen to be in. Always pin the repo:
   ```bash
   pnpm -C ~/development/propgroup    --filter web run build
   pnpm -C ~/development/propgroupleb --filter propgroup-backend run build
   ```
   `pnpm -C` echoes the resolved path in its output — read it back to confirm you
   hit the repo you meant.
3. **Before editing any file whose path exists in both, state which repo you are
   editing** and confirm it from the file's own content (e.g. `propgroup`'s
   `schema.prisma` has 4 models; `propgroupleb`'s has 38).
4. **`@propgroup/db` is not shared code.** Each repo has its own, with a
   different schema. They are unrelated packages that happen to share a name.
5. **Don't "fix" drift between same-named files.** They are supposed to differ.

### Where does this task belong?

| Task | Repo |
|---|---|
| Property/unit/listing data, pricing, availability | `propgroupleb` |
| Back-office admin: buildings, units, listings, CRM | `propgroupleb` |
| SEO generation (the only generator) | `propgroupleb` |
| Lead handling, CRM pipeline | `propgroupleb` |
| Lebanon storefront UI | `propgroupleb` |
| **Georgia storefront UI**: landing, listing, filters, project page | `propgroup` |
| Georgia site's own accounts, auth, CMS content, branding | `propgroup` |
| The adapter that maps `Building`/`Unit`/`Listing` → flat `Property` | `propgroup` (moving upstream is deferred work) |
| Anything touching the public API contract between them | **both** — change `propgroupleb` first, then its consumer in `propgroup` |

### Shared invariants — true in both repos

- **One backend.** `propgroupleb` is the source of truth for property data. `propgroup` reads it over HTTP and must never hold a local catalogue.
- **One CRM.** All leads land in `propgroupleb`. `propgroup` forwards and stores nothing.
- **One SEO generator.** `propgroupleb/apps/backend/src/routes/ai-seo.ts`. `propgroup` only formats a fallback when the back office left the fields empty.
- **One storage write target.** Canonical bucket `propgroupleb` / `assets.propgrouplb.com`. The `propgroup` bucket is read-only legacy.
- **Market scope is per request, never per process.** `publicCountryFilter(req)` in `propgroupleb`; `?country=` + `X-Site-Scope: INTERNATIONAL` from `propgroup`. Default scope with neither is **Lebanon**.
- **`NEXT_PUBLIC_*` is inlined at build time** in both — changing one needs a rebuild, not a restart.
- **Changing `package.json` requires regenerating `pnpm-lock.yaml`** in that repo — both Dockerfiles install with `--frozen-lockfile`.

---

## Testing & verification — propgroupleb · backend + back office

- **Do NOT** run dev servers, `pnpm dev`, or previews unless explicitly asked.
- **Do NOT** run tests unless explicitly asked.
- For significant changes, verify with — **note the `-C`**, since the sibling
  repo uses the identical package names:
  ```bash
  pnpm -C ~/development/propgroupleb --filter web run build
  pnpm -C ~/development/propgroupleb --filter propgroup-backend run build
  pnpm -C ~/development/propgroupleb --filter web run type-check
  ```
  Each prints the resolved path — read it back to confirm the right repo.
- **After any dependency change**, also run
  `pnpm -C ~/development/propgroupleb install --frozen-lockfile`. The Dockerfile
  installs with that flag, so a `package.json` edit without a regenerated
  lockfile fails the deploy while building fine locally.
- **After changing anything on the public API**, verify the Georgia storefront
  still renders — it is a separate repo and its build won't catch a contract break:
  ```bash
  cd ~/development/propgroup && \
    SHARED_API_URL=https://api.propgrouplb.com node scripts/verify-shared-api.mjs
  ```

---

## Project overview — propgroupleb · backend + back office

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

`propgroupleb/apps/backend/src/utils/market.ts` owns it. `publicCountryFilter(req)` resolves,
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

**Which public endpoints actually apply it** (measured against live data — check
before assuming a new route is scoped):

| Endpoint | Scoped? |
|---|---|
| `GET /api/buildings` | ✅ `publicCountryFilter` — `?country=GEORGIA` and `X-Site-Scope` both work |
| `GET /api/listings` | ✅ `publicCountryFilter` via the header (`?country=` is not read here) |
| `GET /api/properties` | ✅ **since this was fixed** — it previously applied no filter at all |

`/api/properties` is a legacy alias over `Building`. It is public and it used to
return Lebanese and Georgian stock mixed together (83 rows, both countries) —
the one endpoint that leaked across markets. **Any new public read route must
call `publicCountryFilter(req)`.** Grep for it when adding one.

Note it also returns `price: null` on every row: it does not flatten
`Building` + `Unit` + `Listing`, so it is not usable as a storefront catalogue
endpoint. propgrp.com reads `/api/buildings` and does the flattening itself —
see *Serving propgrp.com* below.
- International is defined as "not Lebanon", never a fixed list — adding a
  country must never require a code change.
- Georgian stock lives in the same `Building`/`Unit`/`Listing` tables. There is
  no separate catalogue (one existed; it was removed as duplication).
- Location capture branches by country in `propgroupleb/apps/web/src/components/admin/LocationFields.tsx`:
  Lebanon uses the curated gazetteer (`propgroupleb/apps/web/src/lib/lebanon-locations.ts`), Georgia uses
  `GEORGIA_AREAS` from `propgroupleb/apps/web/src/lib/crm-locations.ts`. `mohafazat`/`caza` are Lebanese
  administrative divisions and stay null abroad.


---

## Serving propgrp.com (the Georgia storefront)

`propgroup` is a separate repo: a Next.js frontend plus a thin Express backend.
Its database holds four models — `User`, `AdminAuditLog`, `SiteContent`,
`SiteMedia` — and **no property data at all**. Everything else it reads from
here, or forwards to here.

What it consumes:

- `GET /api/buildings?country=GEORGIA` with `X-Site-Scope: INTERNATIONAL` — its
  catalogue. It hydrates each building's detail endpoint for unit areas and
  options, because the list truncates units to `{ id, kind, lifecycle }` and
  Georgian stock has no `Listing` rows, so price can only come from
  `pricePerSqm × areaSqm`.
- `GET /api/buildings/slug/:slug` — project detail (units + options embedded).
- `GET /api/location-guides?country=GEORGIA`.
- `POST /api/contact` — **all** its leads, both the contact form and property
  enquiries, forwarded server-side. Property enquiries arrive with
  `Project enquiry: PG-#### — <title>` as the subject. It stores no leads
  locally, so this CRM is the only place they exist.

Things to be careful of when changing this API:

- **`GET /api/buildings/:id/units` returns `[]`.** propgrp.com works around it by
  reading units from the building detail payload. Either fix it or leave it —
  but don't assume it works.
- **Numerics serialise as strings** (Prisma `Decimal` over JSON). Its mapper
  coerces defensively; anything new consuming this API must too.
- **`ref` is the reference code**, not `referenceCode`. Renaming it breaks
  propgrp.com's listing search, which matches on `PG-####`.
- **`Building.kind` is `STANDALONE`/`PROJECT`** — a building classification, not
  a property type. Don't repurpose it.
- **Adding a field to `Building` is free; renaming one is a cross-repo change.**
  `propgroup/apps/backend/src/utils/shared-mappers.ts` is the only consumer that
  matters, and it reads several candidate key names per value to survive drift.

### The SEO contract

`propgroupleb/apps/backend/src/routes/ai-seo.ts` (`POST /api/ai-seo/generate`) is the **only** SEO generator
across both sites, driven by the "Auto-write SEO" action in
`propgroupleb/apps/web/src/app/(admin)/admin/buildings/BuildingForm.tsx`, writing `Building.metaTitle` /
`metaDescription`.

It is **country-aware** via `marketFor(country)`. It previously hardcoded
Lebanon — every prompt said "a Lebanese property platform" and required
`'Lebanon'` in the meta title — which is why the Georgian catalogue was never
given metadata: the output would have been wrong. Georgia / Cyprus / Greece /
Lebanon each get their own wording, and an unknown country omits the cue rather
than guessing.

propgrp.com treats whatever is stored here as authoritative and only formats a
fallback when both fields are empty. So **generating SEO here is what makes it
appear on the Georgia site** — nothing else needs doing.

Do not add a second generator in the other repo. One was built there by mistake
and removed.
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

### The board is a pipeline of DEALS, not of people

`DealBoard.tsx` reads `GET /api/crm/deals` — one card per **opportunity**,
columns keyed on `OpportunityStage`. A client with three deals appears three
times, deliberately.

This replaced a client kanban (`LeadBoard.tsx`, deleted) whose columns were
`lead.status`. That board could not express the thing the business does every
week — the same client viewing an apartment in Achrafieh while negotiating a
studio in Batumi — because one client collapsed into one card in one column,
and dropping them in "Negotiating" never said *which* property. It also
contradicted the rule two sections down, which was right all along.

So the two axes are now separate, and neither is allowed to impersonate the
other:

- **`lead.status` is a relationship.** Derived by `syncLeadStatus` from the
  client's live deals. Nothing drags it directly any more.
- **`opportunity.stage` is a deal.** This is what the board moves.

`INTERESTED` and `OFFER_MADE` share one **Negotiating** column — the
distinction is real on the deal, but as columns they split one conversation in
two and left both looking empty.

Columns are named after the conversation, not the schema: **Enquiry → Details
sent → Viewing booked → Viewed → Negotiating → Reserved / paying → Closed**.
"Shortlisted" was replaced because it only described half of what lands there —
most deals start with a client asking about a property, not with us picking one.

**`RESERVED` exists because a sale abroad is a payment plan, not a signing.** A
Georgian client agrees, reserves the unit and pays instalments for months. That
sat wrongly in `OFFER_MADE` (the offer is settled) or `WON` (the money isn't
in). Viewing stages stay empty for those deals, which is correct — there is no
viewing.

**Deleting a client cascades to every deal they have.** `DELETE /api/crm/:id`
refuses unless `?confirmDeals=` echoes the exact count, because from a board of
deals an unlabelled bin reads as "remove this card" — and once did exactly
that. Removing one deal is `DELETE /opportunities/:oid`, on the card itself.

There is **one search box**, in the page toolbar, passed down as a prop. The
board and the client directory used to each own another one.

Commission is editable in place on a card. Chasing it through a drawer is why
so many closed deals had no figure against them. When none is recorded,
`dealCommission` forecasts from the asking price at `DEFAULT_COMMISSION_RATE`
and **labels it "est."** — never silently. It returns null rather than guess on
a non-USD price.

### Commission and `CRM_MANAGER`

`redactMoney` strips `commissionUsd` from every `/api/crm` response for a role
that may not see it (one `res.json` wrapper at the top of the router, not 24
call sites). `stripMoneyInput` drops it from every **inbound** body for the same
role, which matters for a second reason: the deal forms post every field they
render, so a `CRM_MANAGER` saving an unrelated edit on a closed deal used to
send `commissionUsd: null` and silently erase the figure an admin had recorded.

`GET /api/crm/earnings` is `requireAdmin`, not `requireCrm`.

**`soldPrice` is deliberately still visible to `CRM_MANAGER`** — it is the
client's number, not the agency's, and somebody running the pipeline has to know
what a property went for to price the next one. Hiding it once made the role
unable to do the job it exists for. A determined holder of the role can multiply
it by a commission rate and get an estimate; that is the accepted trade-off, not
an oversight.

Moving a deal to `VIEWING_BOOKED` does **not** invent a date. The card shows a
red "No date set" instead, for the same reason cadence-derived follow-ups were
ripped out: a date nobody agreed is worse than no date.

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

- **`Lead.market` is a preference, not a wall.** It ranks a client's matches;
  it never hides the other market. A Georgian investor asking about a Beirut
  apartment is an ordinary conversation, and the CRM used to make it
  impossible — `/matches` filtered candidates by the client's market, so no
  Lebanese property could ever be shortlisted for them. Narrowing is now
  explicit and per-request (`?country=`).

Matching (`apps/backend/src/utils/lead-matching.ts`) scores on independent
criteria, but some misses are **fatal** rather than weighted: a different
property family, the wrong deal type, 2+ bedrooms short, or >50% over budget.
A strong location must never carry a property the client cannot use or afford.
Bedrooms aren't scored for investors or international stock.

---

## Visual conventions — propgroupleb · backend + back office

- Grey-first neutrals (slate/gray) with a subtle charcoal primary. Avoid strong navy-forward styling in new work.
- CSS variables: bare HSL triples in `:root`, wrapped with `hsl(var(--…))` in the `@theme inline` block.
- Use `pg-` prefixed utilities from `src/styles/design-system.css` where available.
- **Three layouts**: main site (navbar + footer), `/portal/*` (its own sidebar), `/(admin)/admin/*` (sidebar + header). Pick the right one — don't wrap portal/admin pages in the marketing navbar.

### Mobile rules (the admin is used from a phone)

- **Inputs must render at ≥16px below `md`.** iOS Safari zooms the whole page in
  when it focuses a smaller control and never zooms back out. `globals.css`
  applies `font-size: max(16px, 1em)` under 768px, so a `text-sm` field is safe;
  don't undo it with an inline `font-size`.
- **Tap targets ≥44px** (`min-h-11`) on anything a thumb has to find. Icon-only
  buttons at `p-1.5` are 28px and get mis-tapped.
- **One navigation, two presentations.** `Sidebar` renders the desktop rail and
  the mobile drawer from the same list. It used to be two hand-maintained
  copies with different colours and different links.
- **`overflow-hidden` on a table wrapper clips, it doesn't scroll.** Use
  `pg-scroll-x`, or better, drop columns below a breakpoint and fold what
  matters into the first cell.
- **Touch has no HTML5 drag-and-drop.** The CRM board's drag works on desktop
  only; every card also carries a stage `<select>` below `lg`, and the board
  shows one column at a time there rather than seven 264px columns in a
  side-scroller.

---

## Caching strategy (important — read before adding any cache layer) — propgroupleb · backend + back office

The app was cleaned up from a round of broken `unstable_cache` usage. The rules now:

- **Marketing pages** (`/`, `/about`, `/properties`, `/invest-in-*`): use per-page ISR via `export const revalidate = <seconds>`. Typical value: `60`. Admin CMS edits must surface within that window.
- **Portal and admin pages**: dynamic (server-rendered on demand). Don't cache.
- **No `unstable_cache`** unless you **also** wire up `revalidateTag(...)` at every mutation site. Historically the app had six `unstable_cache` wrappers with typo'd tags (`property-property`, `favorites-user`) that could never be invalidated, silently serving 5–60 min stale data. They were deleted wholesale. If you add one, test invalidation.
- **Prisma → API → page** is already fast enough. Prefer per-page `revalidate` over per-query caching.
- **`/market-analysis` and `/portal/market-analysis` render on demand** (no
  `DATABASE_URL` at build), so their query runs per request. Aggregate in
  Postgres (`groupBy` / `aggregate`), never by pulling rows into Node — that
  page used to load every public building and every active listing on every
  visit to produce three numbers.
- **There is no `middleware.ts`.** It was a no-op returning `NextResponse.next()`
  matched against nearly every path, i.e. a 39 kB edge invocation per request
  that did nothing. Auth is enforced by the layouts and by the API. If you add
  one back, give it a narrow `matcher` and a reason.

---

## Prisma patterns — propgroupleb · backend + back office

- **Client location**: generated into `node_modules/.pnpm/@prisma+client/…/.prisma/client`. Regenerated automatically by the `postinstall` hook in `packages/db/package.json`, so `pnpm install` never leaves you with stale types.
- **Include strategy**: `apps/backend/src/utils/prisma-includes.ts` exports three levels:
  - `PROPERTY_LIST_INCLUDE` — narrow, for list endpoints (public cards, admin tables). No full `agent`, unit data restricted to `{ id }`.
  - `PROPERTY_DETAIL_INCLUDE` — full, for single-property endpoints.
  - `PROPERTY_WITH_STATS_INCLUDE` — detail + aggregated counts.
  - **Never** use detail include for list views — it balloons payloads and query times.
- **User selects**: `USER_SELECT`, `USER_AUTH_SELECT`, `USER_ADMIN_SELECT` — pick the narrowest one.
- **Reserved models** (in `schema.prisma` but not yet wired into routes): `Developer`, `PropertyInvestmentData`, `Subscription`, `PropertyReservation`, `PropertyAmenity`, `PropertyPriceHistory`, `Tag`/`PropertyTag`, `PropertyOffer`, `PropertyTour`, `Transaction`, `Notification`, `Message`, `SystemSetting`. They're intentional — future features. Do **not** remove them without product sign-off.

---

## Backend patterns (`apps/backend/src/**`) — propgroupleb · backend + back office

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

## Auth flow (do not break) — propgroupleb · backend + back office

- Signup / login hit backend, receive JWT in an httpOnly cookie named `token`.
- `authenticateToken` middleware decodes it on each request and attaches `req.user`.
- Logout is a single `res.clearCookie('token', …)` — stateless, no session to destroy.
- Google OAuth: Passport redirects to Google, callback sets the same JWT cookie.
- **Do not** add `express-session`, `passport.session()`, or `passport-jwt`. They were removed as dead code. JWT extraction happens inline in `authenticateToken`.

### The cookie is `SameSite=None`, so writes are Origin-checked

The API and both sites are different hosts, so the auth cookie has to be
`SameSite=None` — which means the browser attaches it to *cross-site* requests
too. CORS does not close that hole: a plain `<form>` POST is a simple request,
it is sent with no preflight, and an attacker never needs to read the response
to have already caused the write.

`index.ts` therefore rejects any non-GET request carrying an `Origin` that isn't
in `ALLOWED_ORIGINS`. Requests with **no** Origin pass — that is server-to-server
traffic (propgrp.com's SSR, health checks, curl), which cannot be a forged
browser request. **Adding a new frontend origin means adding it to
`ALLOWED_ORIGINS`, or every mutation from it 403s.**

## Roles and the back office

Five roles (`Role` in `schema.prisma`). Three reach `/admin`:

| Role | Gets |
|---|---|
| `CRM_MANAGER` | `/admin/crm` only. Never commission — see below. |
| `ADMIN` | The whole back office, commission included. |
| `SUPER_ADMIN` | …plus creating users, setting passwords, assigning roles. |

`apps/web/src/lib/permissions.ts` is the single source of truth on the frontend
(`canAccessAdmin`, `canAccessAdminPath`, `canSeeMoney`, `adminHomeFor`); it
mirrors `middleware/auth.ts` on the backend. `canAccessAdminPath` is an
**allow-list** of prefixes, so a page added later is invisible to `CRM_MANAGER`
until somebody decides otherwise.

None of it is a security boundary — the API enforces every rule. It only stops
the UI offering a door the server will slam.

### Creating users

`POST /api/users` (super admin) creates a working account: email, **password**,
role. This replaced an `/invite` endpoint that wrote a row with a null password
— which no login can ever match — and promised a setup email nothing sent.
`POST /api/users/:id/password` resets one; `PUT /api/users/:id` edits details
and rights. All three are audited, and none of them ever log the password.

The last active `SUPER_ADMIN` cannot be demoted, deactivated, banned or deleted.
There is no console to recover from that, and `db push` deploys have no seed
step that would put one back.

**User admin is called straight from the browser** (`lib/api/users.ts`), not
through a server action. The server actions that used to do it forwarded to
`apiClient`, which authenticates with `credentials: 'include'` — a browser-only
instruction. Inside a server action the fetch carried no cookie at all, so every
role change, ban and delete reached the API unauthenticated and 401'd.

---

## Frontend patterns (`apps/web/src/**`) — propgroupleb · backend + back office

- **Server components by default**; drop to `'use client'` only for interactivity.
- **API client**: `lib/api/client.ts` exports `apiClient` with typed methods for every endpoint. Add new methods here, don't inline `fetch` in components.
- **URL helpers**: `lib/utils/api-url.ts` — `normalizeApiUrl()` strips trailing `/api`, `normalizeFileUrl()` rewrites legacy R2 public URLs (`https://pub-*.r2.dev/…`) to the proxied form. Always route file URLs through `normalizeFileUrl` before rendering.
- **Contexts**: `AuthContext` (current user) and `ComparatorContext` (property comparison tray). Wrapped at the root in `app/layout.tsx`.
- **Dynamic imports** for heavy lazy-loaded client components: `dynamic(() => import('…'), { ssr: false, loading: () => null })`. Examples: `AIPropertySearch`, `CreatePropertyModal`, `EditPropertyModal`, `AIAssistantFab`.
- **Fonts**: `next/font/google` variable fonts only. Don't pass a `weight` array — that forces static weight files and bloats first paint.

---

## Share tokens — propgroupleb · backend + back office

Two mechanisms coexist in `routes/share.ts`:

1. **`ShareToken` table** (current) — supports `PROPERTY`, `UNIT`, `UNIT_OPTION` scope; revocable; audit-logged.
2. **Legacy `Property.shareToken` column** — single property-level token, still honored as a fallback for previously shared links.

When generating new share links, always go through the `ShareToken` table. Don't extend the legacy field.

---

## What NOT to do — propgroupleb · backend + back office

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
- ❌ Filter a client's matches by their `market`. It ranks, it doesn't exclude.
- ❌ Re-create a kanban keyed on `lead.status`. The board moves deals; a client
  is at several stages at once and a column per person cannot say that.
- ❌ Show a forecast commission without marking it as one.
- ❌ Let a role that can't read `commissionUsd` write it. Read and write are one
  decision (`canSeeMoney`), or a form post quietly wipes the figure.
- ❌ Hardcode `role === 'ADMIN' || role === 'SUPER_ADMIN'` in a component. Use
  `lib/permissions.ts`; the inline copies had already drifted apart.
- ❌ Call the API from a Next server action with `apiClient`. `credentials:
  'include'` does nothing on the server — the request goes out with no cookie.
- ❌ Add a fifth client "type". The four intents are fixed; anything else is a flag on the client.
- ❌ Put a deal stage on the client. Viewing/negotiating belong to the opportunity — a client can be at different stages on different properties.
- ❌ Assume a `Building`'s local `buildingSchema` in `routes/buildings.ts` is the shared one in `schemas/index.ts`. It shadows it; adding a field to the wrong one fails silently.
- ❌ Add a public read route without `publicCountryFilter(req)` — that is exactly how `/api/properties` leaked both markets.
- ❌ Rename `ref`, or repurpose `Building.kind` — `propgroup/apps/backend/src/utils/shared-mappers.ts` reads both, and breaking them breaks the Georgia storefront silently.
- ❌ Hardcode a country or market in a prompt, label or query — `marketFor()` / `publicCountryFilter()` exist so adding a country never needs a code change. The AI SEO prompt hardcoded Lebanon and silently produced unusable copy for Georgia.
- ❌ Assume propgrp.com has its own catalogue, leads or SEO. It has none — it reads this API and forwards leads here. Building a feature "for Lebanon only" in this repo usually means building it for both sites.

---

## Known deferred work (post-launch) — propgroupleb · backend + back office

- Token blacklist / refresh token rotation
- Soft deletes for Property, User
- Bulk CSV/Excel export for admin
- MapView (placeholder removed; needs a real mapping library before re-adding)
- PKCE for Google OAuth
- Portfolio page real data integration
- Field-level encryption for PII
- Wire up reserved Prisma models (Transaction, Notification, Message, …) when those features land
- **propgrp.com still runs on its own codebase and database.** The unified back office holds its data; pointing that frontend at this API is unfinished. Options: a compatibility layer exposing the old `Property` shape, or updating that frontend to `/api/listings`.
- Mobile: the marketing pages, portal and admin have had a responsiveness pass.
  Not re-checked on a device since — verify on a real phone before trusting it.
- No duplicate detection when adding a client by hand.
- WhatsApp/Meta intake was built and then removed at the owner's request. If it returns, note that Coexistence (app + API on one number) requires Embedded Signup and Tech Provider status — a business cannot self-onboard its own number.

---

## Build & deploy — propgroupleb · backend + back office

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
