# Prompt Claude Design — Finaliser le bilingue FR/AR (correction ±2)

> À coller dans Claude Design, projet **« Transpo — Prompts Claude Design »**.
> Deux corrections seulement. Conventions habituelles : `window.Transpo`, `STATUS_AR`, `money()`, thème clair/sombre, `dir="rtl"` en arabe. **Référence de qualité : `lot12.jsx` (Analytics), déjà correctement bilingue — reproduis exactement ce schéma.**

---

## Correction 1 — `lot6.jsx` : BRANCHER le dictionnaire FR/AR déjà présent (ne pas seulement le définir)

⚠️ **Problème actuel** : `lot6.jsx` contient déjà un dictionnaire `L6 = { fr, ar }` et un helper `useL6(lang)`, **mais ils ne sont jamais utilisés** — les fonctions d'écran (`Vehicles`, `Drivers`, `Pricing`, `Billing`, `Notifications`, `UsersSettings`, `GoalsAdmin`) reçoivent seulement `{ state }` et affichent des chaînes françaises codées en dur. Résultat : basculer en AR ne change rien. C'est du **code mort**.

**À faire — câbler réellement l'i18n :**
1. Fais recevoir `lang` (et `dir`) à **chaque** fonction d'écran : `function Vehicles({ state, lang })`, `Drivers({ state, lang })`, `Pricing({ lang })`, `Billing({ state, lang })`, `Notifications({ lang })`, `UsersSettings({ lang })`, `GoalsAdmin({ state, lang })`. Le `Shell` passe déjà `lang` dans le `ctx` — il suffit de le destructurer (les écrans sont montés via `render: (ctx) => <X {...ctx} />`).
2. Dans chaque fonction, récupère le dictionnaire : `const t = useL6(lang);` puis remplace **toutes** les chaînes en dur (titres de page, sous-titres, en-têtes de colonnes de tableaux, libellés de champs et de boutons, options de `Select`, textes de `Callout`, badges) par `t.xxx`.
3. Complète `L6.ar` pour **toutes** les clés utilisées (si des clés manquent côté `ar`, ajoute-les). Réutilise `STATUS_AR` (déjà exposé) pour les statuts et `money()` pour les montants.
4. Vérifie le rendu RTL en arabe (le `dir` est géré au niveau `Theme` par le `Shell`, mais contrôle l'inversion des marges/icônes directionnelles).

**Critère de réussite** : quand l'utilisateur bascule FR→AR dans le harnais, les écrans Véhicules, Chauffeurs, Tarification, Facturation, Notifications, Utilisateurs et Objectifs s'affichent réellement en arabe. Le helper `useL6` doit apparaître appelé dans le code, pas seulement défini.

## Correction 2 — `lot5.jsx` : traduire la Console SaaS (actuellement 100 % française)

La partie **Console SaaS** de `lot5.jsx` (`AdminTenants`, `AdminPlans`, `AdminBilling`, `PaywallDemo`, et le shell `AdminApp`) n'a **aucune** internationalisation — tout est en français. (Le Suivi public du même fichier est déjà bilingue : inspire-t'en.)

**À faire :**
1. Ajoute un dictionnaire `SAAS = { fr: {...}, ar: {...} }` couvrant : titres/sous-titres de page, en-têtes de colonnes (Organisation, Plan, Statut, Véhicules, Commandes…), libellés KPI (Tenants actifs, En essai, MRR…), noms de plans et features, textes du paywall (3 variantes), et les actions de menu (Voir la fiche, Se connecter en tant que, Suspendre, Réactiver, Déprovisionner).
2. Ajoute un **sélecteur de langue FR/AR** dans la barre latérale de `AdminApp` (à côté du sélecteur d'apparence existant), un état `lang`, et applique `dir={lang === 'ar' ? 'rtl' : 'ltr'}` sur le `Theme` (comme le fait déjà `PublicTracking`).
3. Passe `lang` aux fonctions d'écran et remplace les chaînes en dur par le dictionnaire. Réutilise `STATUS_AR`/`money()` si pertinent.

**Critère de réussite** : la Console SaaS bascule réellement en arabe (RTL) via son propre sélecteur de langue.

---

**Rappel transverse** : l'objectif est que **plus aucune console majeure ne reste figée en français** quand on choisit l'arabe. Si tu ajoutes un dictionnaire, assure-toi qu'il est **consommé** par le rendu — sinon la correction est inopérante (c'est l'erreur à corriger sur `lot6`).
