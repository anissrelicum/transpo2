# Transpo — Definition of Done

Critères pour déclarer une tâche **terminée**. Une tâche n'est finie que si **tous les niveaux applicables** sont cochés — et **vérifiés en exécutant**, pas supposés. Détails dans les skills `.claude/skills/transpo-*`.

## 0. Critère souverain
**Fait ce qui était demandé, prouvé en déroulant le vrai comportement** (cliquer, naviguer, soumettre) — pas seulement « les tests passent » / « ça compile ». Si un point a été sauté ou échoue, on le **dit** ; on ne clôt pas en le masquant.

## 1. Fonctionnel & métier — `transpo-domain`
- [ ] Comportement conforme au **PRD** de l'écran.
- [ ] Règles métier respectées (statuts, COD, EU 561, Loi 09-08, cascade tarifaire…) — **aucune règle réinventée**.
- [ ] Enums/contrats depuis `packages/domain`/`api-client` (`proof_level` = `photo_signature`).

## 2. Multi-tenant (bloquant) — `transpo-architecture`
- [ ] Tenant dérivé **du serveur** (sous-domaine/JWT → `search_path`), jamais d'un champ client.
- [ ] Isolation testée : un tenant ne voit **jamais** les données d'un autre schéma.

## 3. Interactivité (zéro élément mort) — `transpo-design-system`
- [ ] Chaque bouton/filtre a un effet réel (état, navigation, dialog, ou toast).
- [ ] Aucun `onClick` vide, aucun filtre/pagination décoratif, **aucun dictionnaire/handler défini mais jamais appelé**.

## 4. UI & thèmes — `transpo-design-system`
- [ ] Primitives Radix / design-system réutilisées (`StatusBadge`, `money()`, toasts…).
- [ ] Rendu correct en **clair ET sombre**, cibles ≥ 44px, action principale en bas (mobile).

## 5. i18n FR/AR — `transpo-i18n`
- [ ] Aucune chaîne en dur ; **helper de langue réellement consommé**.
- [ ] Bascule FR→AR effective, **RTL** correct (propriétés logiques).

## 6. Docker (bloquant) — `transpo-architecture`
- [ ] Démarre proprement via **`docker compose up`** depuis un clone neuf, **sans rien installer sur l'hôte**.
- [ ] Migrations, back, fronts, tests : **tout en conteneur**. Aucune commande hôte documentée.

## 7. Tests — `transpo-testing`
- [ ] Unitaire (règle métier) + intégration (API + Postgres, isolation tenant).
- [ ] **E2E obligatoire** du parcours principal : Playwright (web) / Maestro (RN), joué au moins une fois **FR + AR** et clair/sombre.
- [ ] Idempotence des actions offline livreur (rejeu sans doublon).
- [ ] Tout vert **en conteneur** ; la CI bloque le merge si rouge.

## 8. Documentation — `transpo-docs`
- [ ] README/ADR/`.env.example` à jour ; **OpenAPI** régénéré si l'API change.
- [ ] **PRD synchronisé** si le périmètre fonctionnel bouge.

## 9. Qualité & traçabilité
- [ ] Typecheck + lint verts, **aucune erreur console** au runtime.
- [ ] Commit clair ; push si demandé.

---

## Niveaux de livraison (à préciser à chaque fois)
- **Niveau maquette** : comportement simulé proprement (exports → toast, scanner/signature simulés, auth = vitrine). Terminé quand la simulation est nette et l'UI intégralement interactive.
- **Niveau production** : implémentation réelle (vrais fichiers d'export, scanner caméra, capture de signature, auth verrouillante, providers SMS/WhatsApp avec consentement 09-08).

**Toujours annoncer le niveau livré** et rappeler les réserves connues (tracées dans le PRD et `AUDIT-Interactions-Non-Fonctionnelles.md`) plutôt que de les faire passer pour finies.
