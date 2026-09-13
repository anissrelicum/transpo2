# TC-A25 — Rattrapage d'un cron manqué

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A25)
- Forcer `renews_at` trois mois en arrière sur un abonnement actif, puis **Lancer le cycle** une fois.
- `current_period` avance mois par mois jusqu'au mois courant — **aucune période sautée** —
  et `renews_at` repasse dans le futur.

## Obtenu
- Avant : rabatexpress `ACTIF | 2026-09 | 2026-10-01` ; forçage `renews_at = 2026-07-01`.
- Un seul cycle : **« 3 reconduction(s) »** — 07 → 08 → 09, une par période, aucune sautée
  (le moteur boucle `cycleStep` jusqu'à rattrapage complet ; ces périodes porteront les
  factures L3).
- Après : `ACTIF | 2026-09 | 2026-10-01` — période courante = mois en cours, échéance repassée
  dans le futur ; ligne rabatexpress « Actif — échéance 2026-10-01 » — capture 01.

## Captures
- `01-rabatexpress-rattrape-echeance-future.png`

## Anomalies
Aucune.
