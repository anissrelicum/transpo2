# TC-A16 — Le prix est gelé pour les abonnés

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A16)
- Sur un plan ayant ≥ 1 abonné (Entreprise, 1 abonné = rabatexpress), créer une **v2** à un tarif
  différent avec date d'effet au lendemain → **Historique des tarifs**.
- v1 passe en période fermée (`… → veille`) mais **conserve ses abonnés** ; v2 est « courante »
  avec 0 abonné. Aucune facture existante n'est modifiée.

## Obtenu
- Dialogue v2 : « La version v1 sera close la veille de la date d'effet. Les 1 abonné(s) actuels
  **gardent leur prix** » — capture 01.
- v2 publiée : Forfait **2 599 DH/mois**, date d'effet 2026-09-09 — capture 02.
- Historique des tarifs Entreprise — capture 03 :
  - **v1** : Forfait 2 499 DH/mois, période `2026-09-07 → 2026-09-08` (fermée à la veille),
    **1 abonné** conservé.
  - **v2 courante** : Forfait 2 599 DH/mois, période `2026-09-09 → …`, **0 abonné**.
- Pas de facturation plateforme émise à ce stade (L3) : rien à modifier, calcul provisoire
  inchangé côté abonné.

## Captures
- `01-dialogue-v2-abonnes-gardent-prix.png`, `02-v2-2599-effet-lendemain.png`
- `03-historique-v1-fermee-v2-courante.png`

## Anomalies
Aucune.
