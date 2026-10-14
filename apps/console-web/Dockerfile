# Console web (Next.js) — build de production. Build depuis la racine du mono-repo.
# La prod précompile toutes les routes → réponses en ms, rendu déterministe
# (le mode dev recompilait à froid à la 1re requête → E2E lents et flaky).
FROM node:20-alpine
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --no-frozen-lockfile
WORKDIR /repo/apps/console-web
# Clé CARTO Basemaps, inlinée dans le bundle client par Next (vide → repli OSM).
ARG NEXT_PUBLIC_CARTO_BASEMAPS_KEY=
ENV NEXT_PUBLIC_CARTO_BASEMAPS_KEY=$NEXT_PUBLIC_CARTO_BASEMAPS_KEY
RUN pnpm build
EXPOSE 3001
CMD ["pnpm", "start"]
