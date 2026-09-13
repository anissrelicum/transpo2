# TC-A11 — Catalogue des plans

- **Attendu** : 4 plans avec tarifs et quotas ; répartition du parc cohérente avec TC-A08 (1 Entreprise, 1 TPE Coursier).
- **Obtenu** : conforme. `/saas/plans` affiche Essai (Gratuit, 50 cmd/mois), TPE Coursier (299 DH/mois, 500 cmd/mois), Transporteur (899 DH/mois, 5 000 cmd/mois), Entreprise (2 499 DH/mois, illimité) — tous en mode Forfait, tarif v1 depuis le 07/09. Abonnés : Entreprise 1, TPE Coursier 1 (cohérent avec TC-A03/A06/A08).
- **Captures** : `01-catalogue-4-plans.png`, `02-repartition-du-parc.png`
- **Verdict** : OK (07/09 — consigné par l'orchestrateur après crash répété du sous-agent ; spec `a11.spec.ts` verte en exécution directe)
