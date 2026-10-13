# Multi-stage Dockerfile for Blade Fruit service
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build frontend CSS
COPY . .
RUN npm run build:css

# Prune dev dependencies for production
RUN npm prune --omit=dev

# Production image
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/blade-fruit.db \
    UPLOAD_DIR=/data/uploads

# Create persistent data and uploads directory owned by non-root node user
RUN mkdir -p /data/uploads && chown -R node:node /data

# Copy production dependencies and application files from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/server ./server
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/scripts ./scripts

USER node

VOLUME ["/data"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/readyz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
