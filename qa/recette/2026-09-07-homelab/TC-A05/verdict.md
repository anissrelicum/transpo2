# TC-A05 — Slug en doublon refusé

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A05)
- Re-provisionner `rabatexpress`.
- Erreur « Tenant déjà existant », aucune duplication dans la liste.

## Obtenu
- Dialogue rempli avec le slug `rabatexpress` (nom « Rabat Express Bis ») — capture 01.
- L'API répond 409 et l'UI affiche une alerte explicite :
  « Tenant déjà existant : rabatexpress » (message capturé par le test) — capture 02.
- Aucune duplication : une seule ligne `rabatexpress` dans la liste, aucune ligne
  « Rabat Express Bis » ; `platform.tenants` ne contient qu'une ligne pour ce slug — capture 03.

## Captures
- `01-dialogue-doublon-rempli.png`
- `02-doublon-refuse-dialogue-ouvert.png`
- `03-liste-sans-duplication.png`

## Anomalies
Aucune.
