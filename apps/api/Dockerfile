# Image applicative partagée (API + jobs de migration/seed).
# Build depuis la racine du mono-repo (context: . dans docker-compose.yml).
FROM node:20-alpine
RUN corepack enable
WORKDIR /repo

# Tout le repo (le .dockerignore exclut node_modules, .git, .env…).
COPY . .
RUN pnpm install --no-frozen-lockfile

# Défaut : l'API. Le service `migrate` surcharge working_dir + command.
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["pnpm", "start"]
