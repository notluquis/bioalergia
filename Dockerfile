# ============================================================================
# STAGE 1: Build - Node.js 25 (Debian Slim)
# ============================================================================
FROM node:25-slim AS build

# Production and CI optimizations
ENV CI=true
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

# Build-time system dependencies (for argon2 and other native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install specific pnpm version for consistency
RUN npm install -g pnpm@10.27.0

# 1. First Layer: Manifests & Fetch dependencies
# This creates a solid layer and leverages Railway's cache mount perfectly.
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Optimized Install: --prod=false is MANDATORY during build to get devDeps
# (tsc, zenstack, etc.) needed to compile the project.
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# 2. Second Layer: Source Code
COPY . .

# 3. Build Process: 
# - Generate ZenStack Client (Pure Kysely, ZERO Prisma at runtime)
# - Compile TypeScript (tsc) for BOTH db and api
RUN pnpm --filter @finanzas/db build && \
    pnpm --filter @finanzas/api build

# 4. Supreme Isolation: 'pnpm deploy'
# Extracts only the production dependencies and files for the API.
RUN pnpm deploy --filter=@finanzas/api --prod /app/deploy

# Extra: Ensure build artifacts are correctly placed for the runtime
# We manually copy the 'dist' folders to ensure the latest built code is used.
# For @finanzas/db, we inject it directly into node_modules where Node.js expects it.
# Note: --remove-destination is needed because pnpm deploy uses hardlinks
RUN cp -r apps/api/dist /app/deploy/dist && \
    mkdir -p /app/deploy/node_modules/@finanzas/db && \
    cp -r --remove-destination packages/db/dist /app/deploy/node_modules/@finanzas/db/dist && \
    cp --remove-destination packages/db/package.json /app/deploy/node_modules/@finanzas/db/package.json

# 5. Veto Prisma: Physically remove any Prisma artifacts created during build
# to ensure zero Prisma footprint in the production image.
RUN find /app/deploy -name "prisma" -type d -exec rm -rf {} + || true

# ============================================================================
# STAGE 2: Runtime - Distroless Node.js 24 (Debian 13)
# ============================================================================
FROM gcr.io/distroless/nodejs24-debian13

WORKDIR /app

# Copy ONLY the isolated production items from Stage 1
COPY --from=build /app/deploy ./

# Production runtime optimizations
ENV NODE_ENV=production
ENV CI=true
ENV PORT=3000

# Node 25/24 V8 Bytecode cache for instant cold starts
ENV NODE_COMPILE_CACHE=/app/.cache
# Enable source maps for clean logs (zero performance cost in modern Node)
ENV NODE_OPTIONS="--enable-source-maps"

EXPOSE 3000

# Direct execution (no shell). Absolute best for speed and security.
CMD ["dist/index.js"]
