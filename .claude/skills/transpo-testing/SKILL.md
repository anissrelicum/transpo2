---
name: transpo-testing
description: >
  Stratégie de tests Transpo : unitaire (règles métier), intégration (API + Postgres), et surtout
  E2E de bout en bout — obligatoires pour toute feature. Outils : Playwright (consoles web Next.js),
  Maestro (apps React Native), tests exécutés DANS Docker. À CONSULTER pour écrire/lancer des tests,
  définir une couverture, valider une feature avant clôture. Déclencheurs : "test", "e2e", "playwright",
  "maestro", "couverture", "CI", "valider", "vérifier la feature".
---

# Transpo — Tests (dont E2E obligatoire)

> Une feature n'est **jamais terminée sans test E2E** du parcours principal. Voir `DEFINITION-OF-DONE.md`. Tous les tests s'exécutent **en conteneur** (voir `transpo-architecture` → Docker).

## Pyramide
1. **Unitaire** — règles pures du `packages/domain` (statuts, cascade tarifaire, EU 561, score de fraude, réconciliation cash). Rapides, sans I/O.
2. **Intégration** — modules NestJS contre un **Postgres réel en conteneur** (schema-per-tenant), sur une base éphémère par run. Tester : endpoints, DTO, migrations, **isolation tenant** (une requête d'un tenant ne voit pas un autre schéma).
3. **E2E** — le parcours utilisateur réel de bout en bout, sur l'app packagée via Docker.

## E2E — outils & périmètre
- **Web (consoles admin/marchand/SaaS, suivi public)** : **Playwright**. Un service `e2e` dans le compose vise les apps web conteneurisées. Couvrir au minimum les parcours critiques :
  - Commande : créer → assigner → faire progresser → livrer → encaisser COD.
  - SaaS : provisionner un tenant → le retrouver dans la liste → suspendre.
  - Marchand : créer une commande (elle apparaît) → copier le code de suivi → page de suivi publique.
  - Chaque parcours joué **en FR et en AR (RTL)** et en **clair/sombre** au moins une fois.
- **Mobile RN (livreur/client)** : **Maestro** (flows YAML lisibles, adapté Expo) — alternative Detox. Couvrir : login→permissions, mission→preuve→COD→caisse/dépôt, onboarding, chat client, notation.

## Règles
- **Interactivité** : le test échoue si un contrôle censé agir ne produit aucun effet (bouton mort, filtre décoratif) — c'est le garde-fou anti-régression du projet.
- **Données** : seed déterministe par tenant de test ; pas de dépendance à l'état d'un autre test.
- **Idempotence offline (livreur)** : tester le rejeu d'une action (même `Idempotency-Key`) → aucun doublon.
- **CI** : `docker compose run --rm e2e` + unités + intégration à chaque PR ; bloque le merge si rouge. Artefacts (traces/vidéos Playwright, captures Maestro) conservés en cas d'échec.

## Commandes canoniques (toujours via Docker)
```
docker compose run --rm api pnpm test           # unitaire + intégration back
docker compose run --rm e2e                      # E2E web (Playwright)
docker compose run --rm maestro                  # E2E mobile (ou tunnel Expo documenté)
```
