# syntax=docker/dockerfile:1.4
# Multi-stage Dockerfile optimized for Railway Metal builders

# Stage 1: Base (Common files)
# Use latest Current version with Debian Slim (User preference: specific latest features)
FROM node:current-slim AS base
# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./

# Stage 2: Dependencies (Prod & Dev)
FROM base AS deps
# Copy Prisma schema (needed for postinstall generate)
COPY prisma ./prisma/
# Set dummy DB URL for Prisma generation
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
# Only generate Prisma binaries for Debian Linux (glibc) - optimized for node:20-slim
ENV PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x"
# Install dependencies with cache mount (User requirement: Always use latest npm)
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/root/.npm,target=/root/.npm \
    npm install -g npm@latest && \
    npm ci

# Stage 3: Builder
FROM deps AS builder
COPY . .
# Build the application
RUN npm run build:prod

# Stage 4: Production Dependencies (Fresh Install)
FROM deps AS prod-deps
# Install ONLY production dependencies directly (much faster than pruning)
RUN --mount=type=cache,id=s/cc493466-c691-4384-8199-99f757a14014-/root/.npm,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# Stage 5: Runner (Production Image)
# Use latest Current version to match base
FROM node:current-slim AS runner
# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Create necessary directories for uploads and storage with correct permissions
RUN mkdir -p /app/uploads /app/storage && chown -R node:node /app/uploads /app/storage

# Don't run as root
USER node

# Copy prod deps from prod-deps stage
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Copy Prisma Client from deps stage (It was generated there!)
COPY --from=deps --chown=node:node /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=deps --chown=node:node /app/node_modules/@prisma/client /app/node_modules/@prisma/client

# Copy built application from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist

# Expose port
EXPOSE 3000

# Start directly with node (faster than npm start - no npm overhead)
CMD ["node", "dist/server/index.js"]
