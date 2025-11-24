# Multi-stage Dockerfile for optimal image size
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Copy source code (needed for build and scripts for prisma generate)
COPY . .

# Install ALL dependencies (needed for build)
RUN npm ci

# Generate Prisma Client (needs DATABASE_URL for type generation, not connection)
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN npm run prisma:generate

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

# Remove dev dependencies to reduce size
RUN npm prune --omit=dev

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["npm", "start"]
