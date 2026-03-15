FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/

# Copy Prisma schema (needed for postinstall)
COPY packages/db/prisma ./packages/db/prisma

# Install dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy source
COPY apps/backend ./apps/backend
COPY packages/db ./packages/db

# Generate Prisma client
RUN pnpm --filter @propgroup/db run db:generate

# Build DB package
RUN pnpm --filter @propgroup/db run build

# Build backend TypeScript
RUN pnpm --filter backend run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --include-workspace-root

# Copy built output
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Regenerate Prisma client for Alpine runtime
RUN pnpm --filter @propgroup/db run db:generate

EXPOSE 10000
ENV NODE_ENV=production
ENV PORT=10000

CMD ["node", "apps/backend/dist/index.js"]
