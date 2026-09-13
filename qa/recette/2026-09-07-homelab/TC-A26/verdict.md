# TC-A26 — Régularisation

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A26)
- Sur un abonnement impayé ou suspendu, menu → **Réactiver**.
- Retour en **Actif** sur la période courante, motif effacé, connexion au tenant rétablie.

## Obtenu
- Avant : atlasfret **Suspendu** avec motif « Essai expiré sans souscription — suspendu après
  délai de grâce » — capture 01.
- Menu « … » → **Réactiver** : atlasfret repasse **Actif — échéance 2026-10-01** (période
  courante), motif effacé (`status_reason` NULL en base), bandeau rouge disparu, compteurs
  « 2 actifs », MRR 3 498 DH — capture 02.
- Connexion `/login?org=atlasfret` avec l'admin : **rétablie** (atterrissage /dashboard) —
  capture 03.

## Captures
- `01-avant-suspendu.png`, `02-apres-actif-motif-efface.png`, `03-connexion-retablie.png`

## Anomalies
Aucune.
