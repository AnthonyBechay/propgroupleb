FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache bash openssl wget

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma

# Install all dependencies
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Copy source
COPY apps/backend ./apps/backend
COPY packages/db ./packages/db

# Generate Prisma client
RUN pnpm --filter @propgroup/db run db:generate

# Build DB package
RUN pnpm --filter @propgroup/db run build

# Build backend TypeScript
RUN pnpm --filter propgroup-backend run build

ENV NODE_ENV=production \
    PORT=10000

EXPOSE 10000

CMD ["pnpm", "--filter", "propgroup-backend", "start"]
