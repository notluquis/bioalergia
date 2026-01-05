# ============================================================================
# STAGE 1: Prune - Generate minimal lockfile and source set
# ============================================================================
FROM node:current-slim AS prune
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Prune for both API (service) and Web (assets)
RUN turbo prune --scope=@finanzas/api --scope=@finanzas/web --docker

# ============================================================================
# STAGE 2: Build - Install deps and compile
# ============================================================================
FROM node:current-slim AS build
WORKDIR /app

# Define ARG for Project ID (used in cache key) with default for local
ARG RAILWAY_PROJECT_ID=local

# System deps for native modules (argon2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.27.0
ENV CI=true

ENV PNPM_STORE_DIR=/pnpm/store

# 1. Install dependencies (Cached Layer)
# Copy only package.json's and lockfile from prune stage
COPY --from=prune /app/out/json/ .
RUN --mount=type=cache,id=s/${RAILWAY_PROJECT_ID}-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# 2. Copy source code (Cached Layer)
COPY --from=prune /app/out/full/ .

# 3. Build artifacts
RUN pnpm --filter @finanzas/db build
RUN pnpm --filter @finanzas/web build
RUN pnpm --filter @finanzas/api build

# 4. Prepare deployment (Isolate API production deps)
RUN --mount=type=cache,id=s/${RAILWAY_PROJECT_ID}-pnpm,target=/pnpm/store \
    pnpm deploy --filter=@finanzas/api --prod /app/deploy

# 5. Copy built artifacts to deployment folder
# (pnpm deploy copies sources, we need the build outputs)
RUN cp -r apps/api/dist /app/deploy/dist && \
    cp -r packages/db/dist /app/deploy/node_modules/@finanzas/db/dist

# 6. Copy frontend assets to API public folder
RUN mkdir -p /app/deploy/public && \
    cp -r apps/web/dist/client/* /app/deploy/public/

# 7. Cleanup
RUN find /app/deploy -name "prisma" -type d -exec rm -rf {} + 2>/dev/null || true

# ============================================================================
# STAGE 3: Runtime - Pure production image
# ============================================================================
FROM node:current-slim

WORKDIR /app

# Copy only the prepared deployment
COPY --from=build /app/deploy ./

ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--enable-source-maps"

EXPOSE 3000

# Use native node instead of tsx for performance
CMD ["node", "dist/index.js"]
