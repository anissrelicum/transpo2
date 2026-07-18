# PRD — Transpo · Portail marchand

Retour à [PRD-00-Vue-Ensemble.md](PRD-00-Vue-Ensemble.md). Modèle de données et règles transverses : voir ce document, § 4 et § 5.

**Source analysée** : `transpo/lot4.jsx`. Interface `/merchant`, **responsive** (un seul jeu d'écrans, layout desktop et mobile partagés, testable via bascule de viewport dans le harnais de démo).

> **Interactivité** : entièrement fonctionnel (voir [PRD-00](PRD-00-Vue-Ensemble.md) §9). « Créer une commande » est branché au `Store` partagé (elle apparaît réellement dans « Mes commandes ») ; recherche et filtre de statut effectifs ; recharge du portefeuille, régénération de clé API, « Page de suivi publique » et téléchargements PDF déclenchent une action/toast.

---

## 1. Contexte

Le marchand (ex. "Boutique Zellige") est un e-commerçant ou commerçant physique qui sous-traite ses livraisons à Transpo. Il gère ses commandes en libre-service, sans intervention du dispatcher, et paie via un **portefeuille prépayé**.

## 2. Navigation

5 sections : Tableau de bord, Mes commandes, Portefeuille, Factures, API. Desktop : barre de navigation horizontale complète. Mobile : barre d'onglets basse (icônes seules).

## 3. Tableau de bord (`dashboard`)

Salutation personnalisée + 4 tuiles stat (commandes du mois, solde portefeuille avec CTA recharge, COD à reverser avec date du prochain virement, taux de réussite 30 jours) + liste des 5 dernières livraisons (statut, badge COD) + carte portefeuille condensée (solde, CTA recharger, COD en attente, dépenses du mois).

## 4. Nouvelle commande (`create`, assistant 3 étapes)

Version marchand du même assistant que côté admin (voir [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § 2.2), avec une différence clé : **l'adresse de retrait est pré-remplie** avec l'adresse de la boutique du marchand (callout explicite), le marchand ne saisit que la destination et les infos colis. Récapitulatif de prix live incluant **« Payé via portefeuille »** avec le solde disponible affiché en badge.

## 5. Mes commandes (`orders` → détail)

Liste desktop (table) ou cartes (mobile) avec recherche et filtre de statut. **Détail commande** : **code de suivi copiable en un clic**, avec bouton direct vers **« Page de suivi publique »** — c'est ce code que le marchand communique à son client final pour le suivi sans compte (voir [PRD-04](PRD-04-Client-Final.md)). Timeline de statut identique au reste de la plateforme. Bloc info : client/ville, encaissement (COD ou prépayé), date de création, livraison estimée.

## 6. Portefeuille (`wallet`)

Carte solde disponible en évidence (fond indigo plein), avec COD en attente et dépenses du mois. Recharge : montant libre ou raccourcis (500/1000/2000 DH), **modes de paiement** : carte bancaire, virement, CMI (Centre Monétique Interbancaire — spécifique au Maroc). Historique des mouvements (entrées : rechargements + reversements COD nets ; sorties : coût de chaque livraison), avec icône directionnelle et couleur.

**Règle** : chaque livraison **débite automatiquement** le portefeuille au moment de sa création (modèle prépayé, pas de facturation différée sur ce flux) — sauf pour le flux de facturation mensuelle classique (voir § 7) qui coexiste.

## 7. Mes factures (`invoices`)

Liste de factures mensuelles (référence, période, montant, statut : Brouillon/Payée/En litige). Téléchargement PDF. **Ouverture de litige** : dialogue avec motif structuré (montant incorrect, commande non reconnue, écart de reversement COD, autre) + détails libres, envoyé à l'équipe facturation (SLA 48h annoncé). Une facture déjà en litige ne peut pas en ouvrir un second (bouton désactivé).

## 8. Intégration API (`api`)

Pour les marchands techniques qui créent leurs commandes par programmation plutôt que via l'assistant UI.

- **Clé API secrète** : masquée par défaut (`sk_live_••••…`), bascule révéler/masquer, copier, régénérer (avec confirmation implicite par le style du bouton rouge).
- **Exemple de requête** `POST /v1/orders` avec payload JSON complet (pickup, dropoff, parcel avec `size` et `cod_amount`, `proof_level`).
- **Webhooks signés** : liste des événements souscrits (`order.assigned`, `order.delivered`, `order.failed`) avec URL cible et statut de santé (OK/Échec par appel récent).
- **Journal des appels** : méthode, endpoint, code de statut HTTP (coloré selon 2xx/4xx/5xx), horodatage.

**Point ouvert** : le payload d'exemple référence `proof_level: "photo_signature"` — confirmer que la nomenclature API (`photo_signature`) correspond bien à la valeur interne `photo_sig` utilisée côté app livreur (voir [PRD-Lot3](PRD-Lot3-App-Livreur.md) § Proof), sinon prévoir un mapping explicite.

## 9. Règles métier spécifiques au marchand

1. Le marchand ne voit **jamais** les coordonnées internes de dispatch (scoring livreur, zones) — son périmètre s'arrête à ses propres commandes.
2. Le code de suivi (8 caractères) est l'unique identifiant partagé avec le client final — il ne doit jamais exposer d'information sensible au-delà de ce que montre [PRD-04](PRD-04-Client-Final.md) § Suivi public.
3. Le portefeuille prépayé vs la facturation mensuelle post-payée — ✅ *clarifié dans la maquette* : un **mode de facturation par compte** a été ajouté (`lot4`). Le Dashboard et le Portefeuille affichent un badge **Prépayé / Post-payé** ; en prépayé, chaque livraison débite le portefeuille en temps réel ; en post-payé, le portefeuille est **inactif/grisé** et les livraisons sont regroupées sur la facture mensuelle (un callout l'explique). Le mode est piloté côté admin (voir [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § 22). **Réserve** : côté maquette, l'indicateur marchand (`localStorage`) et le contrôle admin ne partagent pas encore le même état — à unifier en production.
