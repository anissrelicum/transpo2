# TC-A21 — Tout tenant naît en essai daté

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A21)
- Provisionner une organisation en choisissant le plan `Transporteur`.
- Abonnement **Essai — 14 j restants**, et non « Actif » ; le plan visé est bien `Transporteur`
  (cible de la conversion, pas le statut).

## Obtenu
- Organisation dédiée aux cas A-ter provisionnée : `atlasfret` / Atlas Fret / Casablanca /
  plan Transporteur, admin Salma Idrissi `admin@atlasfret.ma` — capture 01.
- Mot de passe temporaire admin affiché une seule fois (consigné dans `COMPTES.md`) — capture 02.
- Ligne : **Essai — 14 j restants**, plan **Transporteur** (899 DH/mois, 5 000 cmd/mois) ;
  pas de badge Actif — capture 03.
- Cohérent avec TC-A03 (rabatexpress, Transporteur, Essai 14 j) et TC-A06 (tangerlog, TPE
  Coursier, Essai 14 j, aujourd'hui 13 j).

## Captures
- `01-provisioning-atlasfret-transporteur.png`, `02-admin-atlasfret-cree.png`
- `03-atlasfret-essai-14j-transporteur.png`

## Anomalies
Aucune.
