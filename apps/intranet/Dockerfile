# syntax=docker/dockerfile:1.4

# ==========================================================================
# Stage 1: Prune monorepo for intranet
# ==========================================================================
FROM node:current-slim AS pruner
WORKDIR /app
COPY . .
RUN npx turbo@^2 prune --scope=@finanzas/intranet --docker

# ==========================================================================
# Stage 2: Base deps
# ==========================================================================
FROM node:current-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g corepack@latest --force && \
    corepack enable pnpm && \
    corepack install -g pnpm@latest

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=s/31aed601-107c-408b-b13e-96b37282ee93-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ==========================================================================
# Stage 3: Build
# ==========================================================================
FROM base AS build
COPY --from=pruner /app/out/full/ .
ENV CI=true
RUN pnpm turbo run build --filter=@finanzas/intranet

# ==========================================================================
# Stage 4: Runner
# ==========================================================================
FROM build AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @finanzas/intranet preview --host 0.0.0.0 --port ${PORT}"]
