# syntax=docker/dockerfile:1

# ============================================================================
# STAGE 1: Build - Node.js 25 on Alpine
# ============================================================================
FROM node:current-alpine AS build

WORKDIR /app

# Build dependencies for native modules (argon2)
RUN apk add --no-cache libc6-compat build-base python3

# Install pnpm globally (corepack removed in Node.js 25)
RUN npm install -g pnpm
ENV CI=true

# Copy all package.json files for the monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install all dependencies with Railway cache
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy all source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Generate ZenStack and build API
RUN pnpm --filter @finanzas/db generate && \
    pnpm --filter @finanzas/api build && \
    pnpm prune --prod

# ============================================================================
# STAGE 2: Runtime - Distroless Debian 13
# ============================================================================
FROM gcr.io/distroless/nodejs24-debian13

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
ENV CI=true
ENV NODE_COMPILE_CACHE=/app/.cache
ENV PORT=3000

EXPOSE 3000

CMD ["apps/api/dist/index.js"]
