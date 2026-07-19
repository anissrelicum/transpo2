# Console web (Next.js) — dev. Build depuis la racine du mono-repo.
FROM node:20-alpine
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --no-frozen-lockfile
WORKDIR /repo/apps/console-web
EXPOSE 3001
CMD ["pnpm", "dev"]
