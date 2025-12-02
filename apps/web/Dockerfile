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

# Install ALL dependencies (including devDependencies needed for building)
# Using NODE_ENV=development to ensure devDependencies are installed
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build shared packages first (required dependencies)
RUN pnpm --filter @propgroup/config run build
RUN pnpm --filter @propgroup/db run build
RUN pnpm --filter @propgroup/ui run build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NODE_ENV=production \
    PORT=3000

# Build the Next.js application
RUN pnpm --filter web run build

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
