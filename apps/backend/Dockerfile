# Backend Dockerfile - Simplified for Coolify
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema BEFORE install (needed for postinstall script)
COPY packages/db/prisma ./packages/db/prisma

# Install ALL dependencies (force development to get devDependencies)
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy source
COPY apps/backend ./apps/backend
COPY packages/db ./packages/db

# Generate Prisma client (must be before build)
RUN pnpm --filter @propgroup/db run db:generate

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema BEFORE install (needed for postinstall script)
COPY packages/db/prisma ./packages/db/prisma

# Install ALL dependencies (including devDependencies for Prisma CLI)
RUN pnpm install --frozen-lockfile --include-workspace-root

# Copy built files and source
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages/db ./packages/db

# Regenerate Prisma client for Alpine runtime
RUN pnpm --filter @propgroup/db run db:generate

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "apps/backend/src/index.js"]
