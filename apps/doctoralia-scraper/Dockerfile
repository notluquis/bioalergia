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
# Fuente de chromium YA extraído (sin tocar node). Solo lo usamos para copiar
# los binarios prebaked → evita el download+unzip que colgaba en Railway.
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS browsers

# Runner: NODE 26 de base (requisito del proyecto: type-stripping + param props).
FROM node:26-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DEBIAN_FRONTEND=noninteractive

# Libs del SO para chromium (apt). Esto en Railway SÍ funciona — lo que colgaba
# era la EXTRACCIÓN del zip, no el apt. No descargamos ni descomprimimos browser.
RUN npx playwright@1.59.1 install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Chromium ya extraído, copiado de la imagen MS → es un COPY de archivos (capa
# Docker), NO un unzip → sin el cuelgue. Versión 1.59.1 matchea el playwright del
# proyecto (mismo build chromium-1217).
COPY --from=browsers /ms-playwright /ms-playwright

COPY --from=build /app/deploy/ .

CMD ["node", "src/index.ts"]
