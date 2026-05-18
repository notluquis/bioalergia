# syntax=docker/dockerfile:1.4

# ==========================================================================
# Stage 1: Prune monorepo for site
# ==========================================================================
FROM node:slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
COPY . .
RUN npm install -g pnpm@11.1.1
RUN TURBO_TELEMETRY_DISABLED=1 pnpm dlx turbo@2.9.1 prune @finanzas/site --docker

# ==========================================================================
# Stage 2: Base deps
# ==========================================================================
FROM node:slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
RUN npm install -g pnpm@11.1.1

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=s/15a5a9cb-b1d7-4fa9-8082-b013705c6f0f-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ==========================================================================
# Stage 3: Build
# ==========================================================================
FROM base AS build
ARG VITE_PUBLIC_POSTHOG_KEY
ARG VITE_PUBLIC_POSTHOG_HOST
ARG VITE_MERCADOPAGO_PUBLIC_KEY
ARG VITE_STOREFRONT_URL
COPY --from=pruner /app/out/full/ .
ENV CI=true
ENV TURBO_TELEMETRY_DISABLED=1
ENV VITE_PUBLIC_POSTHOG_KEY=${VITE_PUBLIC_POSTHOG_KEY}
ENV VITE_PUBLIC_POSTHOG_HOST=${VITE_PUBLIC_POSTHOG_HOST}
ENV VITE_MERCADOPAGO_PUBLIC_KEY=${VITE_MERCADOPAGO_PUBLIC_KEY}
ENV VITE_STOREFRONT_URL=${VITE_STOREFRONT_URL}
RUN --mount=type=cache,id=s/15a5a9cb-b1d7-4fa9-8082-b013705c6f0f-/app/.turbo/cache,target=/app/.turbo/cache \
    pnpm -w turbo run build --filter=@finanzas/site

# ==========================================================================
# Stage 4: Runner - Caddy (modern HTTP/3 server)
# ==========================================================================
FROM caddy:2-alpine AS runner
WORKDIR /srv
ENV PORT=3000

# Copy built static site
COPY --from=build /app/apps/site/dist ./

# Copy Caddyfile
COPY apps/site/Caddyfile /etc/caddy/Caddyfile

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health >/dev/null || exit 1

EXPOSE 3000

# Caddy runs as non-root by default
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
