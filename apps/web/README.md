# PropGroup — Web App

Next.js 15 (App Router) frontend for the PropGroup real-estate investment platform.

## Stack

- **Framework**: Next.js 15 App Router, React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui, custom design tokens in `src/styles/design-system.css`
- **Auth**: JWT cookies (httpOnly) issued by the backend; `AuthContext` hydrates the current user
- **State**: React Context for auth and the property comparator; otherwise server components + server actions where appropriate
- **Shared code**: `@propgroup/config` (calculator formulas, Zod schemas), `@propgroup/db` (Prisma types only — runtime DB access lives in the backend)

## Development

Run from the monorepo root — this app is part of a pnpm workspace.

```bash
pnpm install
pnpm dev:web    # runs next dev
```

Do not run the dev server just to verify changes; prefer `pnpm --filter web run build` to catch issues.

## Environment

Copy `.env.example` at the repo root and set at minimum:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Optional vars (Google OAuth, R2, Anthropic, Resend) are validated by the backend on boot, not here.

## Route Layout

- `/` — marketing home (ISR)
- `/properties`, `/property/[slug]` — catalog and detail
- `/portal/*` — authenticated user area (dashboard, favorites, portfolio, calculator)
- `/(admin)/admin/*` — admin area, gated by `requireAdmin` middleware on API calls
- `/auth/*` — login, signup, forgot/reset password
- `/about`, `/contact`, `/compare`, `/ai-search`, `/get-started` — marketing / feature pages

## Conventions

See the root `CLAUDE.md` for project-wide conventions (colors, layout patterns, portal/admin separation).
