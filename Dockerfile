# syntax=docker/dockerfile:1.4
# Dockerfile optimized with Turborepo (Prune Strategy)

# ============================================================================
# STAGE 1: Prune - Generate a minimal lockfile from the monorepo
# Using npx turbo@^2 as recommended by Turborepo docs for Docker prune stage
# ============================================================================
FROM node:current-slim AS pruner
WORKDIR /app
COPY . .
# npx downloads turbo pinned to major version - fastest approach for prune-only stage
RUN npx turbo@^2 prune --scope=@finanzas/api --scope=@finanzas/web --docker

# ============================================================================
# STAGE 2: Base - Install dependencies for pruned workspace
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

# Install corepack + latest pnpm
RUN npm install -g corepack@latest --force && \
    corepack enable pnpm && \
    corepack install -g pnpm@latest

# Copy dependencies from pruner
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies (this layer is cached until lockfile changes)
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================================
# STAGE 3: Build - Compile the applications
# ============================================================================
FROM base AS build
# Copy source code from pruner (this layer changes often)
COPY --from=pruner /app/out/full/ .

ENV CI=true

# Build DB first (dependency of api and web)
RUN pnpm turbo run build --filter=@finanzas/db

# Build Web (Fast) and API in parallel
# Web takes ~60s, API ~7s. Running them together saves the API build time from the critical path.
RUN pnpm turbo run build:fast --filter=@finanzas/web & pnpm turbo run build --filter=@finanzas/api & wait

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
