# TC-A28 — Cohérence statut d'abonnement / accès

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A28)
- Pour chacun des 5 statuts, comparer la colonne Abonnement et la connexion au tenant.
- Essai et Actif → connexion OK ; **Impayé → connexion OK** (relance, pas coupure) ;
  Suspendu et Résilié → connexion refusée.

## Obtenu
Préparation : `demoimpaye` et `demosuspendu` provisionnés (plan Essai), essais forcés expirés
(cycle : « 2 essai(s) expiré(s) »), puis `demosuspendu` forcé à `past_due_since - 8`
(cycle : « 1 suspension(s) »). Mots de passe admin consignés dans `COMPTES.md`.

| Statut | Tenant | Colonne Abonnement | Connexion tenant | Attendu | Conforme |
|---|---|---|---|---|---|
| ESSAI | tangerlog | Essai — 13 j restants | **OK** (/dashboard) | OK | ✓ |
| ACTIF | rabatexpress | Actif — échéance 2026-10-01 | **OK** | OK | ✓ |
| IMPAYE | demoimpaye | Impayé — impayé depuis 2026-09-07 | **OK** (accès ouvert, relance) | OK | ✓ |
| SUSPENDU | demosuspendu | Suspendu — motif affiché | **refusée** « Espace suspendu — contactez la plateforme. » | refusée | ✓ |
| RÉSILIE | atlasfret | Aucun abonnement | **refusée** « Espace suspendu — contactez la plateforme. » | refusée | ✓ |

## Captures
- `01-cinq-statuts-dans-la-liste.png` (bandeaux impayé + sans accès, 5 lignes)
- `02-connexion-tangerlog-ok.png`, `03-connexion-rabatexpress-ok.png`,
  `04-connexion-demoimpaye-ok.png`, `05-connexion-demosuspendu-refusee.png`,
  `06-connexion-atlasfret-refusee.png`

## Anomalies
Aucune. (Note UX : le message de refus est le même pour Suspendu et Résilié —
« Espace suspendu… » — acceptable mais pourrait distinguer la résiliation.)
