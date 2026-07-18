---
name: transpo-feature
description: >
  Recette de bout en bout pour ajouter une feature/un écran à Transpo en respectant domaine,
  architecture, design-system, i18n et contrats d'API. À UTILISER quand on demande d'implémenter
  un écran, un module, une fonctionnalité, ou de porter une maquette en code réel. Déclencheurs :
  "ajoute une feature", "nouvel écran", "implémente", "crée le module", "porter la maquette",
  "développer <fonction>".
---

# Transpo — Ajouter une feature (bout en bout)

Ce skill orchestre les autres. **Charger d'abord** : `transpo-domain` (règles), puis selon le besoin `transpo-architecture`, `transpo-design-system`, `transpo-i18n`, `transpo-api`. La spec de l'écran est dans les `PRD-*.md`.

## Étapes
1. **Cadrer depuis le PRD** — identifier le profil (console/marchand/livreur/client/SaaS) et l'écran cible dans le PRD correspondant. Relever règles métier applicables (`transpo-domain`) et l'état/les statuts en jeu.
2. **Modèle de données** — si nouvelle entité/champ : migration Drizzle appliquée **sur le schéma de tenant** (`platform` seulement pour tenants/plans/factures plateforme). Types dans `packages/domain`.
3. **API** — endpoint(s) NestJS dans le bon module (contexte), DTO typés partagés (`transpo-api`), résolution de tenant via le middleware, idempotence si action offline-able. Calcul métier sensible côté back.
4. **Client** — méthode dans `packages/api-client` (typée), réutilisée par les fronts.
5. **UI** — écran avec les primitives (`transpo-design-system`) : Radix (web) / Tamagui (RN), `StatusBadge`/`money()`/toasts, cibles ≥44px, action en bas (mobile), thème clair+sombre.
6. **i18n** — dictionnaire FR/AR, `dir` RTL, helper **réellement appelé** (`transpo-i18n`). Aucune chaîne en dur.
7. **Interactivité** — chaque bouton/filtre a un effet réel (état, navigation, dialog, ou toast de confirmation). **Zéro** `onClick` vide, zéro filtre décoratif.
8. **Tests** — unitaire (règle métier), intégration (API + Postgres, isolation tenant) et **E2E obligatoire** du parcours principal (Playwright web / Maestro RN), le tout **exécuté dans Docker** (`transpo-testing`).
9. **Docker** — la feature tourne via `docker compose up` depuis un clone neuf, sans rien installer sur l'hôte (`transpo-architecture`).
10. **Documentation** — README/ADR/OpenAPI mis à jour, PRD synchronisé si le périmètre bouge (`transpo-docs`).
11. **Vérifier en exécutant** — dérouler le flux réel (pas seulement les tests) : basculer FR↔AR et clair↔sombre, cliquer chaque contrôle.

## Definition of Done
Réf. complète : `DEFINITION-OF-DONE.md`. En résumé :
- [ ] Règles métier conformes au `transpo-domain` (aucune règle réinventée).
- [ ] Isolation tenant respectée (schema-per-tenant), tenant dérivé du serveur.
- [ ] Enums/contrats depuis `packages/domain`/`api-client` (pas de duplication).
- [ ] FR + AR (RTL) réellement fonctionnels, dictionnaire consommé.
- [ ] Clair + sombre OK.
- [ ] Aucun élément UI mort ; exports → toast.
- [ ] **Tout via Docker** : démarre avec `docker compose up`.
- [ ] **Tests** unit + intégration + **E2E** verts (en conteneur).
- [ ] **Documentation** à jour (README/ADR/OpenAPI/PRD).
- [ ] Flux vérifié à la main.
