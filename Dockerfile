# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
# Allow alternate names Coolify might use
ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY

# Set environment variables for build (available to all RUN steps below).
# Both VITE_SUPABASE_* and SUPABASE_* names are set so the prerender script
# can find credentials regardless of how Coolify exposes them.
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY

# Step 1: Build the Vite bundle (sitemap + JS/CSS assets)
RUN npm run build:vite

# Step 2: Prerender public pages to static HTML (separate step for visibility)
# If this step fails in Coolify logs, check that VITE_SUPABASE_URL and
# VITE_SUPABASE_PUBLISHABLE_KEY are set as Build Arguments (not just runtime vars).
RUN node scripts/prerender.mjs

# Step 3: Verify blog prerender produced at least one blog post HTML file.
# index.html stays as the bare app shell (no homepage flash on the dashboard).
RUN BLOG_COUNT=$(find /app/dist/blog -name "index.html" 2>/dev/null | wc -l) && \
    echo "[verify] blog post pages prerendered: ${BLOG_COUNT}" && \
    echo "[verify] dist/index.html size: $(wc -c < /app/dist/index.html) bytes (app shell)" && \
    echo "[verify] OK — prerender complete."

# Production stage
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Traefik labels for header configuration (must be applied by Traefik).
# NOTE: Content-Security-Policy (frame-ancestors) is intentionally handled in nginx.conf
# on a per-route basis: /embed/* allows frame-ancestors *, all other routes use 'self'.
# Setting it here via Traefik would apply globally and break the embed widget.
LABEL traefik.http.middlewares.anfrage24-headers.headers.framedeny="false"
LABEL traefik.http.middlewares.anfrage24-headers.headers.customresponseheaders.Access-Control-Allow-Origin="*"
LABEL traefik.http.middlewares.anfrage24-headers.headers.customresponseheaders.Access-Control-Allow-Methods="GET, POST, PUT, DELETE, OPTIONS"
LABEL traefik.http.middlewares.anfrage24-headers.headers.customresponseheaders.Access-Control-Allow-Headers="*"

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
