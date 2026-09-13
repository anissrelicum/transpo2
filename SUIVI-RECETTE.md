# Feuille de suivi — Recette manuelle Transpo

Trace d'exécution de `PLAN-TEST-MANUEL.md`. Un cas = une ligne : **verdict** (OK / KO / BLOQUÉ / N/A)
**et** constat produit (cf. règle « la recette est un levier produit » — un cas peut passer et
révéler un défaut). Environnement de référence : **prod Dokku**
(`https://<slug>.transpo.wedo.technology`, API `https://api.transpo.wedo.technology`).

## Repères d'environnement

| Élément | Valeur au 31/08/2026 |
|---|---|
| SHA déployé (transpo-api / transpo-web) | `761f2ad` |
| SHA local `main` | `1e0ac9c` — **le correctif AN-10 n'est pas en prod** |
| Tenants existants | `rabatexpress` (ACTIF, plan Transporteur, renouvellement 2026-09-01) · `tangerlog` (SUSPENDU, Essai) |
| Comptes tenant connus | aucun mot de passe valide connu pour `admin@rabatexpress.ma` |

## Cas exécutés

| Cas | Rôle testeur | Env. | Statut | Constat / réf | Date |
|---|---|---|---|---|---|
| TC-A01 → TC-A28 | Super-admin | Prod | *(non tracé)* | Déroulés du 16 au 24/08 d'après les commits (catalogue de plans, cycle d'abonnement, statut dérivé du contrat). Verdicts non consignés à l'époque — à retracer si besoin de preuve. | 16-24/08 |
| TC-B01 | Anonyme | Prod | OK *(historique)* | A donné **AN-01**, corrigé le 24/08 (`761f2ad`) : le provisioning crée l'admin + mot de passe temporaire. | 24/08 |
| TC-B02 | — | Prod | OK *(historique)* | Contournement `account` documenté §0.3. | 24/08 |
| TC-B03 | Anonyme | Prod | **OK** | 400 « Tenant inconnu : inexistant », identique via BFF (`inexistant.transpo…/api/login`) et API directe. → **OBS-01** | 31/08 |
| TC-B04 | Anonyme | Prod | **NON EXÉCUTÉ** | Reporté : le compteur d'échecs est keyé `(tenant,email)` et bloquerait l'email admin 15 min. À jouer sur un email dédié en fin de section B. → **OBS-02** (lecture de code) | — |
| TC-B05 | Super-admin | Prod | **OK (partiel)** | Connexion sur un tenant SUSPENDU (`tangerlog`) → 403 « Espace suspendu — contactez la plateforme. » côté API **et** BFF. **Volet « sessions en cours coupées » non vérifiable** : le correctif AN-10 n'est pas déployé. → **DEPL-01**, **OBS-03** | 31/08 |
| TC-B06 → TC-B15 | Admin tenant | Prod | **BLOQUÉ** | Aucun compte connu sur `rabatexpress` ; la création d'un premier compte sur un tenant **déjà provisionné** exige un accès shell à la prod. → **AN-11** | 31/08 |

## Constats produit

**AN-11 — Un tenant provisionné avant le correctif AN-01 reste inaccessible.**
`761f2ad` crée l'administrateur **au moment du provisioning uniquement**. Pour un tenant déjà
existant sans compte (cas de `rabatexpress` et `tangerlog`, créés le 24/08 avant le déploiement),
il n'existe **aucun écran ni endpoint** — même super-admin — pour amorcer un compte : il faut
`dokku run transpo-api … pnpm account`. Sévérité **haute** (bloque la recette, et en clientèle
tout tenant orphelin d'admin, ex. dernier admin désactivé côté base).
*Piste :* action « Créer / réinitialiser l'administrateur » dans le menu d'une organisation de la
console plateforme, tracée dans le journal d'audit.

**OBS-01 — La réponse de login permet d'énumérer les organisations.**
Un slug inexistant renvoie 400 « Tenant inconnu : `<slug>` », un slug existant 401 « Identifiants
invalides » : on distingue les tenants réels sans aucun compte. Sévérité **faible** (pas de donnée
exposée, mais la liste des clients l'est). *Piste :* message générique côté login public, le détail
restant côté journal.

**OBS-02 — L'anti-bruteforce ne tient pas la charge réelle.**
`apps/api/src/auth/auth.service.ts:9` — compteur **en mémoire du processus**, clé `(tenant,email)` :
(1) remis à zéro à chaque déploiement ou redémarrage de conteneur ; (2) aucun comptage par IP, donc
le *password spraying* (un essai sur 200 emails) n'est jamais freiné ; (3) plusieurs instances API =
autant de compteurs indépendants. Sévérité **moyenne**. *Piste :* compteur partagé (Postgres/Redis)
avec une seconde clé par IP.

**OBS-03 — Une organisation suspendue n'affiche pas de motif.**
`tangerlog` est en statut `SUSPENDU` avec `statusReason: null` et `subStatus: null` dans
`GET /v1/saas/tenants`. TC-B05 attend que « le motif saisi s'affiche sous le statut d'abonnement » :
sur un tenant suspendu sans motif, la console plateforme comme le message client restent muets sur
la raison. Sévérité **faible**. *Piste :* motif obligatoire à la suspension, repris dans le message
« Espace suspendu ».

**OBS-04 — Le seul contournement documenté pour amorcer un compte ne s'exécute pas.**
`PLAN-TEST-MANUEL.md` §0.3 et l'en-tête de `packages/db/src/create-account.ts` documentaient
`pnpm --filter @transpo/db account -- <slug> …` : `pnpm` transmet le `--` littéralement, donc
`slug` valait `--`, `email` valait le slug, et le script échouait sur « Rôle inconnu : Nadia Alaoui ».
Le trou d'amorçage d'AN-11 était donc doublé d'une notice inapplicable. Sévérité **moyenne**
(bloque tout démarrage de recette, et toute reprise en main d'un tenant en clientèle).
*Corrigé le 01/09* : usage sans `--` dans le plan et dans l'en-tête du script, et le script ignore
désormais un `--` de tête (les deux formes marchent). Typecheck `@transpo/db` vert.
**Le correctif du script n'aura d'effet en prod qu'après déploiement** — cf. DEPL-01.

**DEPL-01 — La prod est en retard d'un correctif de sécurité.**
Prod = `761f2ad`, `main` = `1e0ac9c` (« Paywall : la suspension coupe les sessions en cours »).
Tant que ce n'est pas déployé, un utilisateur déjà connecté conserve l'accès jusqu'à 12 h après la
suspension de son organisation — c'est précisément AN-10. À déployer **avant** de reprendre les
sections F/G/L/S.
