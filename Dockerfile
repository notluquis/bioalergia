# syntax=docker/dockerfile:1.4
# Multi-stage Dockerfile optimized for Railway - adapted from working f7df51b config

# ============================================================================
# STAGE 1: Base - Install pnpm and system dependencies
# ============================================================================
FROM node:current-slim AS base
WORKDIR /app
# System deps for native modules (argon2, better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.27.0
COPY pnpm-lock.yaml pnpm-workspace.yaml ./

# ============================================================================
# STAGE 2: Dependencies - Install all dependencies
# ============================================================================
FROM base AS deps
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
# Install all dependencies with cache mount
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================================
# STAGE 3: Builder - Build application
# ============================================================================
FROM deps AS builder
COPY . .
# Build in sequence for reliability (ZenStack must finish before others)
RUN pnpm --filter @finanzas/db build && \
    pnpm --filter @finanzas/web --filter @finanzas/api build

# ============================================================================
# STAGE 4: Production Dependencies - Fresh install prod only
# ============================================================================
FROM base AS prod-deps
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
# Install ONLY production dependencies
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ============================================================================
# STAGE 5: Runner - Production image
# ============================================================================
FROM node:current-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy prod dependencies
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy ZenStack generated client from builder
COPY --from=builder /app/packages/db/dist ./packages/db/dist

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist/client ./public

# Copy necessary config files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/packages/db/package*.json ./packages/db/

EXPOSE 3000

# Start with node directly (no tsx overhead in production)
CMD ["node", "apps/api/dist/index.js"]
