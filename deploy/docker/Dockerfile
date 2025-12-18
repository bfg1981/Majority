# syntax=docker/dockerfile:1
#
# Multi-stage build:
# 1) Generate optional cache files (web/config/index.json + web/config/manifest.json)
#    using Playwright in a controlled environment.
# 2) Serve only the static site (web/) via nginx, without build dependencies.
#
# Build: docker build -f deploy/docker/Dockerfile -t majority:latest .
#

FROM mcr.microsoft.com/playwright:v1.50.0-jammy AS generator

WORKDIR /app

# Install dependencies deterministically
COPY package.json package-lock.json ./
RUN npm ci

# Ensure Chromium is available for Playwright
RUN npx playwright install chromium

# Copy only what the generator and site need
COPY scripts ./scripts
COPY web ./web

# Generate deployment cache artifacts (optional at runtime, but included in the image)
RUN npm run generate:cache


FROM nginx:alpine AS runtime

# Copy the deployable docroot only
COPY --from=generator /app/web /usr/share/nginx/html

EXPOSE 80
