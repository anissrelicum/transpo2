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

## Run du 13-14/09/2026 — section G (app livreur)

Environnement **local** (API sur l'hôte + PostgreSQL en conteneur + émulateur Android) : le
homelab K8s était éteint, ses trois nœuds injoignables et `transpo-api.wedowonders.com` en 530.
Détail, verdicts et constats : [qa/recette/2026-09-13-local/RAPPORT.md](qa/recette/2026-09-13-local/RAPPORT.md).

| Cas | Rôle testeur | Env. | Statut | Constat / réf | Date |
|---|---|---|---|---|---|
| TC-G01 → TC-G18 | Livreur | Local | **OK (18/18)** | Section complète, rejouable d'un seul lancement (`node recette/run.mjs`). Huit anomalies corrigées dans le run : **AN-28** (file de synchro injoignable dès le retour du réseau), **AN-29** (scanner branché sur des colis de démonstration), **AN-30** (colis récupéré annoncé « hors tournée »), **AN-31** (refus de scan effacé en 1,6 s), **AN-32** (règle EU 561 en double exemplaire), **AN-33** (profil livreur écrit en dur), **AN-34** (disponibilité qui ne quittait pas le téléphone), **AN-35** (aucun champ de saisie annonçable). Ouverts : **OBS-12**, **OBS-13**, **OBS-14**. | 13-14/09 |

**À refaire après rallumage du homelab :** redéployer et rejouer la section G telle quelle —
ce run valide le produit, pas le déploiement.

## Run du 14/09/2026 — sections H à T (consoles web)

Même environnement local. Harnais Playwright rendu jouable hors cluster (`PG_EXEC`), lanceur
`apps/e2e-web/lancer-recette-locale.sh`. Détail : le même
[RAPPORT.md](qa/recette/2026-09-13-local/RAPPORT.md).

| Cas | Rôle testeur | Env. | Statut | Constat / réf | Date |
|---|---|---|---|---|---|
| TC-H01 → TC-H05 | Admin / comptable | Local | **OK** | Tri en hub de bout en bout. **AN-36 corrigée** : le scan d'entrée sautait la colonne « Arrivés — à scanner », qui ne pouvait donc jamais se remplir. Ouvert : **AN-37** (sceller un bordereau ne laisse aucune trace). | 14/09 |
| TC-J01, TC-J03, TC-J04 | Admin | Local | **OK** | Positions réelles du terrain au PC flotte, alerte de sortie de géofence, raccourcis. | 14/09 |
| TC-M01 → TC-M03 | Admin | Local | **OK** | Grille persistée, devis conforme à la cascade, export CSV. **AN-39 corrigée** (libellés reliés aux champs). **OBS-15** : le simulateur affiche un prix remisé par défaut. | 14/09 |
| TC-N01, TC-N04 | Marchand | Local | **OK** | Portail borné au marchand, console transport et API d'exploitation fermées (403). | 14/09 |
| TC-O01, TC-O03 | Anonyme | Local | **OK** | Suivi public sans fuite (ni téléphone, ni adresse, ni livreur), notation unique. | 14/09 |
| TC-P01, TC-P04, TC-P05 | Admin | Local | **OK** | Journal, consentement 09-08 opposable, modèles et substitution des variables. | 14/09 |
| TC-R01, TC-R02 | Admin | Local | **OK** | Tableau de bord et analytique conformes à la base. | 14/09 |
| TC-S02, TC-S05, TC-S07 | Admin / super-admin | Local | **OK** | En-tête de tenant sans effet sur le jeton, journal d'audit complet, session perdue → login. | 14/09 |
| TC-T03, TC-T04, TC-T05 | Admin | Local | **OK** | Aucun débordement à 1024/768 px, 21 pages d'un tenant neuf sans écran blanc ni erreur JS, statuts cohérents. | 14/09 |

**Corrigé côté produit pendant ces sections :** caisse alimentée par les encaissements du
terrain et déclaration du livreur (la chaîne du COD s'arrêtait au théorique), moteur de fraude
branché sur deux signaux réels (aucun cas n'était jamais créé), notifications déclenchées par
les événements de course (le journal ne contenait que les envois manuels), tournée du dispatch
enfin visible par le livreur, garde-fous sur les retours clos et les tournées clôturées.


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
