# syntax=docker/dockerfile:1.4
# Dockerfile for @finanzas/doctoralia-scraper — Railway Cron service.
# Mirrors apps/api/Dockerfile (Turborepo prune + pnpm deploy).
# Runs as a one-shot process: exits after each scrape; Railway re-invokes
# the container on the next cron tick.

# ============================================================================
# STAGE 1: Prune — minimal lockfile for the scraper workspace
# ============================================================================
FROM node:slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
COPY . .
RUN npm install -g pnpm@10.32.1
RUN TURBO_TELEMETRY_DISABLED=1 pnpm dlx turbo@2.9.1 prune @finanzas/doctoralia-scraper --docker

# ============================================================================
# STAGE 2: Base — install deps for pruned workspace
# ============================================================================
FROM node:slim AS base
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

RUN npm install -g pnpm@10.32.1

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

# No turbo build needed (scraper runs via tsx), but keep the hook for
# future: any workspace dep that needs compilation will pick this up.
RUN --mount=type=cache,id=s/4990f681-049b-467f-9034-ef5c74a55f0a-/app/.turbo/cache,target=/app/.turbo/cache \
    pnpm turbo run build --filter=@finanzas/doctoralia-scraper...

RUN --mount=type=cache,id=s/4990f681-049b-467f-9034-ef5c74a55f0a-/pnpm/store,target=/pnpm/store \
    pnpm --filter=@finanzas/doctoralia-scraper --prod deploy /app/deploy

# ============================================================================
# STAGE 4: Runner — installs Chromium for browser-based login fallback
# ============================================================================
FROM node:22-noble AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/deploy/ .

# Install Chromium + all system deps matching the deployed playwright version.
# Must run as root before switching to unprivileged user.
RUN npx playwright install --with-deps chromium

USER node

CMD ["node", "--import", "tsx", "src/index.ts"]
