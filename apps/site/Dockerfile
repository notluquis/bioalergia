# syntax=docker/dockerfile:1.4

# ==========================================================================
# Stage 1: Prune monorepo for site
# ==========================================================================
FROM node:current-slim AS pruner
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest --force && corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
RUN pnpm -w turbo prune --scope=@finanzas/site --docker

# ==========================================================================
# Stage 2: Base deps
# ==========================================================================
FROM node:current-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest --force && corepack enable && corepack prepare pnpm@10.28.0 --activate

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=s/15a5a9cb-b1d7-4fa9-8082-b013705c6f0f-/pnpm/store,target=/pnpm/store     pnpm install --frozen-lockfile

# ==========================================================================
# Stage 3: Build
# ==========================================================================
FROM base AS build
ARG VITE_PUBLIC_POSTHOG_KEY
ARG VITE_PUBLIC_POSTHOG_HOST
COPY --from=pruner /app/out/full/ .
ENV CI=true
ENV VITE_PUBLIC_POSTHOG_KEY=${VITE_PUBLIC_POSTHOG_KEY}
ENV VITE_PUBLIC_POSTHOG_HOST=${VITE_PUBLIC_POSTHOG_HOST}
RUN pnpm -w turbo run build --filter=@finanzas/site

# ==========================================================================
# Stage 4: Runner (Nginx)
# ==========================================================================
FROM nginxinc/nginx-unprivileged:mainline-alpine AS runner
WORKDIR /usr/share/nginx/html
COPY --from=build /app/apps/site/dist ./
COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3   CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
