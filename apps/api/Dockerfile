# syntax=docker/dockerfile:1.4
# Dockerfile optimized with Turborepo (Prune Strategy)

# ============================================================================
# STAGE 1: Prune - Generate a minimal lockfile from the monorepo
# Using a pinned turbo version for deterministic Docker prune stages
# ============================================================================
FROM node:26-slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
COPY . .
RUN npm install -g pnpm@11.1.1
# Use pnpm dlx to avoid npm interpreting pnpm-only .npmrc keys during Docker builds.
RUN TURBO_TELEMETRY_DISABLED=1 pnpm dlx turbo@2.9.1 prune @finanzas/api --docker

# ============================================================================
# STAGE 2: Base - Install dependencies for pruned workspace
# ============================================================================
FROM node:26-slim AS base
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
RUN npm install -g pnpm@11.1.1

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

# Build API workspace dependencies. db builds with tsdown → Node-valid dist/*.mjs
# (resolves ZenStack's extensionless imports); api's build is a no-op — it runs
# its .ts source directly via Node 26 type-stripping (see runner CMD).
RUN --mount=type=cache,id=s/fbf6a604-cc46-46af-8d95-9e7503753301-/app/.turbo/cache,target=/app/.turbo/cache \
    pnpm turbo run build --filter=@finanzas/api...

# Materialize a self-contained app (api .ts source + assets + prod node_modules,
# with db's compiled .mjs injected) via pnpm deploy.
RUN --mount=type=cache,id=s/fbf6a604-cc46-46af-8d95-9e7503753301-/pnpm/store,target=/pnpm/store \
    pnpm --filter=@finanzas/api --prod deploy /app/deploy

# ============================================================================
# STAGE 4: Runner - Production image
# ============================================================================
FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# On-disk V8 compile cache (Node 26 stable): caches type-stripping + compilation
# so restarts boot ~25% faster. /tmp is writable by USER node; repopulated per
# container, persists across restarts of the same container.
ENV NODE_COMPILE_CACHE=/tmp/node-compile-cache

# Ghostscript: post-procesa los PDFs a PDF/A-3 (OutputIntent sRGB) — ver
# modules/pdf/pdf-a.ts. Si faltara, toPdfA3 degrada al PDF original.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/deploy/ .

USER node

EXPOSE 3000

# V8 flags inline (Railway env NODE_OPTIONS unreliable for memory flags):
# - --max-old-space-size=1024: hard cap heap (was uncapped → V8 grew to 2.5GB).
#   Lower to 512 after Fase 2 (lazy-load xlsx/pdf-lib) + Fase 3 (remove
#   in-process schedulers) land and /api/diag/heap confirms steady < 400MB.
# - --max-semi-space-size=32: pin semi-space; Node 22+ dynamic default can
#   shrink to 1MB causing GC thrash (nodejs/node#62723)
CMD ["node", "--max-old-space-size=1024", "--max-semi-space-size=32", "src/index.ts"]
