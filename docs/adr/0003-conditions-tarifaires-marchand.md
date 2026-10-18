# ADR 0003 — Conditions tarifaires par marchand

Date : 2026-10-18 · Statut : accepté

## Contexte
Un transporteur ne facture pas tous ses marchands de la même façon : l'un paie la grille de
distance, un autre bénéficie d'une remise, un troisième paie un forfait par livraison. Le
produit n'avait qu'une grille par entreprise ; la cascade « prix fixe → remise → grille »
n'existait que dans le simulateur, et le prix n'était pas figé sur la commande (la facture le
recalculait à la grille par défaut).

## Décision
- Une **fiche marchand** (`merchants`, migration 0028) porte les conditions : mode `standard`
  (grille), `remise` (grille × (1 − remise)) ou `forfait` (montant fixe par livraison), et une
  **commission COD** facultative (à défaut, celle de l'entreprise).
- **Forfait + suppléments** : en mode forfait, les suppléments fragile et programmé s'ajoutent
  (décision produit du 2026-10-17). La TVA s'applique dans tous les modes.
- Le **prix est calculé par l'API à la création** de la commande, aux conditions du marchand,
  et **figé** sur la commande (`price_*`, `pricing_mode`, `distance_km`). La facture le reprend ;
  changer les conditions ne réécrit pas le passé. Commandes antérieures : recalcul à la grille.
- Distance facturée : une seule règle partagée (`courseDistanceKm`) — deux épingles → distance
  routière estimée, sinon ville à ville — pour que devis affiché et prix facturé coïncident.
- Le marchand est désigné par son **nom** (clé historique des commandes, comptes et factures),
  non modifiable. Toute fiche manquante est créée aux conditions standard.

## Droits
| Rôle | Fiches | Modifier | Ses conditions |
|---|---|---|---|
| ADMIN, COMPTABLE | lecture | oui | — |
| DISPATCHER | lecture | non | — |
| MERCHANT | non | non | lecture (`/v1/merchants/me`) |

Un compte MERCHANT ne choisit jamais le marchand d'un devis ou d'une commande : c'est celui de
son jeton. Chaque changement de conditions est tracé au journal d'audit (avant → après).

## Limites connues
- Le portefeuille et la facture du portail calculent la commission sur le COD, la facture console
  sur le montant des livraisons : deux modèles d'argent à réconcilier (constat de recette du
  2026-10-15, hors périmètre de cette décision).
