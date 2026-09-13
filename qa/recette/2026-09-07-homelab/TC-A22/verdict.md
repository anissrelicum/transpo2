# TC-A22 — Le cycle est neutre quand il n'y a rien à faire

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A22)
- Cliquer **Lancer le cycle** deux fois de suite.
- Les deux exécutions rapportent les mêmes compteurs à zéro, aucun statut ne bouge.

## Obtenu
- Cycle 1 et cycle 2, messages identiques (capturés) :
  « Cycle du 2026-09-08 — 0 essai(s) expiré(s), 0 suspension(s), 0 reconduction(s),
  0 statut(s) tenant réaligné(s) » — captures 01 et 02 (page sous l'alerte).
- Après rechargement : aucun statut n'a bougé — atlasfret Essai 14 j, tangerlog Essai 13 j,
  rabatexpress Actif (échéance 2026-10-01) — capture 03.

## Captures
- `01-cycle-1-compteurs-zero.png`, `02-cycle-2-compteurs-zero.png`, `03-statuts-inchanges.png`

## Anomalies
Aucune.
