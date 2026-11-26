# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl wget

FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN --mount=type=cache,target=/root/.npm \
  npm ci
RUN npx prisma generate

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Cache Next compile output across rebuilds when sources change little
RUN --mount=type=cache,target=/app/.next/cache \
  npm run build

FROM base AS runner
WORKDIR /app

ARG SUPER_ADMIN_EMAIL=
ENV SUPER_ADMIN_EMAIL=$SUPER_ADMIN_EMAIL
ENV BOOTSTRAP_ADMIN_EMAIL=$SUPER_ADMIN_EMAIL
ENV QEVA_EDITION=community
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p logs certs \
  && chown nextjs:nodejs logs certs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json

# Next standalone server (do not overwrite with custom HTTPS server.js)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Full node_modules so entrypoint can prisma db push + run seed scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
