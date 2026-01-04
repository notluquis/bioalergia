# syntax=docker/dockerfile:1

# ============================================================================
# STAGE 1: Build - Node.js 25 on Alpine (smallest build image)
# Leverages: V8 14.1, faster JSON serialization, portable compile cache
# ============================================================================
FROM node:current-alpine AS build

WORKDIR /app

# Build dependencies for native modules (argon2, prisma)
# libc6-compat: glibc compatibility for native bindings
# build-base: gcc, g++, make for compilation
# python3: required by node-gyp
RUN apk add --no-cache libc6-compat build-base python3

# Enable pnpm via corepack (Node.js 25 has improved corepack)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfiles first for optimal layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install dependencies with Railway cache mount for faster rebuilds
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Build in single layer: prisma generate + TypeScript compile + prune
RUN pnpm --filter @finanzas/db prisma:generate && \
    pnpm --filter @finanzas/api build && \
    pnpm prune --prod

# ============================================================================
# STAGE 2: Runtime - Distroless Debian 13 (Trixie)
# Leverages: Linux kernel 6.12, ROP/COP/JOP protections, minimal attack surface
# Size: ~30MB, No shell, No package manager = maximum security
# ============================================================================
FROM gcr.io/distroless/nodejs24-debian13

WORKDIR /app

# Copy only production artifacts (no dev dependencies, no source)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/package.json ./

# Production optimizations
ENV NODE_ENV=production
ENV PORT=3000

# Enable Node.js 25 portable compile cache for faster cold starts
ENV NODE_COMPILE_CACHE=/app/.cache

EXPOSE 3000

# Distroless: direct JS file execution (no shell available)
# Railway injects DATABASE_URL, PASETO_KEY, etc. at runtime
CMD ["apps/api/dist/index.js"]
