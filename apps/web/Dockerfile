FROM node:20-alpine

RUN apk add --no-cache bash libc6-compat

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/prisma ./packages/db/prisma

# Install all dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build shared packages
RUN pnpm --filter @propgroup/db run build
RUN pnpm --filter @propgroup/config run build 2>/dev/null || true
RUN pnpm --filter @propgroup/ui run build 2>/dev/null || true

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NODE_ENV=production \
    PORT=3000

# Build Next.js
RUN pnpm --filter web run build

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
