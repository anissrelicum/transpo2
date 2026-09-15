#!/usr/bin/env bash
# Rejeu INTÉGRAL de la recette, sections A à T, sur l'environnement local.
#
# L'ordre n'est pas décoratif : la section A provisionne les organisations, B amorce les
# comptes, C→F remplissent le référentiel, G joue le terrain sur l'émulateur, H→T
# exploitent ce que le terrain a produit. Et mobile et web ne tournent JAMAIS ensemble :
# sur un poste unique ils se disputent la machine et la base (deux cas sont tombés pour
# cette raison le 14/09).
#
# Pré-requis, déjà en route : postgres (docker), l'API (3000/3002), la console (3001),
# Metro et l'émulateur Android.
#
#   qa/rejouer-tout.sh              # tout, depuis une base vierge
#   qa/rejouer-tout.sh --sans-reset # sans remise à zéro (reprise)
#   qa/rejouer-tout.sh --sans-mobile # sections web seulement (pas d'émulateur)
#
# Sur le homelab, exporter le profil avant de lancer :
#   export DATABASE_URL=postgres://…@localhost:5433/…   # port-forward svc/postgres
#   export API_URL=http://transpo-api.wedowonders.com WEB_URL=http://app.wedowonders.com
#   export PG_EXEC='kubectl exec -n transpo deploy/postgres --'
#   export ACCOUNT_EXEC='kubectl exec -n transpo deploy/transpo-api -- sh -c "cd /repo && pnpm --filter @transpo/db account %ARGS%"'
# La section G (émulateur) ne se joue PAS contre le homelab : l'app livreur vise l'API locale.
set -uo pipefail
cd "$(dirname "$0")/.."

# Les deux options se combinent ; l'ordre d'écriture sur la ligne de commande est libre.
SANS_RESET=non; SANS_MOBILE=non
for opt in "$@"; do
  case "$opt" in
    --sans-reset) SANS_RESET=oui ;;
    --sans-mobile) SANS_MOBILE=oui ;;
    *) echo "Option inconnue : $opt" >&2; exit 2 ;;
  esac
done

RUN_ID="${RUN_ID:-$(date +%Y-%m-%d)-local}"
export RUN_ID
export DATABASE_URL="${DATABASE_URL:-postgres://transpo:transpo_dev@localhost:5432/transpo}"
export API_URL="${API_URL:-http://localhost:3002}"
export WEB_URL="${WEB_URL:-http://localhost:3001}"
export PG_EXEC="${PG_EXEC:-docker exec transpo2-postgres-1}"
export ACCOUNT_EXEC="${ACCOUNT_EXEC:-pnpm --filter @transpo/db account}"
JOURNAL="qa/recette/$RUN_ID/journal.txt"
mkdir -p "qa/recette/$RUN_ID"
# Le journal repart à chaque lancement. Il s'accumulait d'un run à l'autre, si bien que le
# décompte final additionnait les passages de la journée : le 14/09 il a rendu les 69 échecs
# du matin comme s'ils venaient du rejeu qui venait de passer au vert.
[ -f "$JOURNAL" ] && mv "$JOURNAL" "qa/recette/$RUN_ID/journal-$(date +%H%M%S).txt"
: > "$JOURNAL"

etape() { echo -e "\n===== $* =====" | tee -a "$JOURNAL"; }
# Playwright VIDE son `outputDir` au démarrage, et les quatre appels ci-dessous le
# partagent : sans le rangement immédiat, chaque section effaçait les preuves de la
# précédente et le run ne gardait que les vidéos de la dernière. Un rejeu « tout vert »
# sans preuve pour les trois quarts des cas n'atteste de rien.
web()   {
  (cd apps/e2e-web && pnpm exec playwright test --config playwright.recette-video.config.ts "$@") 2>&1 | tee -a "$JOURNAL"
  (cd apps/e2e-web && node scripts/sort-videos.mjs) 2>&1 | tail -1 | tee -a "$JOURNAL"
}
mobile(){ (cd apps/driver-app && node recette/run.mjs "$@") 2>&1 | tee -a "$JOURNAL"; }

if [ "$SANS_RESET" = non ]; then
  etape "Base remise à zéro (tenants, plans, journal d'audit)"
  # Pas de `seed` : il ajoute trois organisations de démonstration que les décomptes de la
  # section A n'attendent pas.
  RESET_CONFIRM=oui pnpm --filter @transpo/db reset-test 2>&1 | tail -2 | tee -a "$JOURNAL"
  pnpm --filter @transpo/db migrate 2>&1 | tail -1 | tee -a "$JOURNAL"
  pnpm --filter @transpo/db migrate-plans 2>&1 | tail -1 | tee -a "$JOURNAL"
  [ -f "qa/recette/$RUN_ID/COMPTES.md" ] && mv "qa/recette/$RUN_ID/COMPTES.md" "qa/recette/$RUN_ID/COMPTES.precedent.md"

  # `reset-test` supprime AUSSI rabatexpress et tangerlog — le jeu de données §0.4 que
  # toutes les sections supposent acquis et qu'aucun cas ne recrée. Sans cette étape, le
  # rejeu « depuis une base vierge » n'a jamais été jouable : il ne tenait que sur un
  # rabatexpress laissé par une session antérieure (constaté sur le homelab le 14/09).
  etape "Jeu de données §0.4 (rabatexpress abonné Entreprise, tangerlog témoin)"
  node qa/amorcer-jeu-0-4.mjs 2>&1 | tee -a "$JOURNAL"
fi

etape "Section A — plateforme & provisionnement (29 cas)"
web a01 a02 a03 a04 a05 a06 a07 a08 a09 a10 a11 a12 a13 a14 a15 a16 a17 a18 a19 a20 a21 a22 a23 a24 a25 a26 a27 a28 a29

etape "Section B — amorçage des comptes & authentification (16 cas)"
web b01 b02 b03 b04 b05 b06 b07 b07b b08 b09 b10 b11 b12 b13 b14 b15 b15b b16
# Les cas à connexion refusée consomment le budget anti-bruteforce par source : on le
# repart à zéro, sinon la suite du run ne peut plus se connecter du tout.
# La base et l'utilisateur diffèrent d'un environnement à l'autre : on relit les variables
# du conteneur, comme `sql()`. La forme codée en dur échouait en silence sur le homelab.
$PG_EXEC sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DELETE FROM platform.login_attempts"' \
  2>&1 | tail -1 | tee -a "$JOURNAL"

etape "Sections C à F — paramètres, flotte, zones, commandes (46 cas)"
web c01 c02 c03 c04 d01 d02 d03 d04 d05 d06 d07 d08 d09 d10 d11 d12 d13 d14 d15 d16 d17 d18 d19 d20 d21 \
    e01 e02 e03 e04 e05 e06 e07 e08 f01 f02 f03 f04 f05 f06 f07 f08 f09 f10 f11 f12 f13

etape "Décor du terrain (comptes livreur, marchand, console ; organisation témoin)"
node apps/driver-app/recette/amorcer.mjs 2>&1 | tee -a "$JOURNAL"

if [ "$SANS_MOBILE" = non ]; then
  etape "Section G — app livreur, sur émulateur (18 cas) + TC-I05, TC-L03m, TC-T06"
  mobile
  mobile i05 l03m t06
else
  etape "Section G ignorée (--sans-mobile)"
fi

etape "Sections H à T — consoles (57 cas)"
web h01 h02 h03 h04 h05 i01 i02 i03 i04 j01 j02 j03 j04 k01 k02 k03 k04 \
    l01 l02 l03 l04 l05 l07 m01 m02 m03 m04 m07 n01 n02 n03 n04 o01 o04 \
    p01 p03 p04 p05 p06 q01 q02 q05 r01 r02 r03 s01 s02 s03 s04 s05 s06 s07 t01 t02 t03 t04 t05

etape "Fin — verdicts dans $JOURNAL"
grep -cE "✓" "$JOURNAL" | xargs echo "cas web verts :"
grep -cE " : OK$" "$JOURNAL" | xargs echo "cas mobiles verts :"
grep -E "✘| : ÉCHEC" "$JOURNAL" | sed 's/^/  /' || echo "  aucun échec"
