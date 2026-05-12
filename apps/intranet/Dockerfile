# syntax=docker/dockerfile:1.4

# ==========================================================================
# Stage 1: Prune monorepo for intranet
# ==========================================================================
FROM node:slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
COPY . .
RUN npm install -g pnpm@11.1.1
RUN TURBO_TELEMETRY_DISABLED=1 pnpm dlx turbo@2.9.1 prune @finanzas/intranet --docker

# ==========================================================================
# Stage 2: Base deps
# ==========================================================================
FROM node:slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@11.1.1

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=s/31aed601-107c-408b-b13e-96b37282ee93-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ==========================================================================
# Stage 3: Build
# ==========================================================================
FROM base AS build
ARG VITE_APP_BUILD_TIMESTAMP
ARG VITE_META_APP_ID
ARG VITE_META_EMBEDDED_SIGNUP_CONFIG_ID
ARG VITE_VAPID_PUBLIC_KEY
COPY --from=pruner /app/out/full/ .
ENV CI=true
ENV TURBO_TELEMETRY_DISABLED=1
ENV VITE_APP_BUILD_TIMESTAMP=${VITE_APP_BUILD_TIMESTAMP}
ENV VITE_META_APP_ID=${VITE_META_APP_ID}
ENV VITE_META_EMBEDDED_SIGNUP_CONFIG_ID=${VITE_META_EMBEDDED_SIGNUP_CONFIG_ID}
ENV VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY}
RUN --mount=type=cache,id=s/31aed601-107c-408b-b13e-96b37282ee93-/app/.turbo/cache,target=/app/.turbo/cache \
    pnpm turbo run type-check --filter=@finanzas/intranet
RUN --mount=type=cache,id=s/31aed601-107c-408b-b13e-96b37282ee93-/app/.turbo/cache,target=/app/.turbo/cache \
    VITE_APP_BUILD_TIMESTAMP="${VITE_APP_BUILD_TIMESTAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" \
    pnpm turbo run build --filter=@finanzas/intranet...

# ==========================================================================
# Stage 4: Runner - Caddy (modern HTTP/3 server)
# ==========================================================================
FROM caddy:2-alpine AS runner
WORKDIR /srv
ENV PORT=3000

# Copy built SPA
COPY --from=build /app/apps/intranet/dist/client ./

# Copy Caddyfile
COPY apps/intranet/Caddyfile /etc/caddy/Caddyfile

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health >/dev/null || exit 1

EXPOSE 3000

# Caddy runs as non-root by default, uses /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
