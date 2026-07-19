#!/usr/bin/env bash
# À exécuter SUR l'hôte Dokku (après cloud-init). Crée les apps Transpo, la base,
# les domaines (wildcard tenant), les ports et le SSL self-signed.
#
#   API     : transpo-api  (interne, réseau dokku)   ← DATABASE_URL (plugin postgres)
#   Console : transpo-web   → transpo.wedo.technology + *.transpo.wedo.technology
#
# Prérequis : JWT_SECRET fourni en 1er argument (sinon généré).
set -euo pipefail

BASE_DOMAIN="${BASE_DOMAIN:-transpo.wedo.technology}"
JWT_SECRET="${1:-$(openssl rand -hex 32)}"

# --- Réseau interne pour la communication web -> api ---
dokku network:create transpo-net || true

# --- Base de données ---
dokku postgres:create transpo-db || true

# --- API ---
dokku apps:create transpo-api || true
dokku builder-dockerfile:set transpo-api dockerfile-path apps/api/Dockerfile
dokku postgres:link transpo-db transpo-api || true          # pose DATABASE_URL
dokku config:set --no-restart transpo-api JWT_SECRET="$JWT_SECRET" API_PORT=3000
dokku ports:set transpo-api http:3000:3000 || true
dokku network:set transpo-api attach-post-deploy transpo-net

# --- Console web ---
dokku apps:create transpo-web || true
dokku builder-dockerfile:set transpo-web dockerfile-path apps/console-web/Dockerfile
# API vue depuis le serveur Next via le réseau dokku interne :
dokku config:set --no-restart transpo-web \
  API_URL="http://transpo-api.web:3000" \
  DEFAULT_TENANT="casaexpress" \
  NODE_ENV="production"
dokku network:set transpo-web attach-post-deploy transpo-net
dokku ports:set transpo-web http:80:3001 https:443:3001 || true

# --- Domaines : racine + wildcard tenant ---
dokku domains:set transpo-web "$BASE_DOMAIN" "*.$BASE_DOMAIN"

echo
echo "== Apps créées. Déployez depuis votre poste : =="
echo "  git remote add dokku-api dokku@<IP>:transpo-api  && git push dokku-api main"
echo "  git remote add dokku-web dokku@<IP>:transpo-web  && git push dokku-web main"
echo
echo "== Migrations + seed (après 1er déploiement de l'API) : =="
echo "  dokku run transpo-api sh -c 'cd /repo && pnpm --filter @transpo/db migrate && pnpm --filter @transpo/db seed'"
echo
echo "== SSL self-signed wildcard : =="
echo "  ./deploy/gen-wildcard-cert.sh $BASE_DOMAIN /tmp/certs"
echo "  tar -cf /tmp/certs.tar -C /tmp/certs fullchain.pem key.pem && dokku certs:add transpo-web < /tmp/certs.tar"
echo
echo "JWT_SECRET utilisé : $JWT_SECRET"
