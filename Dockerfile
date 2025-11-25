# syntax=docker/dockerfile:1.4
# Multi-stage Dockerfile optimized for Railway Metal builders
# Stage 1: Build
FROM node:22-alpine AS builder

# Update npm to latest version
RUN npm install -g npm@11.6.3

WORKDIR /app

# Set DATABASE_URL for Prisma (needed during npm ci postinstall)
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"

# Copy package files first (changes less often = better cache)
COPY package*.json ./

# Copy Prisma schema (needed for prisma generate during postinstall)
COPY prisma ./prisma/

# Install ALL dependencies with cache mount (persists npm cache across builds)
# This layer will be cached if package.json and prisma schema haven't changed
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code LAST (changes most often)
COPY . .

# Build the application
RUN npm run build:prod

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy node_modules from builder (faster than npm ci)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated

# Copy necessary runtime files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Remove dev dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm prune --omit=dev

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["npm", "start"]
