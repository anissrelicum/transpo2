# TC-A20 — Traçabilité

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A20)
- Après TC-A13 → TC-A18, consulter `/v1/audit` (page **Audit** de la console).
- Les actions `plan.create`, `plan.version`, `plan.archive`, `plan.restore` sont tracées avec
  leur acteur et leur cible.

## Obtenu — page Audit, 13 événements, tous horodatés avec acteur `ops@transpo.ma` (SUPER_ADMIN)
- `plan.create` → cible `pay-as-you-go` — capture 01.
- `plan.version` → cibles `pay-as-you-go` (v1, USAGE, effet 2026-09-08) et `entreprise` (v2,
  FORFAIT, effet 2026-09-09) — capture 02.
- `plan.archive` → cible `pay-as-you-go` (détail `{"force":false,"subscribers":0}`) et
  `plan.restore` → cible `pay-as-you-go` — capture 03.
- Bonus visible : `subscription.subscribe` (rabatexpress, TC-A08/A09) tracés avec outcome.

## Captures
- `01-audit-plan-create.png`, `02-audit-plan-version.png`, `03-audit-plan-archive-restore.png`

## Anomalies / observations
- Aucune anomalie.
- Observation : la tentative d'archivage **refusée** d'Entreprise (TC-A18) n'est pas tracée
  (seules les actions effectives le sont) — comportement cohérent, consigné pour information.
