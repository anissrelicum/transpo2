# TC-A09 — Changement de plan à l'échéance

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A09)
- Menu → **Souscrire / changer de plan** → `Transporteur` → **Valider** : le plan courant
  **ne change pas**, la colonne Plan affiche « → Transporteur à l'échéance ».
- Cocher *Appliquer immédiatement* applique le changement tout de suite.
- Choisir le plan déjà en cours, sans la case, laisse **Valider** désactivé.

## Obtenu
- Dialogue sur abonnement actif : description « Le changement prend effet à la prochaine échéance
  (2026-10-01) — le mois en cours reste facturé au plan actuel », plan courant Entreprise
  présélectionné, **Valider désactivé** tant que le plan choisi = plan en cours et case non cochée —
  capture 01.
- Choix de `Transporteur` sans la case → Valider actif — capture 02. Après validation : plan
  courant **toujours Entreprise** (2 499 DH/mois, MRR 2 499 DH) avec la mention
  **« → Transporteur à l'échéance »** — capture 03.
- Réouverture + `Transporteur` + case **Appliquer immédiatement** — capture 04 : le plan devient
  **Transporteur** (899 DH/mois, MRR 899 DH) immédiatement, la mention « à l'échéance » disparaît —
  capture 05.
- Restauration à **Entreprise** (immédiat) en fin de cas pour préserver l'état attendu par TC-A11 —
  capture 06.

## Captures
- `01-plan-en-cours-valider-desactive.png`, `02-transporteur-selectionne-a-echeance.png`
- `03-plan-courant-inchange-changement-a-echeance.png`, `04-appliquer-immediatement-coche.png`
- `05-changement-immediat-transporteur.png`, `06-retour-entreprise.png`

## Anomalies / incidents de test
Aucune anomalie applicative. Incident d'automatisation (comme TC-A08) : le `router.refresh()`
post-action est très lent sur le homelab (> 20 s) ; la spec recharge la page avant chaque contrôle.
Comportement produit à surveiller (non déclaré en bug) : l'utilisateur réel voit la liste se
mettre à jour avec une latence perceptible après validation.
