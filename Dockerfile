FROM node:20-trixie-slim AS builder
# FROM node:20-trixie as builder

WORKDIR /app

# RUN apt update && apt -y install iputils-ping net-tools netcat-openbsd httpie curl
RUN apt-get update && apt -y install git && rm -rf /var/lib/apt/lists/*

# Accept build argument for client-side log level
ARG VITE_LOG_LEVEL=info

COPY . /app
RUN npm install
# Pass VITE_LOG_LEVEL to the build process
RUN VITE_LOG_LEVEL=${VITE_LOG_LEVEL} npm run build
# Prune dev dependencies for smaller production image
RUN npm prune --production



FROM node:20-trixie-slim AS runner
# FROM node:20-trixie AS runner

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt-get update && apt-get -y install netcat-openbsd iproute2 net-tools iputils-ping telnet procps neovim && rm -rf /var/lib/apt/lists/*

# Copy node_modules from builder (already pruned to production only)
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/build /app/build
COPY server.js /app/server.js
COPY oinit.js /app/oinit.js
COPY logger.js /app/logger.js

EXPOSE 8444

CMD ["node", "-r", "dotenv/config", "./server.js"]
