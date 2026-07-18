---
name: transpo-offline-sync
description: >
  Stratégie offline-first de l'app livreur Transpo : file d'actions locale, idempotence, resynchronisation
  et résolution des conflits. À CONSULTER pour toute action livreur pouvant se produire hors-ligne
  (statut, preuve, COD, scan, dépôt), la file de synchro, ou un endpoint qui reçoit des rejeux.
  Déclencheurs : "offline", "hors-ligne", "sync", "synchronisation", "file d'attente", "idempotence",
  "conflit", "resync", "outbox".
---

# Transpo — Offline-first (app livreur)

Règle métier (`transpo-domain`) : *toute action livreur fonctionne hors-ligne, horodatée, mise en file, rejouée sans perte ni doublon.* Le PRD note la **résolution de conflits comme « non spécifiée »** — ce skill la définit.

## Principe (outbox pattern)
- Store local sur l'appareil (**SQLite** ou **MMKV** en RN) : l'état des missions + une **outbox** d'actions en attente.
- Chaque action mutante (changement de statut, preuve, encaissement COD, scan, dépôt caisse) est **écrite localement d'abord** (UI optimiste), puis mise en file.
- À la reconnexion : envoi séquentiel **par entité** (ordre préservé), avec **backoff** en cas d'échec réseau.

## Idempotence (obligatoire)
- Chaque action porte une **`Idempotency-Key`** (uuid généré à la création locale). Le serveur **dédoublonne** : rejouer la même clé ne produit aucun effet en double (voir `transpo-api`).
- Les tests rejouent une action pour prouver l'absence de doublon (`transpo-testing`).

## Résolution de conflits — par type d'action
- **Changements de statut** : le serveur est **autoritaire sur le cycle de vie**. Il refuse les transitions invalides ou hors-ordre (impossible de passer `LIVREE` avant `RECUPEREE`). Si l'état serveur a déjà avancé, l'état serveur gagne et l'app se **réaligne** (+ notification au livreur). On horodate côté client pour l'audit, mais l'ordre canonique est celui du lifecycle serveur.
- **Preuve & COD** : actions **additives** (on attache photos/signature/montant) → peu de conflit ; le serveur les rattache à la commande si le statut le permet, sinon les met en attente.
- **Scan** : idempotent par (code colis, phase) ; un re-scan ne recrée rien.
- **Dépôt caisse** : une session ne peut être déposée qu'une fois → clé d'idempotence sur la session.
- Cas non résoluble automatiquement (ex. commande annulée côté dispatch pendant que le livreur la livrait hors-ligne) → **flag serveur + tâche de réconciliation** côté dispatch, jamais d'écrasement silencieux.

## UI (déjà maquettée, `lot3`)
Bandeau « Hors ligne », liste des actions en file (horodatées), bouton « Forcer la synchronisation » (spinner). Ne jamais bloquer le livreur : il continue de travailler, la file se vide au retour réseau.

## À faire côté backend
Endpoints tolérants au rejeu (idempotence), validation stricte du lifecycle, file de réconciliation pour les conflits, horodatage serveur + client conservés.
