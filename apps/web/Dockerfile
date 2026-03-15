FROM node:20-alpine AS base
RUN apk add --no-cache bash libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/

# Copy Prisma schema (needed for postinstall)
COPY packages/db/prisma ./packages/db/prisma

# Install dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

COPY . .

# Build shared packages
RUN pnpm --filter @propgroup/db run build
RUN pnpm --filter @propgroup/config run build 2>/dev/null || true
RUN pnpm --filter @propgroup/ui run build 2>/dev/null || true

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NODE_ENV=production

# Build Next.js with standalone output
RUN pnpm --filter web run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
