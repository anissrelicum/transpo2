---
name: transpo-i18n
description: >
  Internationalisation Transpo : bilingue Français / Arabe avec RTL complet sur toute interface
  exposée à un utilisateur (livreur, client, marchand) et sur les consoles. À CONSULTER dès qu'un
  écran contient du texte, qu'on ajoute une chaîne, un libellé, une colonne, une locale, ou qu'on
  gère la direction de mise en page. Déclencheurs : "texte", "libellé", "traduction", "FR", "AR",
  "arabe", "RTL", "dir", "i18n", "langue", "dictionnaire".
---

# Transpo — i18n (FR / AR + RTL)

> ⚠️ **Piège récurrent du projet** : sur la maquette, des dictionnaires ont été *définis mais jamais appelés* (chaînes restées en dur → écran figé en français). **Un dictionnaire non consommé = correction inopérante.** Vérifier systématiquement que le helper de langue est réellement utilisé dans le rendu.

## Règle
Tout écran utilisateur (livreur, client, marchand) ET toutes les consoles sont **FR + AR**. L'arabe implique **RTL complet** (inversion de mise en page), pas seulement la traduction du texte.

## Pattern
- Un dictionnaire par écran/module : `const T = { fr: {...}, ar: {...} }` + helper `const t = T[lang === 'ar' ? 'ar' : 'fr']`.
- **Le helper doit être appelé dans le rendu** : titres, sous-titres, en-têtes de colonnes, libellés de champs/boutons, options de select, textes de callout, badges. Aucune chaîne visible en dur.
- **Direction** : appliquer `dir={lang === 'ar' ? 'rtl' : 'ltr'}` au niveau du thème/racine. Utiliser les propriétés CSS **logiques** (`insetInlineStart/End`, `marginInline`, `paddingInline`) — jamais `left/right`.
- **Statuts** : réutiliser `STATUS_AR` (mapping fourni) via `StatusBadge({ status, lang })`. Ne pas retraduire les statuts à la main.
- **Nombres/monnaie** : `money()` reste en format `fr-FR` (chiffres latins) même en arabe, sauf décision produit contraire ; adapter les unités traduisibles (h → س).
- **Données de démo** (noms, villes) : peuvent rester en latin ; prévoir un mapping AR pour les villes si affichées (ex. Casablanca → الدار البيضاء).

## Où vivent les traductions
`packages/i18n` (dictionnaires partagés + `STATUS_AR` + helpers `dir`/RTL), importé par toutes les apps. Éviter les dictionnaires locaux dupliqués quand la chaîne est partagée.

## Checklist de revue d'un écran
- [ ] Aucune chaîne visible codée en dur (tout passe par `t.xxx`).
- [ ] Le helper de langue est **effectivement appelé** (pas de dictionnaire mort).
- [ ] Bascule FR→AR : l'écran s'affiche réellement en arabe.
- [ ] RTL : marges/icônes directionnelles inversées correctement (propriétés logiques).
- [ ] Statuts via `StatusBadge`/`STATUS_AR`, montants via `money()`.
