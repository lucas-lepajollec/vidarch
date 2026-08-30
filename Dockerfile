# ==========================================
# Multi-stage Dockerfile for VidArch
# Self-hosted Video Archiver & Player
# ==========================================

# Stage 1: Build React Client
FROM node:26-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build Server & Native Dependencies (better-sqlite3)
FROM node:26-bookworm-slim AS server-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY server/ ./server/
RUN npm ci
RUN npx tsc -p server/tsconfig.json
RUN npm prune --omit=dev

# Stage 3: Production Runtime (Clean & Lightweight)
FROM node:26-bookworm-slim AS runner

ARG YT_DLP_VERSION=2026.08.19

# Install runtime system dependencies: python3, ffmpeg, ca-certificates, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install a pinned standalone yt-dlp binary for reproducible images
RUN curl -fL --retry 3 "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy dependencies and compiled server from Stage 2
COPY package*.json ./
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/dist ./dist
COPY --from=server-builder /app/server ./server

# Copy built frontend from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Create persistent storage directories
RUN mkdir -p /app/data /app/downloads

# Environment variables
ENV NODE_ENV=production
ENV PORT=2499
ENV DATA_DIR=/app/data
ENV DOWNLOADS_DIR=/app/downloads
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp

EXPOSE 2499

VOLUME ["/app/data", "/app/downloads"]

CMD ["node", "dist/server/index.js"]
