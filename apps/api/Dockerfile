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
RUN npx turbo@^2 prune --scope=@finanzas/api --docker

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
RUN --mount=type=cache,id=s/fbf6a604-cc46-46af-8d95-9e7503753301-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================================
# STAGE 3: Build - Compile the applications
# ============================================================================
FROM base AS build
# Copy source code from pruner (this layer changes often)
COPY --from=pruner /app/out/full/ .

ENV CI=true

# Build DB first (dependency of api)
RUN pnpm turbo run build --filter=@finanzas/db

# Build API
RUN pnpm turbo run build --filter=@finanzas/api

# ============================================================================
# STAGE 4: Runner - Production image
# ============================================================================
FROM node:current-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy workspace configuration for proper package resolution
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy node_modules from build stage (includes proper workspace symlinks)
COPY --from=build /app/node_modules ./node_modules

# Copy built packages from build stage (includes @finanzas/db)
COPY --from=build /app/packages ./packages

# Copy built API to the correct location
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/index.js"]
