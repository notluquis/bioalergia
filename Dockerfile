# syntax=docker/dockerfile:1.4
# Dockerfile siguiendo estrategia oficial de pnpm para monorepos

# ============================================================================
# STAGE 1: Base - Setup pnpm y dependencias del sistema
# ============================================================================
FROM node:current-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# System deps for native modules (argon2, better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*
# Install corepack first (not included in slim image), then enable pnpm
RUN npm install -g corepack && \
    corepack enable && \
    corepack prepare pnpm@10.27.0 --activate

# ============================================================================
# STAGE 2: Build - Install, build, and deploy
# ============================================================================
FROM base AS build
ENV CI=true
COPY . .
# Install all dependencies with cache mount (official pattern)
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
# Build all packages (sequential for reliability)
RUN pnpm --filter @finanzas/db build && \
    pnpm --filter @finanzas/web build && \
    pnpm --filter @finanzas/api build
# Deploy production-only files for API using pnpm deploy (official pattern)
RUN pnpm --filter @finanzas/api --prod deploy /prod/api

# ============================================================================
# STAGE 3: Runner - Production image
# ============================================================================
FROM node:current-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy deployed API with all prod dependencies
COPY --from=build /prod/api .
# Copy frontend build artifacts to serve as static files
COPY --from=build /app/apps/web/dist/client ./public

EXPOSE 3000

# Start with node directly
CMD ["node", "dist/index.js"]
