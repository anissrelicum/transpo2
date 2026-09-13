# TC-A08 — Convertir l'essai en abonnement

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A08)
- Menu « … » de `rabatexpress` → **Convertir l'essai** → plan `Entreprise` → **Valider**.
- La colonne **Abonnement** passe de « Essai — n j restants » à **Actif — échéance le 1er du mois
  prochain** ; le plan affiché devient `Entreprise`.

## Obtenu
- Avant : rabatexpress en **Essai — 14 j restants**, plan Transporteur — capture 01.
- Dialogue « Convertir l'essai » ouvert, description « L'essai se transforme en abonnement actif
  dès aujourd'hui », plan **Entreprise — 2 499 DH/mois** sélectionné — capture 02.
- Après **Valider** : rabatexpress **Actif — échéance 2026-10-01** (1er du mois prochain),
  plan **Entreprise** (2 499 DH/mois, commandes illimitées) ; KPI « Revenu mensuel » passe à
  **2 499 DH**, compteurs « 1 actifs · 1 en essai » — capture 03.

## Captures
- `01-avant-essai-transporteur.png`
- `02-dialogue-conversion-entreprise.png`
- `03-apres-actif-entreprise.png`

## Anomalies / incidents de test
Aucune anomalie applicative. Incident d'automatisation : à la 1ʳᵉ exécution de la spec, l'action
a réussi côté serveur mais l'assertion post-`router.refresh()` a expiré (refresh Next.js lent) ;
la capture d'échec montrait déjà l'état converti. L'état final a été revérifié par une spec de
contrôle (`a08-verif.spec.ts`) qui fournit la capture 03.
