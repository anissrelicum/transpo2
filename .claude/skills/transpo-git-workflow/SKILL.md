---
name: transpo-git-workflow
description: >
  Conventions Git et de contribution Transpo : branches, messages de commit, checklist de PR,
  portes CI (Docker + tests E2E verts avant merge). À CONSULTER avant de committer, ouvrir une PR,
  ou définir la CI. Déclencheurs : "commit", "branche", "PR", "pull request", "merge", "CI", "release".
---

# Transpo — Workflow Git & contribution

## Branches
- Travail sur des **branches de feature** issues de `main` (ex. `feat/orders-list`, `fix/cod-recon`). **Jamais** de commit direct sur `main`.
- Une branche = une feature/un fix cohérent. Rebase sur `main` avant PR.

## Messages de commit
- Impératif, concis, préfixe type conventionnel (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).
- **Trailers requis** (convention de ce repo) en fin de message :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: <url de session>
  ```
- Corps facultatif mais recommandé pour le « pourquoi ».

## Checklist de Pull Request
La PR ne peut être fusionnée que si **toute la `DEFINITION-OF-DONE.md`** est satisfaite. En particulier :
- [ ] `docker compose up` démarre depuis un clone neuf (rien sur l'hôte).
- [ ] Tests **unit + intégration + E2E** verts **en conteneur** (`transpo-testing`).
- [ ] FR/AR (RTL) et clair/sombre vérifiés ; aucun élément UI mort.
- [ ] Isolation tenant respectée + testée.
- [ ] **Documentation** à jour (README/ADR/OpenAPI) et **PRD synchronisé** si le périmètre a bougé.
- [ ] Description de PR : quoi, pourquoi, **niveau livré** (maquette / production) + réserves.

## Portes CI (bloquantes)
- Pipeline sur chaque PR : lint + typecheck + tests (via Docker) + **E2E**. **Merge bloqué si rouge.**
- Artefacts d'échec conservés (traces Playwright, captures Maestro).
- Images Docker construites et réutilisées entre CI et déploiement (parité).

## PR petites et fréquentes
Préférer plusieurs PR ciblées à une PR géante — plus faciles à relire et à vérifier de bout en bout.
