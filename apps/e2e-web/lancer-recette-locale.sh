#!/usr/bin/env bash
# Recette web sur environnement LOCAL (API sur l'hôte, PostgreSQL en conteneur).
#
# Le homelab K8s était éteint le 13/09 : `sql()` passait par `kubectl exec` et toute la
# suite devenait injouable. L'accès à la base est donc paramétrable (`PG_EXEC`), et ce
# lanceur pose l'environnement local d'un coup.
#
#   ./lancer-recette-locale.sh            # toutes les sections écrites
#   ./lancer-recette-locale.sh h01 h02    # quelques cas
set -euo pipefail
cd "$(dirname "$0")"

export WEB_URL="${WEB_URL:-http://localhost:3001}"
export API_URL="${API_URL:-http://localhost:3000}"
export RUN_ID="${RUN_ID:-2026-09-13-local}"
export PG_EXEC="${PG_EXEC:-docker exec transpo2-postgres-1}"

echo "Console : $WEB_URL · API : $API_URL · run : $RUN_ID"
pnpm exec playwright test --config playwright.recette-video.config.ts "$@"
