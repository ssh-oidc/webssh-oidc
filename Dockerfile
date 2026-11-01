# syntax=docker/dockerfile:1

# ---- builder ----------------------------------------------------------------
FROM node:22-trixie-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get -y install git python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

ARG VITE_LOG_LEVEL=info

# Install dependencies first for layer caching (see .dockerignore).
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . /app
RUN VITE_LOG_LEVEL=${VITE_LOG_LEVEL} npm run build
# Prune dev dependencies for a smaller production image
RUN npm prune --production

# ---- runner -----------------------------------------------------------------
# Production runtime: node_modules (pruned), the SvelteKit build and the
# Node entry points. Configuration (config/*.yml) and secrets stay outside
# the image: mount them (docker/compose.yaml) or set env vars.
FROM node:22-trixie-slim AS runner

ENV NODE_ENV=production

# netcat-openbsd is needed by the healthcheck (compose and below).
RUN apt-get update \
    && apt-get -y install netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules /app/node_modules
COPY --from=builder --chown=node:node /app/package.json /app/package.json
COPY --from=builder --chown=node:node /app/build /app/build
COPY --chown=node:node server.js ws-bridge.js oinit.js logger.js /app/

USER node

EXPOSE 8444

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD nc -z localhost 8444

CMD ["node", "-r", "dotenv/config", "./server.js"]
