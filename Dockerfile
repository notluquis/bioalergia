# syntax=docker/dockerfile:1.4
# Multi-stage Dockerfile optimized for Railway Metal builders

# Stage 1: Base (Common files)
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# Stage 2: Dependencies (Prod & Dev)
FROM base AS deps
# Copy Prisma schema (needed for postinstall generate)
COPY prisma ./prisma/
# Set dummy DB URL for Prisma generation
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
# Only generate Prisma binaries for Alpine Linux (musl) - reduces size significantly
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x"
# Install ALL dependencies with cache mount
RUN --mount=type=cache,id=npm,target=/root/.npm npm ci

# Stage 3: Builder
FROM deps AS builder
COPY . .
# Build the application
RUN npm run build:prod

# Stage 4: Production Dependencies (Prune from full deps)
FROM deps AS prod-deps
# Prune dev dependencies (this keeps the already generated Prisma client)
RUN npm prune --omit=dev && \
    # Remove unnecessary files from node_modules to reduce size
    rm -rf node_modules/.cache node_modules/*/.git node_modules/*/test node_modules/*/tests node_modules/*/*.md node_modules/*/docs 2>/dev/null || true

# Stage 5: Runner (Production Image)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create necessary directories for uploads and storage with correct permissions
RUN mkdir -p /app/uploads /app/storage && chown -R node:node /app/uploads /app/storage

# Don't run as root
USER node

# Copy prod deps from prod-deps stage
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=node:node /app/dist ./dist

# Expose port
EXPOSE 3000

# Health check (optional - Railway has its own health checks)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Start directly with node (faster than npm start - no npm overhead)
CMD ["node", "dist/server/index.js"]
