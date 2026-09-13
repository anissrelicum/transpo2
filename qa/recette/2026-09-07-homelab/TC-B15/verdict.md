# TC-B15 — RBAC console (matrice ADMIN / DISPATCHER / COMPTABLE)

- **Attendu** : toute action interdite **absente ou désactivée dans l'UI** ET **refusée par l'API (403)**.
- **Obtenu** : matrice respectée côté API pour toutes les écritures ; 3 écarts dont 2 bogues produit.

## ADMIN (captures 01)
- UI : `Nouvelle commande`, `Inviter`, `Ajouter un chauffeur`, `Enregistrer` (tarification) présents.
- API : GET users / cash/sessions / fraud/cases / notifications → 200. Conforme.

## DISPATCHER (captures 02–07)
- UI : commandes en écriture (02) ; `/users` sans Inviter ni menus de ligne (03) ; `/drivers` sans ajout (04) ; `/settings` en lecture seule (06) ; `/fraud` refusé (redirection `/login`, 07).
- API : POST users / drivers / vehicles / settings/company / pricing/config / fraud confirm → **403** ; GET cash/sessions → **403** ; GET tournees / analytics/summary / reviews → **200**. Conforme.
- **Écarts** : BUG-B2 (bouton Enregistrer tarification actif, capture 05), BUG-B3 (POST /orders `{}` → 500).

## COMPTABLE (captures 08–12)
- UI : `/orders` en lecture seule sans `Nouvelle commande` (08) ; `/orders/new` redirigé vers `/orders` (09) ; `/users` et `/drivers` sans actions ; `/settings` en lecture seule ; `/cash` (11) et `/invoices` accessibles.
- API : POST orders / users / drivers / settings/company / pricing/config / fraud clear / notifications/send → **403** ; GET cash/sessions / invoices / analytics/summary / reviews → **200**. Conforme.
- **Écarts** : BUG-B2 (Enregistrer tarification actif, capture 10) ; BUG-B4 (journal notifications inaccessible : UI → `/login` (12), API GET → 403, alors que la matrice donne « journal seul » au comptable).

## Bogues consignés
- **BUG-B2 (mineur, UI/RBAC)** : `/pricing` — le bouton **Enregistrer** (et les contrôles d'édition : + Palier, suppression, champs) restent actifs pour DISPATCHER et COMPTABLE. L'API refuse bien l'écriture (403 vérifié), mais l'ATT exige l'action absente ou désactivée dans l'UI.
- **BUG-B3 (mineur, robustesse API)** : `POST /v1/orders` avec corps `{}` → **500** (`null value in column "from_city" violates not-null constraint`, `orders.service.ts:62`) au lieu d'un 400 de validation. Sans impact RBAC (l'appel passe le garde car le dispatcher peut créer) mais fuite une erreur SQL brute.
- **BUG-B4 (fonctionnel, matrice)** : le comptable n'a **aucun** accès au journal des notifications (UI redirigée vers `/login`, API 403), contrairement à la matrice « Notifications : ❌ (journal seul) ».

- **Captures** : `01`–`07` (admin + dispatcher), `08`–`12` (comptable)
- **Verdict** : **KO** (partiel, non bloquant — enforcement API intégral ; écarts UI/robustesse/lecture journal)

## Retest 08/09 — BUG-B2 / BUG-B3 / BUG-B4 (correctifs déployés)

- **BUG-B2 (pricing RBAC UI) : CORRIGÉ.** DISPATCHER et COMPTABLE sur `/pricing` : bouton **Enregistrer** absent (0 occurrence), « + Palier » absent, corbeilles absentes, tous les champs de la grille et suppléments désactivés (`retest-{dispatcher,comptable}-pricing-lecture-seule.png`). Simulateur fonctionnel (curseur → « Distance : 11 km », total TTC recalculé) et **export CSV** `grille-tarifaire.csv` téléchargé pour les deux rôles (`retest-*-pricing-simulateur.png`). ADMIN : Enregistrer + « + Palier » présents, champs actifs (`retest-admin-pricing-edition.png`). Correctif : `pricing/page.tsx` passe `canEdit` (rôle cookie) à `PricingView`, qui conditionne tous les contrôles d'édition.
- **BUG-B3 (POST /orders {} → 500) : CORRIGÉ.** `curl -X POST /v1/orders -d '{}'` avec token DISPATCHER → **400** `{"message":"Champs requis manquants : fromCity, toCity.","error":"Bad Request"}` — plus de 500 SQL (preuve : `retest-b3-curl.txt` ; validation en amont dans `orders.service.ts`). NB : sans header `x-tenant-slug`, l'API répond 403 « Incohérence de tenant. » (comportement nominal du TenantGuard).
- **BUG-B4 (journal notifications comptable) : CORRIGÉ.** COMPTABLE : UI `/notifications` accessible (plus de redirection `/login`), « Centre de notifications » affiché en lecture — aucune action d'écriture visible (0 bouton Envoyer/Consentement, 0 menu de ligne, `retest-comptable-notifications.png`). API : `GET /v1/notifications` → **200** ; `POST /send` et `POST /consent` → **403**. Rôle DRIVER : non testable, aucun compte livreur sur rabatexpress (table `drivers` vide) — les rôles console existants (ADMIN/DISPATCHER/COMPTABLE) ont tous la lecture, les écritures restent réservées ADMIN/DISPATCHER (`notifications.controller.ts` : `@Roles('ADMIN','DISPATCHER')` de classe, `GET` élargi au COMPTABLE).
- **Verdict retest** : **OK** — les 3 écarts du 08/09 sont corrigés ; TC-B15 passe de « KO (partiel) » à **OK**.
