# syntax=docker/dockerfile:1.4
# Dockerfile optimized with Turborepo (Prune Strategy)

# ============================================================================
# STAGE 1: Prune - Generate a minimal lockfile from the monorepo
# ============================================================================
FROM node:current-slim AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Prune the workspace to include only what's needed for api, web and db
RUN turbo prune --scope=@finanzas/api --scope=@finanzas/web --docker

# ============================================================================
# STAGE 2: Base - Install dependencies using the pruned lockfile
# ============================================================================
FROM node:current-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# System deps for native modules (argon2, better-sqlite3, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install corepack
RUN npm install -g corepack --force && \
    corepack enable && \
    corepack prepare pnpm@10.27.0 --activate

# Copy dependencies from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies (this layer is cached until lockfile changes)
ARG RAILWAY_SERVICE_ID
RUN --mount=type=cache,id=s/${RAILWAY_SERVICE_ID}-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================================
# STAGE 3: Build - Compile the applications
# ============================================================================
FROM base AS build
# Copy source code from pruner (this layer changes often)
COPY --from=pruner /app/out/full/ .

ENV CI=true

# Build DB, Web (Fast), and API using Turbo
# turbo.json ensures db builds before others.
# We use build:fast for web to skip redundant type-checking in Docker.
RUN pnpm turbo run build --filter=@finanzas/db
RUN pnpm turbo run build:fast --filter=@finanzas/web
RUN pnpm turbo run build --filter=@finanzas/api

# Deploy API for production (isolates prod dependencies)
RUN pnpm --filter @finanzas/api --prod deploy /prod/api

# ============================================================================
# STAGE 4: Runner - Production image
# ============================================================================
FROM node:current-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy deployed API
COPY --from=build /prod/api .

# Copy frontend build artifacts
COPY --from=build /app/apps/web/dist/client ./public

EXPOSE 3000

CMD ["node", "dist/index.js"]
