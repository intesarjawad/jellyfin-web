# =============================================================================
# Streamberry — Custom Jellyfin Web Client
#
# Multi-stage build:
#   1. Node stage builds jellyfin-web with the Streamberry surface
#   2. Final stage extends the linuxserver/jellyfin image and replaces the
#      default web files with our build output
#
# Usage:
#   docker build -t jellyfin-streamberry .
#   Then use jellyfin-streamberry in place of lscr.io/linuxserver/jellyfin:latest
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build jellyfin-web
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /build

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies using the default npm registry
# (avoids any local mirror configs that may not resolve inside Docker)
RUN npm ci --registry=https://registry.npmjs.org

# Copy source
COPY . .

# Build production bundle
RUN npm run build:production

# ---------------------------------------------------------------------------
# Stage 2: Final image — linuxserver/jellyfin with custom web client
# ---------------------------------------------------------------------------
FROM lscr.io/linuxserver/jellyfin:latest

# Replace the stock jellyfin-web with our Streamberry build.
# The linuxserver image serves web files from /usr/share/jellyfin/web/
COPY --from=builder /build/dist/ /usr/share/jellyfin/web/
