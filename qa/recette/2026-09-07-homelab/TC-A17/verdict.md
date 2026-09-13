# TC-A17 — Date d'effet antérieure refusée

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A17)
- Créer une version avec une date d'effet ≤ celle de la version courante.
- Champ en rouge « Doit être postérieure au AAAA-MM-JJ », publication impossible.

## Obtenu
- Sur `pay-as-you-go` (v1 effective le 2026-09-08), la date pré-remplie à aujourd'hui
  (08/09/2026, non postérieure) déclenche le message rouge
  **« Doit être postérieure au 2026-09-08 (v1). »** et **Publier le tarif** est désactivé —
  capture 01.
- Une date encore antérieure (01/09/2026) → même refus.
- Une date postérieure (09/09/2026) → le contrôle se lève, Publier redevient actif — capture 02.
- Dialogue annulé : rien publié.

## Captures
- `01-date-non-posterieure-refusee.png`, `02-date-posterieure-acceptee.png`

## Anomalies
Aucune.
