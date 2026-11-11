# syntax=docker/dockerfile:1
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim AS base
# Bootstrap HTTPS from Node's bundled roots; the slim image has no system CA bundle.
RUN node -e "const fs=require('node:fs');fs.mkdirSync('/etc/ssl/certs',{recursive:true});fs.writeFileSync('/etc/ssl/certs/ca-certificates.crt',require('node:tls').rootCertificates.join('\\n'))" \
    && sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci

# This target retains Prisma CLI and tsx for a separate migration/admin job.
FROM dependencies AS build
COPY apps/api ./apps/api
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate \
    && npm run build

FROM build AS production-dependencies
RUN npm prune --omit=dev \
    && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    COOKIE_SECURE=true \
    SWAGGER_ENABLED=false \
    UPLOAD_DIR=/app/apps/api/uploads
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
RUN mkdir -p /app/apps/api/uploads \
    && chown node:node /app/apps/api/uploads
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health/ready',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
