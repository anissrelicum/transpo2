# Profil d'environnement local — à sourcer avant `qa/rejouer-tout.sh`.
#
#   source qa/profil-local.sh && qa/rejouer-tout.sh
#
# Pré-requis en route : postgres (docker), l'API (3000 pour le mobile, 3002 pour le web),
# la console (3001), Metro et l'émulateur Android.
#
# C'est le SEUL profil où la section G est jouable : l'app livreur vise l'API de son build
# (`EXPO_PUBLIC_API_URL`, sinon localhost:3000), pas l'ingress du homelab.
export RUN_ID="${RUN_ID:-$(date +%Y-%m-%d)-local}"
export DATABASE_URL="postgres://transpo:transpo_dev@localhost:5432/transpo"
export API_URL="http://localhost:3000"
export WEB_URL="http://localhost:3001"
export PG_EXEC="docker exec transpo2-postgres-1"
export ACCOUNT_EXEC="pnpm --filter @transpo/db account"
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
