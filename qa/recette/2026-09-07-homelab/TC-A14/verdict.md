# TC-A14 — Grille non contiguë refusée

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A14)
- Forcer un trou (borne haute du palier 1 à `50` alors que le palier 2 commence à `101`).
- Message rouge « Paliers 1 et 2 non contigus : le suivant doit commencer à 51 », bouton
  **Publier le tarif** désactivé. L'appel API direct est également refusé (400).

## Obtenu
- **UI** : le message ne peut pas être provoqué dans l'éditeur — la saisie de « À = 50 » sur le
  palier 1 **recale automatiquement** le palier 2 à 51 (la grille reste contiguë par construction).
  Capture 01 : paliers 1–50 / 51–500 / 501 et au-delà, aucune erreur, publication possible sur
  une grille valide.
- **API directe** (grille trouée 1–50 / 101–500 / 501+) : refus **400** avec exactement le
  message attendu « Paliers 1 et 2 non contigus : le suivant doit commencer à 51. ».
- Dialogue annulé : rien n'a été publié — capture 02.

## Captures
- `01-tentative-trou-palier-1-a-50.png`
- `02-dialogue-annule-rien-publie.png`

## Anomalies / écarts
Écart bénin avec la formulation du plan : le message rouge n'est pas atteignable via l'UI car
l'éditeur **empêche le trou** (recalage automatique du palier suivant) plutôt que de le signaler.
Le contrôle de fond existe bien côté serveur (400 + message exact). Protection effective OK.
