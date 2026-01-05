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

# 1. Copy everything
COPY . .

# 2. Install all dependencies (with cache mount for speed)
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# 3. Build: Generate ZenStack + compile API + build Frontend
RUN pnpm --filter @finanzas/db build && \
    pnpm --filter @finanzas/api build && \
    pnpm --filter @finanzas/web build

# 4. Deploy: Extract only production deps for @finanzas/api
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/pnpm/store,target=/pnpm/store \
    pnpm deploy --filter=@finanzas/api --prod /app/deploy

# 5. Copy compiled dist (pnpm deploy copies source, not build artifacts)
RUN cp -r apps/api/dist /app/deploy/dist && \
    cp -r packages/db/dist /app/deploy/node_modules/@finanzas/db/dist

# 6. Copy frontend build to API's public folder (Vite outputs to dist/client/)
RUN mkdir -p /app/deploy/public && \
    cp -r apps/web/dist/client/* /app/deploy/public/

# 7. Remove any Prisma artifacts (we use pure ZenStack/Kysely)
RUN find /app/deploy -name "prisma" -type d -exec rm -rf {} + 2>/dev/null || true

# ============================================================================
# STAGE 2: Runtime - Node.js Current Slim (tsx requires Node runtime)
# ============================================================================
FROM node:current-slim

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

# Use tsx for runtime (handles ESM/CJS interop)
CMD ["node_modules/.bin/tsx", "dist/index.js"]
