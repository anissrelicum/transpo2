# Portail marchand

Le marchand n'a pas d'application séparée : il entre dans la **même** console Next.js, sous
`/portail`, avec son propre layout (bandeau « Espace marchand », navigation à onglets,
aucune barre latérale d'exploitation).

Il se connecte par le formulaire de connexion habituel, sur le sous-domaine de son
transporteur. La racine `/` le redirige vers `/portail`, et le layout de la console
d'exploitation le renvoie ici s'il tente d'y entrer.

## Le cloisonnement

C'est le point qui compte : **toutes les vues sont bornées au claim `merchant` du jeton**,
résolu côté serveur. Aucun champ contrôlé par le client ne désigne le marchand.

- `/v1/merchant/*` est réservé au rôle `MERCHANT` et scopé à son claim ;
- un compte marchand sans rattachement reçoit 403 « Compte marchand non rattaché à un
  marchand. » — il ne voit pas « toutes les commandes » par défaut ;
- les routes d'exploitation (`/v1/orders`, `/v1/cash`, `/v1/drivers`, `/v1/dispatch`…) lui
  répondent 403, et les écrans correspondants (`/dashboard`, `/orders`, `/cash`) le
  renvoient au portail.

Un compte marchand se crée depuis **Utilisateurs & rôles** de la console d'exploitation :
c'est la porte d'entrée du portail.

## Les écrans

### Tableau de bord — `/portail`

Quatre indicateurs, tous dérivés des seules commandes du marchand : volume total, livrées
(avec taux de réussite), en cours chez le transporteur, COD restant à encaisser. Plus les
six dernières commandes.

Le taux de réussite se calcule sur les commandes **terminées** (livrées + annulées), pas
sur le volume total — une commande encore en route ne compte pas contre le transporteur.

### Mes commandes — `/portail/commandes`

Liste des commandes confiées au transporteur, avec leur statut et leur COD. Le **code de
suivi** est copiable : c'est celui que le marchand transmet à son client.

### Nouvelle commande — `/portail/commandes/nouvelle`

Le même assistant en trois étapes que la console, en mode « marchand ». Le sélecteur de
marchand n'apparaît pas : l'API force celui du compte, quelle que soit la valeur envoyée.

Cet écran a été ajouté après coup — l'API autorisait déjà le rôle `MERCHANT` à déposer une
commande, mais aucun écran ne le proposait, et un marchand devait appeler son transporteur
pour faire saisir sa course.

### Portefeuille — `/portail/portefeuille`

Contre-remboursements encaissés pour le compte du marchand, **nets de commission** :

```
COD encaissé  −  commission (taux de l'organisation)  =  net à reverser
```

Le détail ne liste que les commandes dont le COD a **réellement** été encaissé ; les COD
en attente sont comptés à part.

### Facture — `/portail/facture`

Décompte dérivé des livraisons effectives : nombre de livraisons, COD encaissé, commission,
net HT, TVA, TTC.

> Le document est **indicatif, non fiscal**, et le bandeau le dit : il n'est pas figé, il
> évolue à chaque nouvelle livraison. La facture opposable est celle qu'émet le
> transporteur depuis `/invoices`.

## Ce que le PRD décrit et qui n'existe pas

Le PRD-02 prévoit un portail plus large. Deux écarts méritent d'être connus :

- **Pas d'écran « Intégration API »** : ni clé secrète affichée, ni payload d'exemple, ni
  configuration de webhooks, ni journal d'appels. Un marchand ne peut pas s'auto-provisionner
  un accès API depuis le portail.
- **Pas de recharge de portefeuille prépayé.** Le portefeuille est une vue de ce que le
  transporteur doit au marchand (COD net), pas un solde prépayé rechargeable. Le mode de
  facturation prépayé/post-payé existe côté console (`/invoices`, carte « Mode de
  facturation par marchand ») mais n'a pas d'effet sur cet écran.
