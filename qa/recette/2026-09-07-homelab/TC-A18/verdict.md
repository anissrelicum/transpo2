# TC-A18 — Archivage protégé

- **Attendu** : archiver un plan avec abonnés est refusé ; un plan sans abonné est archivé, sort du sélecteur de `/saas` et n'apparaît qu'avec « Afficher les plans archivés » ; « Restaurer » le remet au catalogue.
- **Obtenu** : conforme.
  - Entreprise (1 abonné) : dialogue de confirmation explicite puis refus « 1 organisation(s) sont abonnées à ce plan. Archivage refusé. »
  - pay-as-you-go (0 abonné) : archivé, hors catalogue (4 lignes), absent du sélecteur de provisioning, visible avec le toggle « Afficher les plans archivés », restauré (5 lignes).
- **Captures** : `01-confirmation-archivage-entreprise.png` → `06-payg-restaure.png`
- **Note spec** : la spec d'origine n'était pas idempotente (échec si le plan était déjà archivé par un run interrompu) et un menu Radix resté ouvert (aria-hidden) faisait échouer l'assertion ; corrigé par rechargement de page après l'alerte. Comportement applicatif conforme dans tous les runs.
- **Verdict** : OK (07/09 — consigné par l'orchestrateur)
