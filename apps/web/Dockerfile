FROM node:20-alpine

RUN apk add --no-cache bash libc6-compat openssl

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma

# Install all dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build shared packages
RUN pnpm --filter @propgroup/db run build
RUN pnpm --filter @propgroup/config run build 2>/dev/null || true

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NODE_ENV=production \
    PORT=3000

# Build Next.js
RUN pnpm --filter web run build

# Drop root before runtime. node:20-alpine ships a `node` user (uid 1000)
# already; we just need the filesystem to be readable+writable by it.
# Without this, anyone who finds an RCE in the runtime (a Next.js or dep
# CVE) lands as root and can drop binaries in /tmp + run them — which is
# exactly how the Apr 27 incident played out (a `./XXfaBkPe` cryptominer
# accumulated 2d11h of root CPU before being noticed).
#
# `chown -R node:node /app` makes the build output + image cache writable
# by the unprivileged user. The image cache (.next/cache/images) MUST be
# writable at runtime since `next/image` writes optimized variants there.
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
