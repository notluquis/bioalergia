# syntax=docker/dockerfile:1.4

# ==========================================================================
# Stage 1: Prune monorepo for site
# ==========================================================================
FROM node:20-slim AS pruner
WORKDIR /app
COPY . .
RUN npx turbo@^2 prune --scope=@finanzas/site --docker

# ==========================================================================
# Stage 2: Base deps
# ==========================================================================
FROM node:20-slim AS base
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

RUN --mount=type=cache,id=s/15a5a9cb-b1d7-4fa9-8082-b013705c6f0f-/pnpm/store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ==========================================================================
# Stage 3: Build
# ==========================================================================
FROM base AS build
COPY --from=pruner /app/out/full/ .
ENV CI=true
RUN pnpm turbo run build --filter=@finanzas/site

# ==========================================================================
# Stage 4: Runner (Nginx)
# ==========================================================================
FROM nginxinc/nginx-unprivileged:mainline-alpine AS runner
WORKDIR /usr/share/nginx/html
COPY --from=build /app/apps/site/dist ./
COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
