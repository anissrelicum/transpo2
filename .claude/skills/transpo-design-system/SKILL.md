---
name: transpo-design-system
description: >
  Design-system Transpo basé sur Radix. Tokens (indigo/slate, radius medium, panelBackground solid),
  primitives partagées (StatusBadge, money(), KPI, toasts, PageHeader), thème clair/sombre,
  cibles tactiles ≥ 44px, action principale en bas d'écran. À CONSULTER avant de construire TOUT
  écran ou composant UI, choisir des couleurs, un composant, ou styliser. Déclencheurs : "composant",
  "écran", "UI", "Radix", "thème", "couleur", "badge", "bouton", "carte", "toast", "style".
---

# Transpo — Design-system (Radix)

## Fondations (identiques à la maquette)
- **Radix Themes** config : `accentColor="indigo"`, `grayColor="slate"`, `radius="medium"`, `scaling="100%"`, `panelBackground="solid"`.
- **Thème clair/sombre** obligatoire sur toutes les interfaces.
- **Neutres** : gris slate (biais froid vers l'indigo), pas de gris pur.
- **Sémantique couleur** (séparée de l'accent) : vert = succès/livré, ambre = attention/COD, rouge = échec/critique, violet = récupéré, cyan = en route.

## Radix web-only — décision cross-platform (À VALIDER)
Radix UI Themes est **web uniquement**. Répartition :
- **Web (Next.js : consoles admin/marchand/SaaS, suivi public)** → **Radix Themes en direct**. Package `packages/ui-web`.
- **React Native (apps livreur/client)** → Radix n'existe pas en natif. Utiliser **Tamagui** (bibliothèque cross-platform inspirée de Radix, API et tokens très proches) alimentée par `packages/design-tokens`. Package `packages/ui-native`.
- **`packages/design-tokens`** = une seule échelle (couleurs indigo/slate, radius, spacing, typo) consommée par les deux mondes → cohérence visuelle garantie.

Si l'équipe refuse Tamagui, alternative : composants RN maison minimalistes reproduisant l'API des primitives ci-dessous, alimentés par les mêmes tokens.

## Primitives partagées (même nom/comportement web & natif)
- **`StatusBadge({ status, lang })`** — badge coloré depuis l'enum `STATUS` (couleur figée, libellé FR/AR). Ne jamais recoder les couleurs de statut à la main.
- **`money(n)`** — format `1 250,00 DH`. Toujours passer par ce helper.
- **`CodChip({ amount, paid, lang })`** — badge COD (ambre à encaisser / vert encaissé).
- **`KPI`**, **`PageHeader`**, **`EmptyState`**, **`ErrorState`**, **`Field`** — primitives de layout (cf. `lib.jsx` de la maquette comme référence d'API).
- **Toasts** — système de confirmation transverse. Toute action « one-shot » (export, PDF, envoi, dépôt) déclenche un toast. Web : hôte de toasts au niveau shell ; RN : équivalent.

## Règles UI
- **Cibles tactiles ≥ 44px** (48px pour l'action principale mobile).
- **Action principale collée en bas** sur mobile (barre pleine largeur, hauteur ~52px).
- **RTL complet en arabe** (voir `transpo-i18n`) — utiliser les propriétés logiques (`insetInlineStart`, `marginInline`…), jamais `left/right` codés en dur.
- **Cartes mobiles** = cadre 390×844 en maquette ; en prod, layout responsif natif.
- **Focus visible** au clavier sur web ; respecter `prefers-reduced-motion`.
- Tableaux/contenus larges : conteneur `overflow-x` propre, jamais de scroll horizontal du body.

## Anti-régressions (vérifiées à chaque écran)
- Aucun `onClick` vide, aucun bouton sans handler (voir `AUDIT-Interactions-Non-Fonctionnelles.md`).
- Chaque écran doit rendre en clair ET en sombre, en FR ET en AR.
- Réutiliser les primitives ci-dessus au lieu de re-styliser des `Badge`/`Text` bruts.
