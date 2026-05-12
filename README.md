# PropGroup

Lebanon-focused real estate platform. Catalog, inquiries, portfolio, admin CMS, and AI-assisted property search.

## Stack

- **Frontend**: Next.js 15 (App Router, React 19), Tailwind CSS v4 + shadcn/ui
- **Backend**: Express 4 + Passport (Local + Google OAuth), JWT cookies
- **Database**: PostgreSQL + Prisma ORM
- **Storage**: Cloudflare R2 (proxied through `/api/files`)
- **Email**: Resend (transactional)
- **AI**: Anthropic SDK (property search conversation)
- **Monorepo**: pnpm workspaces

## Project Layout

```
propgroupleb/
├── apps/
│   ├── backend/         # Express API (port 3001)
│   └── web/             # Next.js frontend (port 3000)
├── packages/
│   ├── db/              # Prisma schema + generated client
│   └── config/          # Shared schemas & calculator formulas
└── scripts/             # Build / dev / clean / setup
```

## Quick start

```bash
pnpm install                                      # auto-runs prisma generate
cp apps/backend/.env.example apps/backend/.env    # fill in DATABASE_URL, JWT_SECRET, etc.
cp apps/web/.env.example    apps/web/.env.local   # set NEXT_PUBLIC_API_URL
pnpm --filter @propgroup/db run db:migrate        # apply migrations
pnpm --filter @propgroup/db run db:seed           # (optional) seed demo data
pnpm dev                                          # starts web + backend together
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:3001

## Required environment variables

The backend validates these on boot (`apps/backend/src/utils/validate-env.ts`) and throws in production if missing:

```
DATABASE_URL=postgresql://…
JWT_SECRET=<64 random hex chars>
FRONTEND_URL=https://your-frontend
```

Recommended (feature-gated — warned, not fatal):

```
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME  # uploads
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, BACKEND_URL  # OAuth
RESEND_API_KEY, RESEND_FROM_EMAIL  # transactional email
ANTHROPIC_API_KEY  # AI property search
NEXT_PUBLIC_API_URL  # frontend → backend (also used to build proxied file URLs)
```

## Common scripts

```bash
pnpm dev                   # full stack
pnpm dev:web               # frontend only
pnpm dev:backend           # backend only

pnpm build                 # build packages → backend → web
pnpm --filter web run build
pnpm --filter propgroup-backend run build

pnpm type-check            # web tsc --noEmit
pnpm lint
pnpm test                  # vitest (web)
```

Database:

```bash
pnpm --filter @propgroup/db run db:generate        # regenerate Prisma client
pnpm --filter @propgroup/db run db:migrate         # create + apply migration
pnpm --filter @propgroup/db run db:migrate:deploy  # apply in prod / CI
pnpm --filter @propgroup/db run db:studio
```

## Auth model

- Email/password (bcrypt) via Passport `LocalStrategy`
- Google OAuth via Passport `GoogleStrategy` (only registered when env vars present)
- JWT signed and stored in an **httpOnly** cookie — stateless, no session store
- Roles: `USER`, `ADMIN`, `SUPER_ADMIN` (enforced by `requireAdmin` / `requireSuperAdmin` middleware)

## Deployment

The app is container-friendly (`apps/web/Dockerfile`, `apps/backend/Dockerfile`, root `docker-compose.yml`) and also runs on split frontend/backend hosts (Vercel + Render, Cloudflare Pages + Fly, etc.). Set the env vars above in your host's environment panel; `pnpm install` will regenerate the Prisma client via the `postinstall` hook in `packages/db`.

## Conventions & architecture

See [`CLAUDE.md`](./CLAUDE.md) for conventions, caching strategy, patterns to reuse, and pitfalls to avoid when extending the codebase.

## License

ISC
