# syntax=docker/dockerfile:1.4
# Dockerfile for @finanzas/doctoralia-scraper — Railway Cron service.
# Mirrors apps/api/Dockerfile (Turborepo prune + pnpm deploy).
# Runs as a one-shot process: exits after each scrape; Railway re-invokes
# the container on the next cron tick.

# ============================================================================
# STAGE 1: Prune — minimal lockfile for the scraper workspace
# ============================================================================
FROM node:26-slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
COPY . .
RUN npm install -g pnpm@11.1.1
RUN TURBO_TELEMETRY_DISABLED=1 pnpm dlx turbo@2.9.1 prune @finanzas/doctoralia-scraper --docker

# ============================================================================
# STAGE 2: Base — install deps for pruned workspace
# ============================================================================
FROM node:26-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0

# Native toolchain kept minimal — impit is a prebuilt Rust binary and needs
# no compilation on glibc linux/x64. Keep build-essential in case a
# transitive dep requires it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11.1.1

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=s/4990f681-049b-467f-9034-ef5c74a55f0a-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================================================
# STAGE 3: Build — no compilation; deploy a self-contained prod tree
# ============================================================================
FROM base AS build
COPY --from=pruner /app/out/full/ .

ENV CI=true
ENV TURBO_TELEMETRY_DISABLED=1

# No turbo build needed (scraper runs via Node 26 native ts type-stripping), but keep the hook for
# future: any workspace dep that needs compilation will pick this up.
RUN --mount=type=cache,id=s/4990f681-049b-467f-9034-ef5c74a55f0a-/app/.turbo/cache,target=/app/.turbo/cache \
    pnpm turbo run build --filter=@finanzas/doctoralia-scraper...

RUN --mount=type=cache,id=s/4990f681-049b-467f-9034-ef5c74a55f0a-/pnpm/store,target=/pnpm/store \
    pnpm --filter=@finanzas/doctoralia-scraper --prod deploy /app/deploy

# ============================================================================
# STAGE 4: Runner — node 26 + Chromium (capa cacheable por BuildKit/Railpack)
# ============================================================================
# Imagen oficial Playwright: Chromium YA prebaked/extraído en /ms-playwright +
# todas las libs del SO. Cero download/extract en build → mata el cuelgue del
# extract que sufría node:26-bookworm en el builder de Railway.
# Versión pinned = match con el playwright del proyecto (1.59.1 → mismo chromium).
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

# La imagen MS ships Node 22. El proyecto corre .ts vía type-stripping nativo y
# usa parameter properties (no erasables) → exige Node >=26. Lo instalamos encima
# vía nodesource (apt, ~1min, confiable en Railway). Reemplaza el node 22 base.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_26.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version

COPY --from=build /app/deploy/ .

CMD ["node", "src/index.ts"]
