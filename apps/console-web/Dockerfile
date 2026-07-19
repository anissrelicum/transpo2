# Console web (Next.js) — build de production. Build depuis la racine du mono-repo.
# La prod précompile toutes les routes → réponses en ms, rendu déterministe
# (le mode dev recompilait à froid à la 1re requête → E2E lents et flaky).
FROM node:20-alpine
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --no-frozen-lockfile
WORKDIR /repo/apps/console-web
RUN pnpm build
EXPOSE 3001
CMD ["pnpm", "start"]
