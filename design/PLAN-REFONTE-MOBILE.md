# Plan de refonte — App mobile Livreur (Lot 3)

Document de lotissement produit par le tech lead. Source de vérité fonctionnelle : `PRD-Lot3-App-Livreur.md`. Source de vérité visuelle : `design/lot3-app-livreur.jsx` (maquette, 1897 lignes, 38 composants) + `design/lib-design-system.md`. Existant fonctionnel à préserver : `apps/driver-app/` (validé en production).

**Ne pas coder ce plan — il sert à cadrer 4 agents écrans qui coderont ensuite.**

---

## 0. Fondations (agent « socle ») — dépendance de tous les lots

Les 4 lots ci-dessous importent, sans jamais les modifier, les livrables de l'agent socle :

- `apps/driver-app/app/_layout.tsx` (racine, Stack) + `apps/driver-app/app/(tabs)/_layout.tsx` (Tabs — Missions/Tournée/Scanner/Shift/Profil, 64px, actif `indigo-11`/inactif `gray-9`, masqué sur les écrans de flux).
- Primitives `PhoneShell`, `BottomAction`, `PrimaryBtn` (52px, pleine largeur), `ScreenHead` (retour 44×44 + titre + sous-titre), équivalents RN des primitives de `lib-design-system.md`.
- Le pont `@transpo/design-tokens` / `@transpo/i18n` → RN (ni l'un ni l'autre n'est aujourd'hui dans `apps/driver-app/package.json` — à ajouter côté socle) et le thème clair/sombre.
- Le support RTL (arabe) au niveau shell.

Un message a été envoyé à l'agent socle pour figer les noms d'export exacts ; **les 4 lots doivent s'aligner sur sa réponse plutôt que sur les noms hypothétiques utilisés ci-dessous** (`(tabs)/missions.tsx` etc. — les chemins de route sont fiables, les noms d'import de primitives sont indicatifs).

Aucun lot ne touche : `lib/theme.ts` (probablement absorbé/étendu par socle), les fichiers `_layout.tsx`.

---

## 1. Inventaire des 22 (+2) écrans

`—` dans la colonne endpoint = **pas de backend** : donnée statique/démo assumée, à signaler visuellement (callout, badge « à venir »), jamais d'appel à un endpoint inexistant.

| # | Écran (maquette) | Route Expo Router | Onglet / flux | Endpoint API | Lot |
|---|---|---|---|---|---|
| 1 | Connexion | `app/index.tsx` | flux | `publicClient(tenant).login()` *(existe déjà)* | A |
| 1b | Autorisations (step interne à Connexion, pas une route) | dans `app/index.tsx` | flux | — (permissions device) | A |
| 2 | Missions du jour | `app/(tabs)/missions.tsx` | onglet **Missions** (défaut) | `getMissions()` → `GET /v1/driver/missions` | A |
| 3 | Notifications | `app/notifications.tsx` | flux (depuis missions) | — | A |
| 4 | Détail de mission | `app/mission/[ref]/index.tsx` | flux | dérivé de `getMissions()`, **pas de lat/lng dans `Order`** → pas de vraie carte | B |
| 5 | Contact client (bottom sheet) | composant partagé, pas une route | — | — (numéro masqué, appel/SMS simulés) | B |
| 6 | Mise à jour de statut | `app/mission/[ref]/status.tsx` | flux | `driverAdvance()` → `POST .../advance` (via outbox, kind `advance`) | B |
| 7 | Preuve de livraison | `app/mission/[ref]/proof.tsx` | flux | `driverProof()` → `POST .../proof` (via outbox, kind `proof`) | B |
| 8 | Encaissement COD | **fusionné dans `proof.tsx`** (2ᵉ étape interne, pas de route séparée — voir §3) | flux | même appel que #7 | B |
| 9 | Échec de livraison | `app/mission/[ref]/fail.tsx` | flux | — (aucun endpoint « marquer échec » côté API) | B |
| 10 | Confirmation de livraison | `app/mission/[ref]/done.tsx` | flux | — (écran local post-#7) | B |
| 11 | Ma tournée | `app/(tabs)/route.tsx` | onglet **Tournée** | dérivé de `getMissions()` ; algo plus-proche-voisin 100 % client ; **pas de lat/lng** → pas de vraie carte | C |
| 12 | Scanner de colis | `app/(tabs)/scan.tsx` | onglet **Scanner** | — (scan simulé, PRD §9.2) | C |
| 13 | Signalement d'incident | `app/incidents.tsx` *(existant, redesign)* | flux (depuis Profil) | `reportIncident()` / `getMyIncidents()` → `/v1/driver/incidents` | C |
| 14 | Shift & conduite (EU 561) | `app/(tabs)/shift.tsx` | onglet **Shift** | — (aucun endpoint shift/EU561 ; timer local persisté) | C |
| 15 | Support / chat dispatch | `app/support.tsx` *(existant, redesign)* | flux (depuis Profil) | `getSupportThread()` / `sendSupportMessage()` → `/v1/driver/support` | C |
| 16 | Profil | `app/(tabs)/profil.tsx` | onglet **Profil** | — (nom = session ; reste = démo, pas de `getDriverProfile`) | D |
| 17 | Historique & gains | `app/gains.tsx` *(existant, redesign)* | flux (depuis Profil) | `getDriverHistory()` → `/v1/driver/history` | D |
| 18 | Objectifs & primes | `app/objectives.tsx` | flux (depuis Profil) | — (`GOALS` statique) | D |
| 19 | Récap fin de journée | `app/recap.tsx` | flux (depuis Profil) | — (courses livrées dérivables de `getMissions()`/cache ; COD à déposer et gains du jour n'ont pas d'endpoint) | D |
| 20 | Mes documents | `app/docs.tsx` | flux (depuis Profil) | — | D |
| 21 | Paramètres | `app/settings.tsx` | flux (depuis Profil) | — (persistance locale via `lib/storage.ts`) | D |
| 22 | Aide / FAQ | `app/help.tsx` | flux (depuis Profil) | — (FAQ statique) | D |
| 23 | Hors-ligne / file de sync | `app/sync-queue.tsx` | flux (depuis bandeau missions) | — (expose l'état de `lib/outbox.ts`, aucun endpoint dédié) | A |
| 24 | Onboarding / recrutement | `app/onboarding.tsx` | flux (depuis Connexion, « Devenir livreur ») | — | A |
| 25 | Ma caisse | `app/macaisse.tsx` | flux (depuis Profil) | `getCashSessions()`/`depositCashSession()` **existent mais semblent scopés admin/dispatcher** (`/v1/cash/...`) — accès rôle DRIVER non confirmé. **Tant que non confirmé, traiter comme pas de backend** (démo, comme la maquette) | D |

**Liste blanche des appels API driver autorisés** (à vérifier par grep `authedClient()\.` dans chaque PR) : `getMissions`, `driverAdvance`, `driverProof`, `reportIncident`, `getMyIncidents`, `getSupportThread`, `sendSupportMessage`, `getDriverHistory`, `pushDriverPosition`. Tout autre appel doit être justifié explicitement ou signalé au tech lead — ne pas inventer d'endpoint.

**Divergence à corriger vs. la maquette** : `INCIDENT_TYPES` réel (`@transpo/domain`) = `ADRESSE, CLIENT_INJOIGNABLE, COLIS_ENDOMMAGE, VEHICULE, AUTRE` (5 valeurs, pas de champ gravité/SOS). La maquette a 6 types + gravité + bandeau urgence. Lot C garde l'esthétique (grille, bandeau rouge si pertinent) mais soumet un des 5 types réels — ne pas envoyer de champ `severity` inexistant côté API.

---

## 2. Lotissement — 4 agents, propriété exclusive des fichiers

Aucun fichier n'apparaît dans deux lots. Chaque lot importe les primitives de socle et les fonctions de `lib/*.ts` existantes ; aucun lot ne modifie `lib/*.ts`.

### Lot A — Identité, Missions, Notifications, Sync
Fichiers à créer/modifier (propriété exclusive) :
- `apps/driver-app/app/index.tsx` — **redesign + extension** : garder la logique de session (`restoreSession`, `setSession`, `publicClient().login()`) intacte, ajouter l'étape « Autorisations » (3 permissions, bouton principal désactivé tant que 3/3) comme *step interne* au même composant (pas une nouvelle route), à l'image du composant `Login` de la maquette.
- `apps/driver-app/app/(tabs)/missions.tsx` — **déplacer** `app/missions.tsx` ici et redesigner. Conserver strictement : `authedClient().getMissions()`, `useOutbox`, `applyPending`, `readJson/writeJson(CACHE_KEY)`, le bandeau hors-ligne. **Retirer** : la rangée de raccourcis vers Incidents/Support/Gains (déplacée dans Profil, lot D) et le bouton « Déconnexion » d'en-tête (la fonction `logout()`, avec sa garde sur la file en attente, **déménage telle quelle** vers `app/(tabs)/profil.tsx`, lot D — coordination à faire en PR review, pas de duplication de logique).
- `apps/driver-app/app/notifications.tsx` — nouveau, pas de backend.
- `apps/driver-app/app/onboarding.tsx` — nouveau, assistant 4 étapes, pas de backend, réutilise les statuts de documents du tableau `DOC_STATUS` de la maquette.
- `apps/driver-app/app/sync-queue.tsx` — nouveau, vue détaillée de la file `lib/outbox.ts` (liste horodatée, bouton « Forcer la synchronisation » = `sync()` du hook `useOutbox`), accessible en tapant le bandeau « hors ligne » de missions.

**Décision produit à documenter dans le code** : le Switch « partage de position » quitte `missions.tsx` et migre dans `shift.tsx` (lot C) — démarrer le shift active `useTracking`, le terminer le désactive. `settings.tsx` (lot D) n'affiche plus qu'un badge lecture seule de ce même état (persisté sous la clé `transpo.tracking.enabled`).

### Lot B — Détail mission, statut, preuve, COD, échec
Fichiers à créer (propriété exclusive) :
- `apps/driver-app/app/mission/[ref]/index.tsx` — détail (remplace l'actuel `app/mission/[ref].tsx`, **à supprimer en premier** puisqu'Expo Router n'autorise pas la coexistence fichier/dossier au même chemin). Carte statique/placeholder (pas de lat/lng réel dans `Order` — ne pas inventer de coordonnées), bloc retrait/livraison, bloc colis, bouton « Naviguer » → `status.tsx`.
- `apps/driver-app/app/mission/[ref]/status.tsx` — machine à états séquentielle (branche `!atDelivery` de l'actuel fichier). Appelle `submit('advance')` → `enqueue({kind:'advance', ...})` → `driverAdvance`, **identique à l'existant**. Bouton « Signaler un échec » → `fail.tsx`.
- `apps/driver-app/app/mission/[ref]/proof.tsx` — capture preuve **et** encaissement COD **dans le même écran, en deux étapes internes (state local)**, exactement comme le fait déjà la branche `atDelivery` de l'actuel fichier. **Ne pas séparer en deux routes** : `driverProof()` est un appel unique qui bundle `codCollected` + `photo` + `signature` avec un seul `idemKey` — scinder la route obligerait à faire transiter des data URI de plusieurs centaines de Ko par des query params, ce que l'app ne fait pas aujourd'hui et ne doit pas commencer à faire. Réutilise `capturePhoto` (`lib/proof.ts`), `<SignaturePad>` (`components/SignaturePad.tsx`, restylage léger de conteneur uniquement — ne pas toucher au `PanResponder`), `missingProof`/`proofRequirements` (`@transpo/domain`).
- `apps/driver-app/app/mission/[ref]/fail.tsx` — nouveau, formulaire de motif d'échec. **Pas de backend** : ne pas appeler `driverAdvance`/`driverProof` avec un statut ECHOUEE inventé. Recommandation : rediriger l'action de confirmation vers `reportIncident({type:'AUTRE', ref, note})` (seul endpoint réel proche) avec un libellé honnête, ou désactiver la soumission avec un callout « Signalement transmis au dispatch — traitement manuel » — trancher en review, ne pas simuler un succès silencieux.
- `apps/driver-app/app/mission/[ref]/done.tsx` — écran de succès (reprend la logique « commande introuvable = livrée » déjà présente en fin de l'actuel fichier).

Ce lot porte le risque de régression le plus élevé (seul lot qui touche à l'enchaînement outbox/idempotence) — cf. §4.

### Lot C — Tournée, Scanner, Shift, Incidents, Support
Fichiers :
- `apps/driver-app/app/(tabs)/route.tsx` — nouveau. Port de l'algorithme Haversine/plus-proche-voisin de la maquette (fonctions `haversine`, `routeDistance`, `nearestNeighbor` — à réimplémenter en TS pur, testable). **Pas de vraie carte** (pas de lat/lng par commande) : remplacer le `LeafletMap` de la maquette par une liste ordonnée + placeholder visuel, et l'écrire noir sur blanc dans un commentaire/callout in-app.
- `apps/driver-app/app/(tabs)/scan.tsx` — nouveau, simulation pure (pas de dépendance caméra native à ajouter — cf. PRD §9.2, hors périmètre v1). Reproduit la logique de la maquette (`SCAN_ITEMS`, codes reconnus/doublons/hors-tournée, saisie manuelle 8 caractères).
- `apps/driver-app/app/(tabs)/shift.tsx` — nouveau. Bouton démarrer/terminer le shift = source de vérité du Switch de tracking (cf. décision lot A). Minuteur de conduite 100 % local, persisté via `lib/storage.ts` (nouvelle clé, ex. `transpo.shift.v1`) pour survivre à un redémarrage — **ne pas** appeler d'endpoint shift inexistant. Règle à conserver : pause 45 min après 4h30 cumulées, alerte 30 min avant la limite journalière (9h).
- `apps/driver-app/app/incidents.tsx` — **redesign visuel uniquement**. Conserver `authedClient().reportIncident()`, `getMyIncidents()`, la liste `INCIDENT_TYPES` réelle (5 valeurs, pas 6 — cf. §1).
- `apps/driver-app/app/support.tsx` — **redesign visuel uniquement**. Conserver `getSupportThread()`, `sendSupportMessage()`, le `KeyboardAvoidingView` et le scroll-to-end.

### Lot D — Profil, Historique, Objectifs, Récap, Documents, Réglages, Aide, Caisse
Fichiers :
- `apps/driver-app/app/(tabs)/profil.tsx` — nouveau, hub de navigation (avatar, disponibilité, fiche véhicule/permis, boutons vers tous les écrans ci-dessous). **Reçoit** la fonction `logout()` déplacée depuis `missions.tsx` (lot A) — même garde sur la file en attente (`Alert` si `pending.length > 0`), même appel `clearOutbox()` + `clearSession()`.
- `apps/driver-app/app/gains.tsx` — **redesign visuel uniquement**. Conserver `getDriverHistory()`, le cache `readJson/writeJson(CACHE_KEY)`, l'affichage conditionnel freelance/salarié piloté par les champs réels de `DriverHistory` (pas de nouvelle logique de contrat inventée si l'API ne l'expose pas déjà — vérifier `DriverHistory` avant d'afficher un badge « Freelance »/« Salarié » ; sinon garder l'affichage générique actuel).
- `apps/driver-app/app/objectives.tsx` — nouveau, pas de backend (`GOALS` statique partagé, cf. `lib-design-system.md`).
- `apps/driver-app/app/recap.tsx` — nouveau. Les 4 stats + COD peuvent être calculées côté client à partir de `getMissions()`/cache pour ce qui est calculable (courses livrées du jour) ; le reste (distance, temps de conduite, gains estimés, cash à déposer) n'a pas d'endpoint — données de démo, signalées comme telles.
- `apps/driver-app/app/docs.tsx` — nouveau, pas de backend, liste statique de documents.
- `apps/driver-app/app/settings.tsx` — nouveau. Notifications/langue/thème persistés localement (`lib/storage.ts`). Le partage de position est en **lecture seule** ici (cf. décision lot A/C).
- `apps/driver-app/app/help.tsx` — nouveau, FAQ statique + recherche locale.
- `apps/driver-app/app/macaisse.tsx` — nouveau. Ne pas appeler `getCashSessions()`/`depositCashSession()` sans confirmation d'accès rôle DRIVER (cf. §1, ligne 25) — démarrer en mode démo comme la maquette, brancher au vrai endpoint dans une itération ultérieure une fois le scope confirmé.

**Note d'équilibrage** : ce lot a le plus grand nombre de fichiers (8) mais la charge individuelle est la plus faible (écrans majoritairement statiques, un seul lien vers un endpoint réel) — comparable en effort aux 3 autres lots qui ont moins de fichiers mais une complexité par fichier plus élevée (offline, idempotence, algorithmes).

---

## 3. Écrans existants — disposition précise

| Fichier | Sort | À préserver impérativement |
|---|---|---|
| `app/index.tsx` | Redesign + extension (permissions), reste `app/index.tsx` | `restoreSession()`, `setSession()`, `publicClient(tenant).login()`, la redirection `router.replace('/missions')` → à adapter en `'/(tabs)/missions'` |
| `app/missions.tsx` | **Déplacé** vers `app/(tabs)/missions.tsx`, redesign | `getMissions()`, `useOutbox`, `applyPending`, cache `CACHE_KEY`, bandeau hors-ligne. Logout et raccourcis retirés (déplacés) |
| `app/mission/[ref].tsx` | **Supprimé**, éclaté en `app/mission/[ref]/{index,status,proof,fail,done}.tsx` | Chaque appel API (`driverAdvance`, `driverProof`), `idemKey()`, `enqueue()`, `missingProof`/`proofRequirements`, `capturePhoto`, `<SignaturePad>` — un par un, dans le fichier qui reprend la branche correspondante |
| `app/incidents.tsx` | Reste en place, redesign visuel seul | `reportIncident()`, `getMyIncidents()`, `INCIDENT_TYPES` (5 valeurs réelles) |
| `app/support.tsx` | Reste en place, redesign visuel seul | `getSupportThread()`, `sendSupportMessage()`, comportement clavier/scroll |
| `app/gains.tsx` | Reste en place, redesign visuel seul | `getDriverHistory()`, cache `CACHE_KEY` |

---

## 4. Risques de régression — ne jamais toucher sans validation tech lead

- **`lib/outbox.ts`** — file d'attente offline, idempotence (`enqueue`/`flush`/`applyPending`). Deux `PendingAction.kind` existent (`advance`, `proof`) ; n'en ajoutez pas un troisième (ex. pour « fail ») sans revue explicite — cela change le contrat de rejeu et de dédoublonnage en prod.
- **`lib/api.ts`** — session, `idemKey()` (stable par `ref:action:driver`, condition du dédoublonnage serveur). Toute modification casse la garantie « un rejeu après coupure = un seul effet ».
- **`lib/proof.ts`** / **`lib/signature.ts`** — compression photo sous 700 Ko (paliers dégressifs), sérialisation SVG de la signature. Ne pas remplacer par le placeholder SVG figé de la maquette : l'implémentation réelle est **plus avancée** que la maquette sur ce point précis.
- **`lib/tracking.ts`** — remontée de position **sans file d'attente** (design volontaire : une position périmée n'a pas de valeur, cf. commentaire du fichier). Ne pas la faire passer par `outbox.ts`.
- **`lib/storage.ts`** — jeton en `SecureStore`, reste en `AsyncStorage`. Toute nouvelle clé de cache (shift, sync-queue) doit passer par `readJson`/`writeJson`, jamais par un accès direct à `AsyncStorage`.
- **`components/SignaturePad.tsx`** — `PanResponder` avec refs pour éviter les closures périmées. Restylage de conteneur uniquement (couleurs, bordures) — ne pas toucher à la logique de capture des traits.
- **`@transpo/domain`** (`STATUS_META`, `LIFECYCLE`, `proofRequirements`, `missingProof`, `INCIDENT_TYPES`, `ProofLevel`, `OrderStatus`) — source unique. La maquette redéfinit ses propres `STATUS`/`FLOW`/`T.STATUS` : **ne pas copier ces objets**, mapper les libellés FR/AR de la maquette sur les vraies clés du domaine.
- **`apps/driver-app/package.json`** — ne manque ni `@transpo/design-tokens` ni `@transpo/i18n` aujourd'hui. Coordination avec l'agent socle pour les ajouter une seule fois ; aucun lot n'ajoute de dépendance sans passer par lui (risque de doublons/versions divergentes).
- **Endpoints inexistants** — ne jamais appeler un endpoint qui n'existe pas dans `packages/api-client/src/index.ts` sous prétexte que la maquette montre une interaction (shift, caisse driver, échec de livraison, notifications). Cf. liste blanche §1.

---

## 5. Critères d'acceptation

1. **Couverture** : les 25 lignes du tableau §1 existent au chemin indiqué et sont atteignables depuis l'onglet ou l'écran parent listé.
2. **Aucun appel API hors liste blanche** : `grep -rn "authedClient()\." apps/driver-app/app` ne fait apparaître que les méthodes listées en §1 ; toute nouvelle méthode a été validée par le tech lead au préalable.
3. **Zéro diff** sur `lib/outbox.ts`, `lib/api.ts`, `lib/proof.ts`, `lib/signature.ts`, `lib/tracking.ts`, `lib/storage.ts` sauf autorisation explicite (vérifiable via `git diff --stat` sur chaque PR de lot).
4. **Pas de collision de fichiers** entre lots — la liste de fichiers modifiés/créés de chaque PR ne recoupe aucune autre.
5. **Écrans « pas de backend »** clairement signalés à l'utilisateur (callout, badge) — jamais de faux succès réseau implicite ; les changements d'état purement locaux (ex. toggle, upload simulé) sont acceptables s'ils ne prétendent pas avoir persisté côté serveur.
6. **Bilingue FR/AR complet dès la livraison** (skill `transpo-i18n`) — pas de chaîne en dur non traduite, RTL vérifié à l'œil (bascule `lang`).
7. **Cibles tactiles** ≥44px, action principale 52px, barre d'onglets 64px — via les tokens (`@transpo/design-tokens` une fois branché), pas de valeurs codées en dur redondantes.
8. **Typecheck** (`pnpm --filter @transpo/driver-app typecheck`) vert, sans `any`/`as` de contournement sur `Order`, `OrderStatus`, `ProofLevel`.
9. **Lot B spécifiquement** : un scénario manuel « avancer une commande hors-ligne → couper le réseau → forcer une preuve+COD → revenir en ligne » doit produire exactement les mêmes appels serveur (mêmes `idemKey`) qu'avant la refonte — non-régression fonctionnelle vérifiée en plus du visuel.
10. **`INCIDENT_TYPES`** soumis = les 5 valeurs réelles du domaine, jamais les 6 de la maquette telles quelles.
