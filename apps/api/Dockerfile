# syntax=docker/dockerfile:1.4
# Dockerfile optimized with Turborepo (Prune Strategy)

# ============================================================================
# STAGE 1: Prune - Generate a minimal lockfile from the monorepo
# Using a pinned turbo version for deterministic Docker prune stages
# ============================================================================
FROM node:slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
COPY . .
RUN npm install -g pnpm@10.32.1
# Use pnpm dlx to avoid npm interpreting pnpm-only .npmrc keys during Docker builds.
RUN TURBO_TELEMETRY_DISABLED=1 pnpm dlx turbo@2.9.1 prune @finanzas/api --docker

# ============================================================================
# STAGE 2: Base - Install dependencies for pruned workspace
# ============================================================================
FROM node:slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0

# System deps for native modules (argon2, better-sqlite3, etc)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install the workspace-pinned pnpm directly (corepack removed in Node.js 25+)
RUN npm install -g pnpm@10.32.1

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
ENV TURBO_TELEMETRY_DISABLED=1

# Build API workspace dependencies
RUN --mount=type=cache,id=s/fbf6a604-cc46-46af-8d95-9e7503753301-/app/.turbo/cache,target=/app/.turbo/cache \
    pnpm turbo run build --filter=@finanzas/api...

# Create a self-contained production app with only runtime files and prod deps.
RUN --mount=type=cache,id=s/fbf6a604-cc46-46af-8d95-9e7503753301-/pnpm/store,target=/pnpm/store \
    pnpm --filter=@finanzas/api --prod deploy /app/deploy

# ============================================================================
# STAGE 4: Runner - Production image
# ============================================================================
FROM node:slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/deploy/ .

USER node

EXPOSE 3000

CMD ["node", "--import", "tsx", "src/index.ts"]
