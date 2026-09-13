# TC-A13 — Créer un plan à l'usage avec paliers

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A13)
- `/saas/plans` → **Nouveau plan** → libellé FR `Pay as you go`, libellé AR, code auto-rempli
  `pay-as-you-go` → **Créer le plan**. Puis menu « … » → **Nouvelle version de tarif** → mode
  **À l'usage** → 3 paliers : 1–100 à `6`, 101–500 à `4.50`, 501+ à `3` → **Publier le tarif**.
- Le bandeau ambre « plan sans tarif » disparaît ; la carte affiche « À l'usage — dès 3 DH/cmd »
  et « 3 paliers · rétroactif ».

## Obtenu
- Création : le code `pay-as-you-go` est **auto-rempli** depuis le libellé FR — capture 01.
- Avant publication : bandeau ambre « 1 plan(s) sans tarif — Pay as you go » — capture 02.
- Éditeur de paliers : 3 paliers saisis (1–100 à 6 DH, 101–500 à 4,50 DH, 501 et au-delà à 3 DH) ;
  la borne haute du palier 2 fixée à 500 recale automatiquement le palier 3 à 501 — capture 03.
- Après **Publier le tarif** : bandeau disparu ; ligne `pay-as-you-go` = **À l'usage — dès
  3 DH/cmd**, **3 paliers · rétroactif**, Tarif v1 depuis le 2026-09-08, 0 abonné — capture 04.

## Captures
- `01-nouveau-plan-code-auto.png`, `02-bandeau-plan-sans-tarif.png`
- `03-editeur-3-paliers.png`, `04-plan-paye-as-you-go-publie.png`

## Anomalies
Aucune. Prérequis A-bis vérifié en TC-A11 : les 4 plans historiques étaient déjà en base
(migrate-plans exécuté), inutile de le relancer.
