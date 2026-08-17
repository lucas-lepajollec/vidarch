# ==========================================
# Multi-stage Dockerfile for VidArch
# Self-hosted Video Archiver & Player
# ==========================================

# Stage 1: Build React Client
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-bookworm-slim

# Install system dependencies: python3, pip, ffmpeg, ca-certificates, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip in a virtualenv or with break-system-packages
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

# Copy root & server configuration
COPY package*.json ./
COPY server/ ./server/

# Install server production & build dependencies
RUN npm install

# Build TypeScript server
RUN npx tsc -p server/tsconfig.json

# Copy built frontend from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

# Create persistent storage directories
RUN mkdir -p /app/data /app/downloads

# Environment variables
ENV NODE_ENV=production
ENV PORT=2499
ENV DATA_DIR=/app/data
ENV DOWNLOADS_DIR=/app/downloads
ENV YT_DLP_PATH=yt-dlp

EXPOSE 2499

VOLUME ["/app/data", "/app/downloads"]

CMD ["node", "dist/server/index.js"]
