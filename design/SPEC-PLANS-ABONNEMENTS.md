# Spécification — Plans, abonnements et facturation plateforme

**Statut :** validée. **Lot L1 (socle) implémenté** — catalogue en base, versions de tarif,
paliers, moteur de calcul testé, écran `/saas/plans`. L2 (abonnement) et L3 (facturation) à venir.
**Périmètre :** console plateforme (`/saas`) uniquement. Ne touche ni la tarification transporteur
(`/pricing`), ni la facturation marchand (`/invoices`) — deux sujets distincts qui gardent leur code.

---

## 1. Pourquoi cette spec

L'existant modélise le plan comme un **attribut texte du tenant**. Cinq conséquences, toutes vérifiables :

| # | Constat | Où |
|---|---|---|
| 1 | Catalogue en dur dans un tableau TypeScript : créer ou re-tarifer un plan exige un redéploiement. | `packages/domain/src/index.ts:157` |
| 2 | `tenants.plan` est du texte libre pointant le plan par son libellé — aucune intégrité référentielle. | `packages/db/src/schema/platform.ts:11` |
| 3 | **Aucune dimension temporelle** : ni début, ni échéance, ni historique. `changePlan` écrase la valeur. L'« Essai (14 j) » n'expire jamais, `SUSPENDU` est purement manuel, et on ne peut pas répondre à « quel plan était actif en juillet ? ». | `apps/api/src/saas/saas.service.ts:48` |
| 4 | L'usage compte **toutes les commandes depuis la création** du tenant, pas celles de la période : `overQuota` devient vrai définitivement. | `apps/api/src/saas/saas.service.ts:86` |
| 5 | Aucune facture plateforme persistée : la page recalcule à la volée, rien n'est émis ni payé ni archivé. | `apps/api/src/saas/saas.service.ts:74` |

La correction n'est pas « ajouter un CRUD de plans ». Il manque l'entité **Abonnement** : le plan doit
cesser d'être une propriété du tenant pour devenir une **relation datée** entre un tenant et une
**version de tarif**.

---

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Modes de facturation | **Deux modes coexistants** : `USAGE` (pay-as-you-go, prix unitaire dégressif par volume) et `FORFAIT` (mensuel fixe). Le mode est porté par le plan. |
| Cycle de vie | Essai **14 jours** daté qui expire seul, puis **mensuel à reconduction tacite**. Échéance impayée → suspension automatique après délai de grâce. |
| Encaissement | **Hors ligne** (virement/chèque). La plateforme émet la facture, le super-admin la marque payée avec méthode et référence. Aucune passerelle externe. |
| Évolution des prix | **Prix gelé à la souscription.** L'abonnement pointe une version de tarif figée ; changer le tarif du catalogue n'affecte aucun abonné existant. |

---

## 3. Vocabulaire (langue ubiquitaire)

| Terme | Définition | Ce que ce n'est pas |
|---|---|---|
| **Plan** | Offre commerciale d'identité stable : `Transporteur`. Porte un code, un libellé bilingue, un ordre d'affichage, un état (actif/archivé). **Ne porte aucun prix.** | Pas un tarif |
| **Version de tarif** | Le prix d'un plan à une date donnée. Un plan a 1..n versions ; une seule est courante. Tout le pricing vit ici. | Pas une offre distincte |
| **Abonnement** | Rattachement d'un **tenant** à une **version de tarif** sur une période, avec son propre statut. Un tenant a au plus un abonnement courant. | Pas une facture |
| **Période** | Mois civil consommé (`2026-08`). Unité d'assiette et de facturation. | |
| **Facture plateforme** | Document figé émis pour un couple (abonnement, période). Immuable une fois émise. | Pas la facture marchand de `/invoices` |
| **Assiette** | Nombre de commandes retenues pour le calcul sur la période. | Pas le total des commandes du tenant |

> **Séparer Plan et Version de tarif est le pivot de la spec.** C'est ce qui permet à la fois de
> re-tarifer sans redéployer (§1.1) et de geler le prix des abonnés existants (§2), sans contradiction.

---

## 4. Modèle de données

Cinq tables dans le schéma `platform`. DDL indicatif, à porter dans `packages/db/src/schema/platform.ts`.

### 4.1 `platform.plans` — catalogue

```sql
CREATE TABLE platform.plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,         -- 'transporteur' — stable, jamais réutilisé
  label_fr      text NOT NULL,
  label_ar      text NOT NULL,
  description   text,
  sort_order    integer NOT NULL DEFAULT 0,
  archived_at   timestamptz,                  -- archivé = plus souscriptible, abonnés conservés
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### 4.2 `platform.plan_versions` — tarif daté

```sql
CREATE TABLE platform.plan_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           uuid NOT NULL REFERENCES platform.plans(id),
  version           integer NOT NULL,              -- 1, 2, 3… incrémental par plan
  billing_mode      text NOT NULL,                 -- 'FORFAIT' | 'USAGE'
  -- FORFAIT
  monthly_centimes  integer NOT NULL DEFAULT 0,    -- abonnement mensuel
  included_orders   integer,                       -- NULL = illimité
  overage_centimes  integer,                       -- prix/commande au-delà ; NULL = non facturé
  -- USAGE
  base_centimes     integer NOT NULL DEFAULT 0,    -- part fixe éventuelle (souvent 0)
  tier_mode         text NOT NULL DEFAULT 'VOLUME',-- 'VOLUME' | 'GRADUE' (cf. §6.2)
  min_centimes      integer NOT NULL DEFAULT 0,    -- facture plancher mensuelle
  -- commun
  effective_from    date NOT NULL,                 -- date d'entrée au catalogue
  effective_to      date,                          -- NULL = version courante
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version)
);
```

### 4.3 `platform.plan_tiers` — paliers de volume (mode `USAGE`)

```sql
CREATE TABLE platform.plan_tiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id  uuid NOT NULL REFERENCES platform.plan_versions(id) ON DELETE CASCADE,
  from_qty         integer NOT NULL,   -- borne basse incluse
  to_qty           integer,            -- borne haute incluse ; NULL = infini
  unit_centimes    integer NOT NULL,
  UNIQUE (plan_version_id, from_qty)
);
```

**Invariants** (validés à l'écriture, testés unitairement) : le premier palier commence à 1 ; les
paliers sont contigus et sans recouvrement ; exactement un palier a `to_qty IS NULL`.

### 4.4 `platform.subscriptions` — abonnement du tenant

```sql
CREATE TABLE platform.subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES platform.tenants(id),
  plan_version_id  uuid NOT NULL REFERENCES platform.plan_versions(id), -- prix GELÉ ici
  status           text NOT NULL,        -- ESSAI | ACTIF | IMPAYE | SUSPENDU | RESILIE
  started_at       date NOT NULL,
  trial_ends_at    date,                 -- renseigné si statut ESSAI
  current_period   text NOT NULL,        -- 'YYYY-MM' en cours
  renews_at        date,                 -- prochaine échéance ; NULL si RESILIE
  ended_at         date,                 -- résiliation effective
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ON platform.subscriptions (tenant_id) WHERE ended_at IS NULL;
```

L'index partiel garantit **un seul abonnement courant par tenant** au niveau base, pas seulement
applicatif.

### 4.5 `platform.platform_invoices` — facture émise

```sql
CREATE TABLE platform.platform_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid NOT NULL REFERENCES platform.subscriptions(id),
  tenant_id        uuid NOT NULL REFERENCES platform.tenants(id),
  period           text NOT NULL,          -- 'YYYY-MM'
  number           text NOT NULL UNIQUE,   -- 'PF-2026-08-0001'
  status           text NOT NULL,          -- EMISE | PAYEE | ANNULEE
  billable_orders  integer NOT NULL,       -- assiette retenue
  lines            jsonb NOT NULL,         -- détail figé (cf. §6.3)
  subtotal_centimes integer NOT NULL,
  vat_rate         integer NOT NULL,       -- en % au moment de l'émission
  vat_centimes     integer NOT NULL,
  total_centimes   integer NOT NULL,
  due_date         date NOT NULL,
  paid_at          timestamptz,
  paid_method      text,                   -- VIREMENT | CHEQUE | ESPECES
  paid_ref         text,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period)         -- idempotence de la génération
);
```

La contrainte `UNIQUE (subscription_id, period)` **est** le mécanisme d'idempotence : relancer la
génération d'une période ne produit jamais de doublon, sans table de verrou.

### 4.6 Décision : montants en centimes

Le reste du dépôt stocke les montants en **dirhams entiers** (`orders.cod: integer`,
`pricing.fragile_surcharge: 15`). Le pay-as-you-go impose des prix unitaires inférieurs au dirham
(4,50 DH/commande) — l'entier en DH est donc inutilisable ici.

**Décision :** les tables `platform.*` de cette spec stockent en **centimes**, avec le suffixe
`_centimes` sur **chaque** colonne monétaire pour rendre la divergence lisible à la lecture. Aucune
autre table n'est convertie. La conversion se fait à la frontière API (`money()` côté affichage).
Motif : un flottant sur des montants facturés est un défaut de conception ; l'entier en DH ne couvre
pas le besoin. À consigner en ADR.

---

## 5. Machine à états

### 5.1 Abonnement

```
                    ┌──────────── résiliation ────────────┐
                    │                                     ▼
 [création tenant] ──► ESSAI ──(souscription)──► ACTIF ──► RESILIE
                        │                        ▲  │        ▲
             (J+14 sans │                        │  │        │
              souscription)                paiement│  │échéance│
                        │                        │  │ impayée │
                        ▼                        │  ▼        │
                     IMPAYE ◄────────────────────┘  IMPAYE   │
                        │                                    │
              (grâce 7 j écoulés)                            │
                        ▼                                    │
                    SUSPENDU ──────(paiement régularisé)─────┘
                                            └──► ACTIF
```

| Transition | Déclencheur | Effet |
|---|---|---|
| → `ESSAI` | Provisioning du tenant | `trial_ends_at = J+14`, aucune facture |
| `ESSAI` → `ACTIF` | Souscription à une version de tarif | Première période ouverte |
| `ESSAI` → `IMPAYE` | `trial_ends_at` dépassé, pas de souscription | Tenant encore accessible |
| `ACTIF` → `IMPAYE` | Facture échue non payée à `due_date` | Bandeau d'alerte dans la console tenant |
| `IMPAYE` → `SUSPENDU` | `due_date + 7 j` sans paiement | **Login du tenant bloqué** |
| `IMPAYE`/`SUSPENDU` → `ACTIF` | Facture marquée payée | Accès rétabli immédiatement |
| toute → `RESILIE` | Action super-admin | `ended_at` posé ; aucune facture ultérieure |

### 5.2 Articulation avec `tenants.status`

`tenants.status` (`ESSAI`/`ACTIF`/`SUSPENDU`) **reste en place** : c'est lui que lit le paywall du
login (`apps/api/src/auth/auth.service.ts`). Il devient une **projection dénormalisée** de
`subscriptions.status`, écrite **exclusivement** par le moteur d'abonnement — jamais à la main.

Conséquence UI : les actions **Activer** / **Repasser en essai** / **Suspendre** de `/saas`
disparaissent en tant que boutons d'écriture directe. Elles sont remplacées par des actions
d'abonnement (souscrire, marquer payé, résilier, suspendre manuellement avec motif). **Impact sur la
recette : TC-A09 et TC-B05 du `PLAN-TEST-MANUEL.md` sont à réécrire.**

Correspondance : `IMPAYE` → `tenants.status = 'ACTIF'` (le client travaille encore, il est relancé) ;
`SUSPENDU` et `RESILIE` → `'SUSPENDU'`.

---

## 6. Moteur de calcul

### 6.1 Assiette — ce qu'on compte

**Règle :** commandes **créées** dans la période, **hors** commandes annulées avant assignation.

Motif : facturer à la commande livrée rendrait le revenu dépendant de la performance du transporteur,
que la plateforme ne contrôle pas ; facturer toute commande créée sanctionnerait les saisies erronées
corrigées immédiatement. La règle retenue est celle qui reflète l'usage réel de la plateforme.

Requête, exécutée dans le schéma du tenant :

```sql
SELECT count(*) FROM orders
WHERE created_at >= :period_start AND created_at < :period_end
  AND NOT (status = 'ANNULEE' AND driver IS NULL);
```

### 6.2 Mode `USAGE` — paliers dégressifs

`tier_mode` détermine la lecture de la grille. **Exemple commun** : 1–100 → 6,00 DH ;
101–500 → 4,50 DH ; 501+ → 3,00 DH. Assiette = **600 commandes**.

| Mode | Lecture | Calcul | Total |
|---|---|---|---|
| **`VOLUME`** (rétroactif) | Le volume atteint fixe **un seul** prix, appliqué à **toutes** les commandes | 600 × 3,00 | **1 800 DH** |
| **`GRADUE`** (marginal) | Chaque tranche est facturée à son propre prix | (100 × 6,00) + (400 × 4,50) + (100 × 3,00) | **2 700 DH** |

L'écart est de 50 % sur le même volume et la même grille : le mode doit être choisi par plan, pas
subi. `VOLUME` est le défaut — c'est celui qui s'explique en une phrase au client (« à partir de 500
commandes, tout votre mois est à 3 DH »). `GRADUE` protège la marge sur les gros volumes.

Le total est ensuite plafonné par le bas : `max(total, min_centimes)`, puis `+ base_centimes`.

### 6.3 Mode `FORFAIT`

```
total = monthly_centimes
      + (included_orders IS NULL OR overage_centimes IS NULL
           ? 0
           : max(0, assiette - included_orders) × overage_centimes)
```

Un plan forfait avec `overage_centimes = NULL` **n'est jamais bloquant** : le dépassement est affiché
au super-admin, pas facturé, pas coupé.

### 6.4 Lignes de facture

`lines` est un `jsonb` **figé à l'émission**, jamais recalculé — c'est ce qui rend une facture passée
opposable même après re-tarification du catalogue :

```json
[
  { "label": "Abonnement Transporteur — 2026-08", "qty": 1, "unit_centimes": 89900, "total_centimes": 89900 },
  { "label": "Commandes au-delà du quota (5000)", "qty": 240, "unit_centimes": 150, "total_centimes": 36000 }
]
```

### 6.5 Arrondis

Tout le calcul se fait en centimes entiers. Un seul arrondi, **au moment du produit**
`qty × unit_centimes`, à l'entier le plus proche. La TVA est appliquée **sur le sous-total**, jamais
ligne à ligne — sinon les totaux divergent d'un centime selon l'ordre des lignes.

---

## 7. Automatisation du temps

Rien ne doit dépendre d'un humain qui clique. Un point d'entrée unique, **idempotent** :

```
POST /v1/saas/cycle/run   (SUPER_ADMIN ou clé de service)
```

Il exécute, dans l'ordre : expiration des essais → clôture des périodes échues et émission des
factures → passage en `IMPAYE` des factures échues → suspension après grâce → projection de
`tenants.status`.

**Appel :** cron Dokku quotidien (`dokku cron:add`), pas de planificateur embarqué dans NestJS.
Motif : le job reste **déclenchable et rejouable à la main** pendant la recette — condition pour
qu'il soit testable dans `PLAN-TEST-MANUEL.md` sans attendre 14 jours.

L'idempotence repose sur `UNIQUE (subscription_id, period)` (§4.5) et sur des transitions d'état
conditionnées à la date : deux exécutions le même jour produisent le même résultat.

---

## 8. Contrats d'API

Toutes les routes sous `/v1/saas`, **réservées `SUPER_ADMIN`**, toutes tracées au journal d'audit.

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/plans?include=archived` | Catalogue avec version courante |
| `POST` | `/plans` | Créer un plan (code, libellés FR/AR) |
| `PATCH` | `/plans/:code` | Libellés, ordre, description |
| `POST` | `/plans/:code/archive` | Archiver (refusé si abonnements actifs et `force` absent) |
| `GET` | `/plans/:code/versions` | Historique des tarifs |
| `POST` | `/plans/:code/versions` | **Nouvelle version de tarif** (mode, montants, paliers, date d'effet) |
| `GET` | `/tenants/:slug/subscription` | Abonnement courant + historique |
| `POST` | `/tenants/:slug/subscription` | Souscrire / changer de plan (`{ planCode, effectiveAt }`) |
| `POST` | `/tenants/:slug/subscription/cancel` | Résilier (`{ reason, effectiveAt }`) |
| `GET` | `/invoices?period=&status=&tenant=` | Factures plateforme |
| `POST` | `/invoices/generate` | Émettre pour une période (idempotent) |
| `POST` | `/invoices/:id/pay` | Marquer payée (`{ method, ref, paidAt }`) |
| `POST` | `/invoices/:id/cancel` | Annuler (avec motif, tracé) |
| `POST` | `/cycle/run` | Job d'avancement (§7) |

**Règles d'erreur** — chaque cas ci-dessous doit avoir son test :

| Cas | Réponse |
|---|---|
| Code de plan déjà pris | `409 Plan déjà existant : <code>` |
| Paliers non contigus / recouvrants | `400` avec le rang du palier fautif |
| Version de tarif antidatée sous une facture émise | `400 Période déjà facturée` |
| Archivage d'un plan avec abonnés actifs | `409` + décompte des abonnés |
| Souscription d'un tenant déjà abonné | `409 Abonnement courant existant` |
| Paiement d'une facture déjà payée | `409` |

---

## 9. Écrans (console plateforme)

### 9.1 `/saas/plans` — devient un vrai CRUD

- Liste : plan, mode, tarif courant, nb d'abonnés, état. Bouton **Nouveau plan**.
- Fiche plan, 3 onglets :
  - **Tarif courant** — mode (`FORFAIT`/`USAGE`), montants, **éditeur de paliers** (lignes De/À/Prix unitaire, avec contrôle de contiguïté en direct) ;
  - **Historique des versions** — chaque version avec sa fenêtre de validité et le nb d'abonnés qui y sont gelés ;
  - **Abonnés** — tenants rattachés, avec leur version.
- Actions : **Nouvelle version de tarif** (dialogue avec date d'effet), **Archiver**.
- **Simulateur** dans la fiche : saisir un volume mensuel → total calculé selon la grille. Même
  principe que le *Simulateur de devis* de `/pricing` ; c'est l'outil qui rend le choix
  `VOLUME`/`GRADUE` tangible pour le commercial (§6.2).

### 9.2 `/saas/billing` — factures réelles

Sélecteur de **période**, bouton **Générer les factures**, tableau (tenant, plan, assiette, total,
échéance, statut), actions **Marquer payée** (méthode + référence) et **Annuler**, **Export CSV**.

> Réutiliser le vocabulaire d'actions déjà en place sur `/invoices` de la console transport
> (*Générer les factures*, *Marquer payée*, *Export CSV*) : même geste, même mot.

### 9.3 `/saas` — bloc Abonnement sur la ligne tenant

Plan, statut, échéance, **jours d'essai restants**, dernière facture. Actions : **Souscrire / Changer
de plan**, **Résilier**, **Suspendre** (manuel, avec motif). Les boutons *Activer* / *Repasser en
essai* actuels disparaissent (§5.2).

---

## 10. Migration depuis l'existant

Script `packages/db/src/migrate-plans.ts`, rejouable :

1. Créer les 5 tables.
2. Insérer les 4 plans actuels (`Essai`, `TPE Coursier`, `Transporteur`, `Entreprise`) avec, pour
   chacun, une **version 1** en mode `FORFAIT` reprenant `monthlyDH` et `maxOrdersMonth` de
   `SAAS_PLANS` (`packages/domain/src/index.ts:157`), `overage_centimes = NULL` (dépassement non
   facturé — comportement actuel préservé), `effective_from = date de migration`.
3. Pour chaque ligne de `platform.tenants` : créer un abonnement pointant la version 1 du plan
   correspondant à `tenants.plan`, `started_at = tenants.created_at`, `status` dérivé de
   `tenants.status`.
4. **Piège à éviter :** les tenants au plan `Essai` ont une `created_at` souvent vieille de plusieurs
   semaines. Recalculer `trial_ends_at = created_at + 14 j` les suspendrait **tous** au premier
   passage du cron. Règle de migration : `trial_ends_at = date_de_migration + 14 j`.
5. Conserver `tenants.plan` comme colonne de projection (écrite par le moteur) : le paywall du login
   et les écrans existants continuent de fonctionner sans réécriture.
6. `SAAS_PLANS` et `planByCode()` restent dans `@transpo/domain` **le temps de la migration**, puis
   sont supprimés. Les **types** (`SaasPlan`, `TenantStatus`) et les nouveaux enums
   (`BILLING_MODES`, `TIER_MODES`, `SUBSCRIPTION_STATUSES`) restent dans le domaine — c'est la source
   unique partagée API/web.

---

## 11. Ce qu'il faut tester

À ajouter au `PLAN-TEST-MANUEL.md`, section A (et TC-A08/A09/A11 + TC-B05 à réécrire, §5.2) :

| Cas | Objet |
|---|---|
| TC-A13 | Créer un plan `USAGE` avec 3 paliers ; vérifier le refus des paliers non contigus |
| TC-A14 | Simulateur : 600 commandes → 1 800 DH en `VOLUME`, 2 700 DH en `GRADUE` (§6.2) |
| TC-A15 | Créer une v2 de tarif ; vérifier que l'abonné existant **garde le prix v1** |
| TC-A16 | Archiver un plan avec abonnés → refus ; sans abonné → sorti du sélecteur de souscription |
| TC-A17 | Essai : forcer `trial_ends_at` au passé, lancer `/cycle/run` → `IMPAYE` |
| TC-A18 | Grâce écoulée → `SUSPENDU` **et** login du tenant bloqué |
| TC-A19 | Générer les factures deux fois sur la même période → **aucun doublon** |
| TC-A20 | Marquer payée → tenant réactivé, login rétabli |
| TC-A21 | Assiette : créer 5 commandes dont 1 annulée non assignée → assiette = 4 (§6.1) |
| TC-A22 | Facture émise puis re-tarification du plan → **le total de la facture ne bouge pas** |

Tests unitaires prioritaires (sans base) : le moteur de calcul §6.2/6.3 (paliers, plancher, arrondis)
et les invariants de grille §4.3. Ce sont les seuls endroits où un bug coûte de l'argent réel.

---

## 12. Lotissement proposé

| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| **L1 — Socle** | 5 tables, migration §10, enums domaine, CRUD catalogue + versions + paliers, écran `/saas/plans` | On crée un plan et une version de tarif sans redéployer |
| **L2 — Abonnement** | Entité abonnement, machine à états §5, projection `tenants.status`, `/cycle/run`, cron | Un essai expire seul et suspend le tenant |
| **L3 — Facturation** | Moteur §6, factures, paiement hors ligne, `/saas/billing`, export CSV | Une facture est émise, payée, et réactive le tenant |
| **L4 — Finition** | Simulateur, historique par tenant, relances d'échéance, écran d'alerte côté tenant | |

**L1 et L2 ne se découpent pas plus finement** : livrer le catalogue sans l'abonnement laisserait
`tenants.plan` en texte libre et n'aurait corrigé aucun des cinq constats du §1.

Hors périmètre, à trancher plus tard : proration lors d'un changement de plan en cours de mois
(défaut retenu : **effet à la prochaine échéance**), plans annuels, paiement en ligne.

---

## 13. Décisions complémentaires actées

| # | Sujet | Décision | Porté par |
|---|---|---|---|
| 1 | Mode de palier par défaut | `VOLUME` — explicable en une phrase au client (§6.2) | `plan_versions.tier_mode` défaut `'VOLUME'` |
| 2 | Un plan `FORFAIT` bloque-t-il à l'épuisement du quota ? | **Non.** Jamais couper l'exploitation d'un transporteur en journée : `overage_centimes`, ou rien | `computeBilling`, mode `FORFAIT` |
| 3 | TVA plateforme | 20 %, figée **sur la facture** à l'émission | `DEFAULT_VAT_RATE`, `platform_invoices.vat_rate` |
| 4 | Délai de grâce avant suspension | 7 jours après `due_date` | `GRACE_DAYS` |
| 5 | Numérotation des factures | `PF-YYYY-MM-NNNN`, séquence par période | L3 |

---

## 14. État d'avancement

| Lot | Statut | Éléments livrés |
|---|---|---|
| **L1 — Socle** | ✅ **livré** | `migrations/platform/0002_plans.sql` (5 tables) · enums + `validateTiers` + `computeBilling` + `applyVat` dans `@transpo/domain` (24 tests) · `packages/db/src/migrate-plans.ts` · `PlansService`/`PlansController` (7 routes) · `SaasPlansView` + éditeur de paliers + simulateur |
| **L2 — Abonnement** | à faire | Machine à états §5, projection `tenants.status`, `/cycle/run`, cron Dokku |
| **L3 — Facturation** | à faire | Assiette §6.1, émission, paiement hors ligne, `/saas/billing` |
| **L4 — Finition** | à faire | Historique par tenant, relances d'échéance, alerte côté tenant |

**Écarts assumés au lotissement en L1** — deux éléments prévus plus tard ont été tirés en avant,
parce qu'ils étaient peu coûteux et qu'ils dérisquent une décision commerciale :

- `computeBilling` (prévu L3) : fonction pure, écrite et testée dès maintenant.
- Le **simulateur** (prévu L4) : sans lui, le choix `VOLUME`/`GRADUE` reste abstrait au moment
  même où l'on publie un tarif.

**Restes à faire connus sur le périmètre L1**, à traiter en L2 :

- `saas.service.billing()` compte toujours **toutes** les commandes depuis la création du tenant
  (constat §1.4) : la correction dépend de la règle d'assiette §6.1, donc de L3.
- Le provisioning force encore `status: ESSAI` sur comparaison littérale du libellé `'Essai'`
  (`saas.controller.ts`) : disparaît quand l'abonnement pilote le statut.
- `tenants.plan` reste un libellé libre rapproché par `label_fr` — renommer un plan depuis
  `/saas/plans` désaligne les tenants existants tant que L2 n'a pas posé la clé étrangère.
