---
name: transpo-docs
description: >
  Conventions de documentation Transpo : README par app/package, ADR pour les décisions d'archi,
  doc d'API (OpenAPI généré depuis NestJS), synchronisation du PRD, guide de démarrage Docker.
  Documenter fait partie de la Definition of Done. À CONSULTER dès qu'on livre une feature, prend
  une décision technique, ajoute un endpoint, ou modifie la structure. Déclencheurs : "documenter",
  "doc", "README", "ADR", "openapi", "guide", "changelog".
---

# Transpo — Documentation (fait partie du Done)

> Une tâche n'est pas terminée si son comportement/décision n'est pas documenté au bon endroit. Concis et à jour prime sur exhaustif et périmé.

## Où documenter quoi
- **`README.md` racine** — pitch, prérequis (Docker uniquement), **démarrage en une commande** (`docker compose up`), URLs des apps, comment lancer migrations/tests/E2E. Doit permettre à un nouveau venu de tout lancer depuis un clone neuf sans rien installer sur l'hôte.
- **`README.md` par app/package** (`apps/*`, `packages/*`) — rôle, dépendances internes, commandes.
- **`.env.example`** — toute variable d'environnement documentée (jamais de secret réel).
- **ADR** (`docs/adr/NNNN-titre.md`) — une décision d'architecture = un ADR court (contexte / décision / conséquences). Ex. : schema-per-tenant, NestJS, Radix+Tamagui, choix E2E. Immuable une fois acté ; on en écrit un nouveau pour changer d'avis.
- **API** — **OpenAPI généré depuis NestJS** (décorateurs Swagger), publié en dev. Les contrats de référence restent dans `transpo-api` et `packages/api-client`.
- **PRD** (`PRD-*.md`) — mis à jour si le périmètre fonctionnel bouge (sitemap, tableaux d'état). Le PRD reste la spec produit ; les README/ADR sont la doc technique.
- **`AUDIT-Interactions-Non-Fonctionnelles.md`** — tenu à jour si on réintroduit/résout des écrans non fonctionnels.
- **CHANGELOG** (optionnel mais recommandé) — entrées par release.

## Règles
- Doc **versionnée avec le code** (même PR que la feature qu'elle décrit).
- Toute commande documentée passe **par Docker** — jamais un `npm run` hôte (cohérent avec `transpo-architecture`).
- Bilingue non requis pour la doc dev (technique, en français ou anglais — choisir une langue et s'y tenir) ; l'UI, elle, reste FR/AR (`transpo-i18n`).
- Un diagramme vaut mieux qu'un paragraphe pour l'archi/les flux (Mermaid dans les `.md`).
