# PropGroup Backend API

Express 4 + Prisma + PostgreSQL API for the PropGroup real estate platform.

## Tech Stack

- **Node.js / Express 4** — HTTP server
- **Prisma** — ORM against PostgreSQL
- **JWT** (httpOnly cookies) — stateless auth, no session store
- **bcryptjs** — password hashing
- **Zod** — request validation
- **Cloudflare R2** — file storage via `@aws-sdk/client-s3`
- **Resend** — transactional email (feature-gated on `RESEND_API_KEY`)
- **Anthropic SDK** — AI property search (feature-gated on `ANTHROPIC_API_KEY`)

## Setup

1. **Install dependencies** (run from monorepo root):
   ```bash
   pnpm install
   ```

2. **Environment** — copy and fill in:
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

   Required:
   | Variable | Description |
   |---|---|
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_SECRET` | Secret for signing JWT tokens |
   | `FRONTEND_URL` | Frontend origin for CORS |

   R2 storage (required for file uploads):
   | Variable | Description |
   |---|---|
   | `R2_ACCOUNT_ID` | Cloudflare account ID |
   | `R2_ACCESS_KEY_ID` | R2 API token key ID |
   | `R2_SECRET_ACCESS_KEY` | R2 API token secret |
   | `R2_BUCKET_NAME` | R2 bucket name |
   | `R2_PUBLIC_URL` | Public bucket URL (`https://pub-<id>.r2.dev`) |

3. **Database**:
   ```bash
   pnpm --filter @propgroup/db run db:migrate:deploy
   ```

4. **Start**:
   ```bash
   # Development (with hot reload)
   pnpm run dev:backend

   # Production
   pnpm --filter propgroup-backend start
   ```

## Deployment

Deployed via Coolify on Hetzner CPX32. The `apps/backend/Dockerfile` builds a
non-root `node` image; `docker-compose.yml` at the repo root wires it together
with the web container and injects all env vars.

## API Endpoints

### Authentication
- `POST /api/auth/register` — register
- `POST /api/auth/login` — login (sets httpOnly JWT cookie)
- `GET  /api/auth/me` — current user
- `POST /api/auth/logout` — clear cookie
- `PUT  /api/auth/profile` — update profile
- `PUT  /api/auth/change-password` — change password
- `GET  /api/auth/google` — Google OAuth start
- `GET  /api/auth/google/callback` — Google OAuth callback

### Properties
- `GET    /api/properties` — list (public)
- `GET    /api/properties/:slug` — detail (public)
- `POST   /api/properties` — create (admin)
- `PUT    /api/properties/:id` — update (admin)
- `DELETE /api/properties/:id` — delete (admin)

### Files
- `POST   /api/upload` — upload file to R2
- `DELETE /api/upload` — delete file from R2
- `GET    /api/files/:key*` — proxy R2 file (fallback when direct R2 URL unavailable)

### Favorites
- `GET    /api/favorites` — user's saved properties
- `POST   /api/favorites/:propertyId` — save
- `DELETE /api/favorites/:propertyId` — unsave
- `GET    /api/favorites/check/:propertyId` — check status

### Inquiries
- `POST /api/inquiries` — submit inquiry (public)
- `GET  /api/inquiries/my` — user's inquiries
- `GET  /api/inquiries` — all inquiries (admin)
- `PUT  /api/inquiries/:id/status` — update status (admin)

### Users (Admin)
- `GET    /api/users` — list users
- `GET    /api/users/:id` — get user
- `PUT    /api/users/:id/role` — update role (super admin)
- `POST   /api/users/:id/ban` — ban
- `POST   /api/users/:id/unban` — unban
- `DELETE /api/users/:id` — delete (super admin)

### Admin
- `GET  /api/admin/stats` — dashboard statistics
- `GET  /api/admin/audit-logs` — admin audit log
- `GET  /health` — health check

## Auth Notes

- JWT stored in httpOnly cookie named `token`; no session store
- `authenticateToken` middleware decodes JWT on every request → `req.user`
- Logout: `res.clearCookie('token')` — stateless, nothing to destroy
- Google OAuth: Passport redirects to Google, callback sets the same JWT cookie
- **Do not** add `express-session`, `passport-jwt`, or `connect-pg-simple`
