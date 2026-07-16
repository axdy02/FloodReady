FROM node:24.18.0-bookworm-slim@sha256:cb4e8f7c443347358b7875e717c29e27bf9befc8f5a26cf18af3c3dec80e58c5 AS runtime-base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && groupadd --gid 10001 floodready && useradd --uid 10001 --gid 10001 --create-home floodready && mkdir -p /app/uploads && chown -R 10001:10001 /app
WORKDIR /app

FROM runtime-base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
ARG DATABASE_URL=postgresql://localhost:5432/floodready_build
ENV DATABASE_URL=$DATABASE_URL
COPY . .
RUN npm run build

FROM dependencies AS demo-seed-build
ARG DATABASE_URL=postgresql://localhost:5432/floodready_build
ENV DATABASE_URL=$DATABASE_URL
COPY . .
RUN npm run build:demo-seed && mkdir -p dist-demo/src && cp -R src/generated dist-demo/src/generated && cp prisma/demo-locations.json dist-demo/prisma/demo-locations.json

FROM runtime-base AS production-dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM runtime-base AS runtime
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health/ready').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]

FROM runtime-base AS migration
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY scripts/migrate-with-retry.mjs ./scripts/migrate-with-retry.mjs
COPY prisma ./prisma
USER 10001:10001
CMD ["node", "scripts/migrate-with-retry.mjs"]

FROM runtime-base AS demo-seed
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=demo-seed-build --chown=10001:10001 /app/dist-demo ./dist-demo
USER 10001:10001
CMD ["node", "dist-demo/prisma/demo-seed.js", "--manifest-json"]
