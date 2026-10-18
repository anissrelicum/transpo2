# ADR 0006 — Délais de livraison par commande

Date : 2026-10-18 · Statut : accepté

## Contexte
Une commande n'avait aucune contrainte de temps : affectée, elle pouvait attendre des heures
sans que rien ne le signale. Un restaurant (livrer 30 min après le retrait), une course
express (dans l'heure) et des documents (avant midi) n'ont pas les exigences d'un colis du
jour. Le « SLA » des analytics mesurait le taux de réussite, pas la ponctualité.

## Décision
- **Quatre types de délai** : sans contrainte, N min après la prise en charge, N min après la
  commande, heure limite (le lendemain si l'heure est passée). Plus un **retrait limite**
  facultatif (N min après la commande) : le temps perdu avant la prise en charge compte aussi.
- **Défaut par marchand, modifiable par commande.** La règle est FIGÉE sur la commande à sa
  création ; les échéances (`due_at`, `pickup_due_at`) sont calculées par le serveur, dans le
  fuseau de l'entreprise. L'échéance « après retrait » naît au passage en RECUPEREE.
- **Urgent** (échéance dans l'heure, ou délai après retrait ≤ 60 min) : l'affectation
  automatique propose au livreur **le plus proche** (zone et capacité toujours exigées) ; les
  échéances les plus proches sont placées en premier. Le reste garde la règle d'équité (ADR 0004).
- **Veille des retards** (passe d'une minute) : « à risque » dès que l'arrivée estimée (dernière
  position GPS, vol d'oiseau × 1,3 à 25 km/h, arrêts forfaitaires) dépasse l'échéance, puis
  « en retard ». Alerte console au dispatcher, SMS au client, message au marchand (e-mail, sinon
  SMS) — une seule fois par étape, horodatage posé par UPDATE conditionnel (multi-répliques).
- **Prix** : supplément express par type de délai, négocié par marchand, ajouté au prix figé.
- **Pénalité** : à la livraison, minutes de retard et pénalité (fraction du prix HT) figées sur
  la commande ; la facture marchand les déduit (« dont remises pour retard »).
- **App livreur** : compte à rebours sur chaque arrêt ; les échéances dans l'heure passent en
  tête de la tournée calculée.

## Conséquences
Migration tenant 0030. L'estimation d'arrivée est volontairement simple (pas de moteur de
routage) : elle prévient tôt, quitte à alerter un peu trop. Un moteur d'itinéraire réel pourra
remplacer `estimerArrivee` sans changer le reste.
