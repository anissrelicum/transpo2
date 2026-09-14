# Profil d'environnement du homelab K8s — à sourcer avant `qa/rejouer-tout.sh`.
#
#   source qa/profil-homelab.sh && qa/rejouer-tout.sh
#
# Pré-requis : `kubectl port-forward -n transpo svc/postgres 5433:5432` en route, et le
# contexte kubectl positionné sur admin@homelab.
#
# La section G (émulateur Android) n'est PAS couverte par ce profil : l'app livreur vise
# l'API de son build. La jouer contre le homelab demande de la reconstruire avec
# EXPO_PUBLIC_API_URL pointé sur l'ingress, et jamais en même temps que les cas web.
export RUN_ID="${RUN_ID:-$(date +%Y-%m-%d)-homelab}"
export DATABASE_URL="postgres://postgres:501373f412610fa0378f89ddb298a03f@localhost:5433/transpo_db"
export API_URL="http://transpo-api.wedowonders.com"
export WEB_URL="http://transpo.wedowonders.com"
export PG_EXEC="kubectl exec -n transpo deploy/postgres --"
export ACCOUNT_EXEC='kubectl exec -n transpo deploy/transpo-api -- sh -c "cd /repo && pnpm --filter @transpo/db account %ARGS%"'
