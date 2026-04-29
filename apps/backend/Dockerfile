FROM node:20-alpine

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

# Drop root before runtime. Same reasoning as the web Dockerfile: an RCE
# under root in this container would have full filesystem access to
# /app + the mounted `backend_uploads` volume + permission to drop and
# execute binaries from /tmp. The Apr 27 incident on the web container
# (`./XXfaBkPe` running as root for 2d11h) showed the cost of leaving
# this default. Backend is now reachable only via the api.bechays.com
# host and authenticated routes, so attack surface is smaller — but the
# blast radius if exploited would include the DB credentials and R2
# keys in env. Defense in depth.
#
# The `backend_uploads` volume mount needs `node` ownership too. If you
# already have a populated volume from before this change, run
# `docker exec <container> chown -R node:node /app/apps/backend/uploads`
# once after deploy, or recreate the volume (`docker volume rm
# backend_uploads`) — current image storage is R2 so the local volume
# is largely empty.
RUN chown -R node:node /app
USER node

EXPOSE 10000

CMD ["pnpm", "--filter", "propgroup-backend", "start"]
