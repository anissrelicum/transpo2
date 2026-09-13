# Grille de revue — Refonte App mobile Livreur (Lot 3)

Deux relecteurs, deux grilles : **A. Design** (fidélité à `design/lot3-app-livreur.jsx` + `design/lib-design-system.md`) et **B. Code** (régressions, contrats, typecheck). Chaque ligne est binaire (oui/non), avec la commande ou le fichier à regarder — pas d'appréciation. **Un seul « non » bloque la PR.** Référence de lotissement : `design/PLAN-REFONTE-MOBILE.md`.

---

## A. Revue Design

### A1 — Système de couleurs et thème

| # | Contrôle | Comment vérifier |
|---|---|---|
| A1.1 | Aucune couleur codée en dur (hex/rgb) hors `packages/design-tokens/src/index.ts` et `apps/driver-app/lib/theme.ts` | `grep -rnE "#[0-9a-fA-F]{3,6}|rgb\(|rgba\(" apps/driver-app/app apps/driver-app/components --include=*.tsx` → vide |
| A1.2 | Thème clair **et** sombre fonctionnels sur chaque écran livré dans la PR | Basculer le thème système (simulateur/device), capture des deux états |
| A1.3 | Statut de commande utilise `STATUS_META` de `@transpo/domain` (couleur + libellé), pas une palette recopiée | `grep -n "STATUS_META" <fichier>` présent ; pas de `switch(status)` local sur des couleurs |
| A1.4 | `CodChip` : vert si `codPaid`, ambre sinon, `—` gris si montant nul | Comparer à `design/lib-design-system.md` §`CodChip` |

### A2 — Primitives socle (`components/shell/`)

| # | Contrôle | Comment vérifier |
|---|---|---|
| A2.1 | La barre d'onglets (`TabBar`) mesure exactement 64px de haut | Inspecteur RN / mesure du style, `TabBar` importé depuis `components/shell`, pas réimplémenté |
| A2.2 | 5 onglets présents dans cet ordre : Missions, Tournée, Scanner, Shift, Profil | Vue `(tabs)/_layout.tsx` au device |
| A2.3 | Onglet actif en `indigo-11`, inactif en `gray-9` | Capture d'écran comparée aux tokens |
| A2.4 | `PrimaryBtn` mesure 52px de haut, pleine largeur, sur chaque écran de flux qui a une action principale | Mesure directe |
| A2.5 | `ScreenHead` : bouton retour en 44×44px, sur chaque écran de flux (hors onglets) | Mesure directe |
| A2.6 | `BottomAction` collé en bas avec dégradé vers le fond, pas une simple `View` opaque | Capture d'écran |
| A2.7 | Aucun écran de flux (connexion, détail mission, statut, preuve, échec, confirmation, notifications, onboarding, sync-queue) n'affiche la `TabBar` | Navigation manuelle vers chacun, `TabBar` absente |
| A2.8 | Aucune icône `react-native-vector-icons`/emoji importée en dehors du module `icons` de `components/shell` | `grep -rn "react-native-vector-icons\|@expo/vector-icons" apps/driver-app/app apps/driver-app/components` → vide sauf déjà présent avant refonte |
| A2.9 | Aucun composant `PhoneShell`/`StatusBar` (390×844, bordure téléphone, fausse horloge 9:41) reproduit dans le code de l'app | Lecture du fichier — absence de composant simulant un cadre de téléphone |

### A3 — Cibles tactiles et mise en page

| # | Contrôle | Comment vérifier |
|---|---|---|
| A3.1 | Toute zone tactile (bouton, ligne de liste cliquable, icône d'action) mesure ≥44×44px | Mesure directe sur les composants de la PR |
| A3.2 | Le cadre visuel général respecte les proportions et espacements de la maquette (padding `space-3`/`space-4`, radius `medium`) | Comparaison côte à côte avec le composant correspondant de `lot3-app-livreur.jsx` |

### A4 — Fidélité par écran (comparer au composant maquette listé)

Chaque écran de la PR est comparé à son composant source dans `design/lot3-app-livreur.jsx` (cf. `design/PLAN-REFONTE-MOBILE.md` §1 pour la correspondance route ↔ composant). Contrôle unique répété par écran :

| # | Contrôle |
|---|---|
| A4.1 | La structure visuelle (sections, ordre des blocs, hiérarchie typographique) correspond au composant maquette correspondant, à l'exception des adaptations documentées dans le plan (pas de vraie carte, pas de `PhoneShell`, etc.) |

Écrans à cocher un par un dans cette PR (lister les routes concernées par le lot, cf. §2 du plan) : `_______________`

### A5 — Écrans sans backend

| # | Contrôle | Comment vérifier |
|---|---|---|
| A5.1 | Chaque écran de `design/PLAN-REFONTE-MOBILE.md` §5 porte un indicateur visuel (badge « démo »/« à venir », callout) distinguant la donnée statique de la donnée réelle | Comparer écran par écran contre le tableau §5 |
| A5.2 | Aucun écran ne simule un succès réseau pour une action sans endpoint (pas de toast « Envoyé »/« Enregistré » sur un formulaire qui n'appelle aucune API) | Lecture du code + test manuel de soumission |
| A5.3 | `app/macaisse.tsx` n'existe pas, aucun lien de navigation ne pointe vers un écran « Ma caisse » | `find apps/driver-app/app -iname "*caisse*"` → vide ; recherche du libellé dans le hub Profil |

### A6 — i18n / RTL

| # | Contrôle | Comment vérifier |
|---|---|---|
| A6.1 | Aucune chaîne visible non traduite (FR codé en dur sans passer par `@transpo/i18n`) | Revue manuelle du fichier + recherche de chaînes littérales dans le JSX |
| A6.2 | Les libellés arabes réutilisent ceux déjà présents dans `lot3-app-livreur.jsx` plutôt que d'être retraduits | Comparaison texte à texte pour les écrans concernés |
| A6.3 | Le passage en `lang=ar` inverse la mise en page (RTL complet : icônes, alignement, sens de lecture) sur chaque écran livré | Bascule de langue au device, capture des deux sens |
| A6.4 | `money()` utilisé pour tout montant affiché conserve l'isolat directionnel U+2066…U+2069 (version `@transpo/domain`, pas celle de la maquette) | `grep -n "money(" <fichier>` → import depuis `@transpo/domain` |

---

## B. Revue Code

### B1 — Fichiers protégés (zéro exception)

| # | Contrôle | Comment vérifier |
|---|---|---|
| B1.1 | Aucune modification sur les 6 fichiers `lib/*.ts` protégés | `git diff --stat main -- apps/driver-app/lib/outbox.ts apps/driver-app/lib/api.ts apps/driver-app/lib/proof.ts apps/driver-app/lib/signature.ts apps/driver-app/lib/tracking.ts apps/driver-app/lib/storage.ts` → vide, sur **chaque** PR de lot, sans exception (y compris pour `fail`, déjà porté par le tech lead) |
| B1.2 | Aucune modification sur `components/SignaturePad.tsx` en dehors du restylage de conteneur (couleurs/bordures) — `PanResponder` intact | `git diff main -- apps/driver-app/components/SignaturePad.tsx`, lecture ligne à ligne si diff non vide |
| B1.3 | Aucune modification sur les livrables socle : `components/shell/*.tsx` (dont `index.ts`, `icons`), `lib/theme.ts`, `packages/design-tokens/src/index.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx` | `git diff --stat main -- <ces fichiers>` → vide pour toute PR hors socle |
| B1.4 | `@transpo/domain` non redéfini localement : pas de copie de `STATUS_META`, `LIFECYCLE`, `INCIDENT_TYPES`, `proofRequirements`, `missingProof` dans le code de l'app | `grep -rn "const STATUS_META\|const LIFECYCLE\|const INCIDENT_TYPES" apps/driver-app` → vide |

### B2 — Lotissement

| # | Contrôle | Comment vérifier |
|---|---|---|
| B2.1 | La liste des fichiers créés/modifiés de la PR ne recoupe aucun fichier listé dans un autre lot au §2 du plan | Comparaison directe `git diff --stat` de la PR vs. listes §2 |
| B2.2 | `app/mission/[ref].tsx` (fichier) a été supprimé avant la création du dossier `app/mission/[ref]/` (Lot B uniquement) | `git log --diff-filter=D -- apps/driver-app/app/mission/\[ref\].tsx` précède la création des sous-fichiers |

### B3 — API : liste blanche, pas d'endpoint inventé

| # | Contrôle | Comment vérifier |
|---|---|---|
| B3.1 | Seuls ces appels apparaissent : `getMissions`, `driverAdvance`, `driverProof`, `driverFail`, `reportIncident`, `getMyIncidents`, `getSupportThread`, `sendSupportMessage`, `getDriverHistory`, `pushDriverPosition` | `grep -rn "authedClient()\." apps/driver-app/app` |
| B3.2 | Aucun appel à `getCashSessions`/`depositCashSession` | `grep -rn "getCashSessions\|depositCashSession" apps/driver-app` → vide |
| B3.3 | `INCIDENT_TYPES` utilisé dans `incidents.tsx` (et tout autre écran) est un `import` depuis `@transpo/domain`, jamais une liste recopiée à 6 valeurs (maquette) | `grep -n "INCIDENT_TYPES" apps/driver-app/app/incidents.tsx` → ligne d'import, pas de tableau littéral |
| B3.4 | Les écrans « pas de backend » (§5 du plan) ne contiennent aucun `fetch`/`authedClient()` vers un endpoint non listé en B3.1 | Lecture du fichier |

### B4 — Offline / idempotence (spécifique Lot B, et tout écran passant par l'outbox)

| # | Contrôle | Comment vérifier |
|---|---|---|
| B4.1 | `status.tsx`, `proof.tsx`, `fail.tsx` appellent `enqueue()` avec le même `id`/`idemKey` qu'avant la refonte pour une même action (`ref:action:driver`) | Lecture du code + comparaison au comportement pré-refonte |
| B4.2 | Scénario manuel : avancer une commande hors-ligne → couper le réseau → forcer une preuve+COD → revenir en ligne → mêmes `idemKey` envoyés qu'avant la refonte | Test manuel avec logs réseau (device ou simulateur, mode avion) |
| B4.3 | `proof.tsx` fait un **seul** appel `driverProof()` bundlant COD + photo + signature (pas deux routes séparées) | Lecture du code, absence de route intermédiaire type `cod.tsx` |
| B4.4 | La garde de `logout()` sur la file en attente (`Alert` si `pending.length > 0`) est présente dans `app/(tabs)/profil.tsx`, avec `clearOutbox()` + `clearSession()` identiques à l'ancien `missions.tsx` | Lecture du code + test manuel (file non vide → alerte bloquante) |
| B4.5 | Le partage de position (`useTracking`) est piloté par le démarrage/fin de shift (`shift.tsx`), et `settings.tsx` n'en affiche qu'un badge lecture seule | Lecture du code des deux fichiers |

### B5 — Build et typage

| # | Contrôle | Comment vérifier |
|---|---|---|
| B5.1 | Typecheck vert | `pnpm --filter @transpo/driver-app typecheck` (ou nom de filtre exact du package) sans erreur |
| B5.2 | Aucun `any` ni `as` de contournement sur `Order`, `OrderStatus`, `ProofLevel` dans le diff de la PR | Lecture du diff |
| B5.3 | Aucune dépendance ajoutée à `apps/driver-app/package.json` par un lot écran (design-tokens/i18n déjà présents, tout ajout doit passer par le tech lead) | `git diff main -- apps/driver-app/package.json` sur les PR des 4 lots → vide |

### B6 — Écrans existants : régressions spécifiques

| # | Fichier | Contrôle | Comment vérifier |
|---|---|---|---|
| B6.1 | `app/(tabs)/missions.tsx` (ex-`missions.tsx`) | `getMissions()`, `useOutbox`, `applyPending`, cache `CACHE_KEY`, bandeau hors-ligne inchangés fonctionnellement | Lecture du code + test manuel hors-ligne |
| B6.2 | `app/mission/[ref]/*.tsx` | Chaque appel API (`driverAdvance`, `driverProof`, `driverFail`), `idemKey()`, `capturePhoto`, `<SignaturePad>`, `missingProof`/`proofRequirements` repris à l'identique dans le fichier qui porte la branche correspondante | Lecture croisée avec l'ancien `mission/[ref].tsx` (historique git) |
| B6.3 | `app/incidents.tsx` | `reportIncident()`, `getMyIncidents()` inchangés ; redesign visuel seul | `git diff` limité au JSX/style |
| B6.4 | `app/support.tsx` | `getSupportThread()`, `sendSupportMessage()`, comportement clavier (`KeyboardAvoidingView`) et scroll-to-end inchangés | Test manuel clavier + `git diff` |
| B6.5 | `app/gains.tsx` | `getDriverHistory()`, cache `CACHE_KEY` inchangés ; pas de nouveau badge « Freelance »/« Salarié » sans champ réel dans `DriverHistory` | Lecture du type `DriverHistory` (`packages/api-client`) vs. code affiché |

---

## Verdict

- **Design** : tous les contrôles A cochés → approuvé design. Un seul « non » → commentaire précis (numéro de contrôle) et retour à l'agent du lot concerné.
- **Code** : tous les contrôles B cochés → approuvé code. Un seul « non » en B1/B3/B4 (fichiers protégés, whitelist API, offline) → blocage immédiat, pas de négociation au cas par cas.
