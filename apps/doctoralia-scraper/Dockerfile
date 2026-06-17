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
# STAGE 4: Runner — node 26 + webkit instalado por npm (sin acoplamiento de imagen)
# ============================================================================
# TEST: solo usamos webkit (~90MB, vs chromium 170MB que se colgaba al extraer en
# el builder de Railway). Si el extract de webkit NO se cuelga, este método es
# mejor: playwright npm instala el webkit que matchea su versión → "latest always"
# sin imagen MS pinned ni bump manual. Fallback si cuelga = copy-from-image.
FROM node:26-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV DEBIAN_FRONTEND=noninteractive

# COPY deploy FIRST so el webkit instalado matchee el playwright PINEADO
# (playwright@1.60.0 → webkit-2287). `npx -y playwright` bajaba el playwright
# LATEST → webkit de otra revisión → "Executable doesn't exist at webkit-2287".
COPY --from=build /app/deploy/ .

# install --with-deps webkit via el binario LOCAL pineado (node_modules/.bin),
# NO `npx -y` (que resolvía latest). Garantiza revisión webkit == playwright app.
# timeout+retry por si el download/extract se cuelga (como chromium).
RUN for i in 1 2 3; do \
      timeout 300 ./node_modules/.bin/playwright install --with-deps webkit && break; \
      echo "playwright webkit install retry $i"; sleep 5; \
    done; \
    test -d /ms-playwright && chmod -R o+rx /ms-playwright

# Non-root: use the built-in `node` user (uid 1000) from node:26-bookworm.
# Safe because cookies/session persist to the DB over HTTP (CookieJar fetch) and
# captured data is POSTed — no app-data dir needs chown. webkit.launch() writes
# only a throwaway profile under /tmp (world-writable+sticky), and browsers were
# installed to /ms-playwright with o+rx so uid 1000 can read+execute them. Give
# node a real HOME + XDG cache so any browser cache write has a writable target.
# NOTE: the webkit-as-uid-1000 path runs only on the captcha/2FA login fallback;
# smoke-test that branch post-deploy (normal cron is HTTP-only and unaffected).
ENV HOME=/home/node
ENV XDG_CACHE_HOME=/home/node/.cache
RUN mkdir -p /home/node/.cache && chown -R node:node /home/node /app
USER node

CMD ["node", "src/index.ts"]
