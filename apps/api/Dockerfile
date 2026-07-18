# API NestJS — build depuis la racine du mono-repo (context: . dans docker-compose.yml).
FROM node:20-alpine
RUN corepack enable
WORKDIR /repo

# Manifests d'abord (cache d'install)
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/domain/package.json packages/domain/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --no-frozen-lockfile

# Code
COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["pnpm", "start"]
