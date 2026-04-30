# PropGroup Scripts

Automated scripts for building, cleaning, and managing the PropGroup monorepo.

## Quick Reference

```bash
# Development
pnpm run dev              # Start both backend and frontend
pnpm run dev:backend      # Start backend only
pnpm run dev:frontend     # Start frontend only

# Building
pnpm run build            # Build all packages and applications
pnpm run build:packages   # Build shared packages only
pnpm run build:web        # Build frontend for production
pnpm run build:backend    # Build backend for production

# Cleaning
pnpm run clean            # Clean all build artifacts and node_modules

# Setup
pnpm run setup            # Initial project setup
```

---

## Available Scripts

### 📦 Development Scripts

#### `start.js`
Starts both backend and frontend development servers concurrently.
- Backend: http://localhost:3001
- Frontend: http://localhost:3000

```bash
pnpm run dev
```

#### `start-backend.js`
Starts only the backend API server with hot reload.

```bash
pnpm run dev:backend
```

#### `start-frontend.js`
Starts only the frontend Next.js dev server.

```bash
pnpm run dev:frontend
```

---

### 🔨 Build Scripts

#### `build.js`
Master build script that builds everything in the correct order:
1. Builds all shared packages (config, db)
2. Builds applications (backend, web)

```bash
pnpm run build
```

#### `build-packages.js`
Builds only the shared packages (config, db).

```bash
pnpm run build:packages
```

---

### 🧹 Utility Scripts

#### `clean.js`
Removes all build artifacts, node_modules, and temporary files.

```bash
pnpm run clean
```

#### `setup.js`
Initial project setup script.

```bash
pnpm run setup
```

---

## Build Strategy

### Development Workflow

```
1. Clone repo
2. pnpm install
3. pnpm run build:packages   # Build shared packages
4. pnpm run dev              # Start development servers
```

### Production Build Workflow

```
1. pnpm run clean            # Clean everything
2. pnpm install              # Fresh install
3. pnpm run build            # Build everything
4. Deploy
```

### Monorepo Build Order

```
packages/config     # First (no dependencies)
    ↓
packages/db         # Second (needs config)
    ↓
apps/backend        # Uses: db, config
apps/web            # Uses: db, config
```

---

## Deployment

Both apps are deployed via Coolify on a Hetzner VPS using `docker-compose.yml`
at the repo root. Coolify runs `docker compose up` against the compose file;
Dockerfiles for each app live alongside the code (`apps/backend/Dockerfile`,
`apps/web/Dockerfile`).

Environment variables are configured in the Coolify panel and injected at
build time (for `NEXT_PUBLIC_*` vars baked into the client bundle) and at
runtime (for server-only vars).

---

## Troubleshooting

### "Module not found" errors

```bash
pnpm run build:packages
```

### Prisma Client errors

```bash
cd packages/db
pnpm run db:generate
```

### Build cache issues

```bash
pnpm run clean
pnpm install
pnpm run build
```
