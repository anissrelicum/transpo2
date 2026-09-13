# TC-A15 — Simulateur : l'écart VOLUME / GRADUÉ

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A15)
- Avec la grille de TC-A13, saisir `600` dans le **Simulateur** : **1 800 DH** en lecture
  *Rétroactif*, rappel « (en par tranche : 2 700 DH) ». Basculer sur *Par tranche* inverse les
  deux montants.

## Obtenu
- Lecture **Rétroactif**, 600 commandes → **1 800 DH** (600 × 3 DH, palier atteint), rappel
  « (en par tranche : 2 700 DH) » (100×6 + 400×4,5 + 100×3) — capture 01.
- Bascule sur **Par tranche** → **2 700 DH** en principal, rappel « (en rétroactif : 1 800 DH) » —
  capture 02.
- Dialogue refermé par **Annuler** : aucun tarif publié.

## Captures
- `01-simulateur-retroactif-1800.png`, `02-simulateur-par-tranche-2700.png`

## Anomalies / incidents de test
Aucune anomalie applicative. Incident d'automatisation : les montants utilisent l'espace fine
insécable (U+202F) du format fr-FR — les regex de la spec ont été adaptées (`1\s?800`).
