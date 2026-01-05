# ============================================================================
# STAGE 1: Build - Node.js Current (Debian Slim)
# ============================================================================
FROM node:current-slim AS build

# Build-time system dependencies (for argon2 and other native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (corepack was removed from Node.js 25+)
RUN npm install -g pnpm@10.27.0

WORKDIR /app

# Environment: CI mode (NOT production - need devDeps for tsc/zenstack)
ENV CI=true
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# 1. Lockfile & manifests first (optimal layer caching)
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# 2. Fetch dependencies into store (cacheable, no install yet)
# Note: Railway requires id=s/<service-id>-<path> format for persistent cache
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/pnpm/store,target=/pnpm/store \
    pnpm fetch

# 3. Install from cached store
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/pnpm/store,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile

# 4. Copy source code
COPY . .

# 5. Build: Generate ZenStack + compile TypeScript
RUN pnpm --filter @finanzas/db build && \
    pnpm --filter @finanzas/api build

# 6. Deploy: Extract only production deps for @finanzas/api
# pnpm deploy handles workspace deps (@finanzas/db) automatically
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/pnpm/store,target=/pnpm/store \
    pnpm deploy --filter=@finanzas/api --prod /app/deploy

# 7. Copy compiled dist (pnpm deploy copies source, not build artifacts)
RUN cp -r apps/api/dist /app/deploy/dist && \
    cp -r packages/db/dist /app/deploy/node_modules/@finanzas/db/dist

# 8. Remove any Prisma artifacts (we use pure ZenStack/Kysely)
RUN find /app/deploy -name "prisma" -type d -exec rm -rf {} + 2>/dev/null || true

# ============================================================================
# STAGE 2: Runtime - Distroless Node.js 24 (Debian 13)
# ============================================================================
FROM gcr.io/distroless/nodejs24-debian13

WORKDIR /app

# Copy ONLY the isolated production deployment from build stage
COPY --from=build /app/deploy ./

# Production runtime configuration
ENV NODE_ENV=production
ENV PORT=3000

# Node.js performance optimizations
ENV NODE_COMPILE_CACHE=/app/.cache
ENV NODE_OPTIONS="--enable-source-maps"

EXPOSE 3000

# Direct execution (distroless has no shell)
CMD ["dist/index.js"]
