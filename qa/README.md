# QA — Recette automatisée par agents

Recette fonctionnelle exécutée par des **agents** (et non à la main) sur le **homelab K8s**
(`http://transpo.wedowonders.com`, namespace `transpo`), selon les cas de
[`PLAN-TEST-MANUEL.md`](../PLAN-TEST-MANUEL.md).

## Acteurs et boucle

1. **Agent testeur** (QA) — exécute les cas dans un navigateur réel via Playwright
   (config `apps/e2e-web/playwright.homelab.config.ts`), prend des **captures à chaque
   étape**, consigne un **verdict par cas** dans le `RAPPORT.md` du run.
2. **Bug trouvé** → l'orchestrateur le transmet à l'**agent dev/archi** qui corrige,
   reconstruit l'image, la pousse sur le registry du homelab et redéploie
   (voir « Redéploiement » ci-dessous).
3. **Agent testeur reteste** le cas corrigé.
4. **Cas OK** → l'agent testeur écrit un **test de régression** Playwright dans
   `apps/e2e-web/tests/` (suite CI, `docker compose --profile test run --rm playwright`),
   distinct des specs de recette jetables de `apps/e2e-web/tests-recette/`.

## Structure

```
qa/recette/<run-id>/
├── RAPPORT.md              # verdicts : un cas = une ligne (OK / KO / BLOQUÉ) + constat
└── TC-XXX/                 # un dossier par cas
    ├── 01-*.png …          # captures numérotées dans l'ordre des étapes
    └── verdict.md          # attendu / obtenu / captures / anomalies
qa/recette/<run-id>/artefacts/   # sorties Playwright (traces, échecs)
```

## Redéploiement homelab (après correctif)

Le registry `10.105.15.135:5000` est un ClusterIP interne → pousser via port-forward :

```bash
kubectl port-forward -n registry svc/registry 5000:5000 &
docker buildx build --platform linux/amd64 -f apps/api/Dockerfile \
  -t localhost:5000/apps/transpo-api:latest --push .
docker buildx build --platform linux/amd64 -f apps/console-web/Dockerfile \
  -t localhost:5000/apps/transpo-web:latest --push .
kubectl rollout restart -n transpo deploy/transpo-api deploy/transpo-web
# Migrations + reset éventuel :
kubectl exec -n transpo deploy/transpo-api -- sh -c 'cd /repo && pnpm --filter @transpo/db migrate'
kubectl exec -n transpo deploy/transpo-api -- sh -c 'cd /repo && RESET_CONFIRM=oui pnpm --filter @transpo/db reset-test'
```

⚠️ Le PVC Postgres est en reclaim `Delete` : ne pas supprimer le PVC hors reset volontaire.

## Règles

- Tenant résolu par sous-domaine : le wildcard n'est pas routé sur le homelab → login avec
  `?org=<slug>` (comme en local docker).
- Les specs de `tests-recette/` sont **jetables** (preuve de recette) ; seuls les tests
  promus dans `apps/e2e-web/tests/` font foi pour la non-régression.
- Aucun verdict sans capture. Un cas non exécutable est **BLOQUÉ**, jamais sauté.
