# ==============================================================================
# RAIOC OS - Multi-Stage Production Containerization Dockerfile
# Base: Node.js 20 Alpine (Lightweight, Security Hardened, Non-Root)
# ==============================================================================

# --- Stage 1: Dependency Resolver ---
FROM node:20-alpine AS dependencies
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev --ignore-scripts

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

# Install dumb-init for robust process signal forwarding and zombie reaping
RUN apk add --no-cache dumb-init curl

ENV NODE_ENV=production \
    RUNTIME_MODE=persistent_daemon \
    PORT=3000

# Set up non-root user directory permissions
RUN chown -R node:node /app

# Copy production node_modules from dependencies stage
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./

# Copy full application codebase
COPY --chown=node:node . .

# Enforce non-root execution
USER node

# Expose HTTP API & Command Center port
EXPOSE 3000

# Native container healthcheck probing the Mission Control consolidated state endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.get('http://localhost:' + (process.env.PORT || 3000) + '/api/v1/mission-control/v1-state', (res) => process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1)); req.on('error', () => process.exit(1)); req.setTimeout(4000, () => { req.destroy(); process.exit(1); });"

# Signal trapping with dumb-init for graceful shutdown (SIGTERM / SIGINT)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command starts the Always-On persistent daemon
CMD ["node", "src/workers/daemon-entrypoint.js"]
