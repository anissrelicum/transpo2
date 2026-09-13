# TC-A10 — Facturation plateforme

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A10)
- `/saas/billing` : une ligne par organisation, montant mensuel cohérent avec le plan,
  usage (nb de commandes) à 0 à ce stade.

## Obtenu
- **2 lignes**, une par organisation — capture 01 :
  - Rabat Express (`rabatexpress`) : plan **Entreprise**, statut **ACTIF**, consommation
    « sans quota » (plan illimité), **0** commande, montant **2 499 DH** — cohérent avec le plan.
  - Tanger Logistique (`tangerlog`) : plan **TPE Coursier**, statut **ESSAI**, consommation
    **0 / 500**, montant **—** : non facturée tant qu'elle est en essai (seules les organisations
    actives sont facturées, logique assumée du calcul provisoire pré-L3).
- KPI : Revenu mensuel **2 499 DH** (1 organisation facturée), Organisations **2**,
  Commandes **0**, Dépassements **0** — capture 01.

## Captures
- `01-facturation-plateforme.png`

## Anomalies
Aucune. (Interprétation de l'attendu : le « montant cohérent avec le plan » s'applique aux
organisations facturées ; une organisation en essai affiche « — », ce qui est cohérent avec la
règle métier affichée. À noter pour L3 : les factures plateforme arrivent avec le lot L3.)
