# Portrail — Ce qu'il faut pour une application sérieuse

*19 octobre 2026. Liste à cocher.*

- **Qui** : 👤 = toi (compte, signature, argent, décision) · 🤖 = moi (code, déploiement, rédaction).
- **Durée** : estimation de travail effectif.

**Règle : rien de la colonne P0 ne manque le jour où le premier client démarre.**

---

## P0 — Avant le premier client

### 1. Un vrai serveur, pas le homelab

- [ ] 👤 **Compte Scaleway.** Crée un serveur DEV1-L (≈ 350 DH/mois), ou donne-moi une clé d'accès que tu pourras révoquer.
- [ ] 👤 **Acheter le domaine** `portrail.app`. Prévoir aussi `getportrail.com` pour le protéger.
- [ ] 🤖 **Installer la production.**
  - Site, API, console, base de données et moteur d'itinéraires sur ce serveur.
  - Certificats HTTPS valides (Let's Encrypt), sous-domaines `app.`, `api.` et un sous-domaine par société.
  - ½ journée.
- [ ] 🤖 **Sauvegarde automatique de la base chaque nuit**, copiée hors du serveur.
  - Restauration testée pour de vrai une fois.
  - Procédure écrite « serveur perdu → tout remonter ».
  - ½ journée.
- [ ] 🤖 **Surveillance.**
  - Alerte si le site ou l'API ne répond plus (service gratuit de type UptimeRobot).
  - Journal des erreurs de l'API.
  - Remontée des plantages de l'app livreur.
  - ½ journée.
- [ ] 🤖 **Cartes.** Remplacer CARTO par un fond de carte hébergé chez nous, **avant le 30 novembre** : au-delà de la limite gratuite, CARTO devient payant (500 $/mois).
- [ ] 🤖 **Purge des positions GPS de plus de 30 jours.** La base grossit sinon, et la loi 09-08 demande de ne pas garder la position plus que nécessaire.
- [ ] 👤 **Révoquer et recréer toutes les clés partagées en clair dans nos échanges** : Scaleway, EAS, Deepgram, ElevenLabs.
- [ ] 🤖 **Mettre les nouvelles clés en variables d'environnement**, jamais dans le code.

### 2. L'app livreur installable proprement

- [ ] 👤 **Compte développeur Google Play** (25 $, une fois), au nom de la société.
- [ ] 🤖 **Fiche Play Store** : nom, description, captures, icône, politique de confidentialité en ligne, catégorie, classification.
- [ ] 🤖 **Clé de signature de l'app sauvegardée en lieu sûr.** La perdre empêche toute mise à jour. Numérotation des versions.
- [ ] 🤖 **Bugs connus à corriger** :
  - [ ] « Arrêt suivant » ouvre Google Maps au lieu de ramener à la journée ;
  - [ ] « Arrêt introuvable » en revenant de Google Maps ;
  - [ ] le temps de conduite compte même à l'arrêt (le compter seulement quand le GPS montre un déplacement).
- [ ] 👤🤖 **Tester sur 2 ou 3 vrais téléphones Android bas de gamme**, en 3G et hors réseau. C'est le matériel réel des livreurs.

### 3. Le minimum juridique

- [ ] 👤 **Créer la SARL AU** avec une fiduciaire : RC, ICE, identifiant fiscal, compte bancaire pro.
- [ ] 🤖 **Contrat d'abonnement (conditions générales)**, à faire relire par un juriste.
  - Ce que comprend chaque offre.
  - Disponibilité visée de 99 %, sans garantie absolue.
  - Responsabilité plafonnée aux 12 derniers mois payés.
  - Résiliation et restitution des données.
- [ ] 🤖 **Accord de traitement des données** : la société cliente est responsable de ses données, Portrail est son sous-traitant (loi 09-08).
- [ ] 🤖 **Politique de confidentialité et mentions légales sur le site**, avec le nom de la société, l'adresse et l'ICE une fois la SARL créée.
- [ ] 👤 **Déclaration à la CNDP**, y compris le transfert des données vers l'hébergement en France.
- [ ] 👤 **Dépôt de la marque Portrail à l'OMPIC** (classes 9, 39 et 42).

### 4. Pouvoir signer, installer, facturer

- [ ] 🤖 **Déployer l'essai de 30 jours.** Il est déjà dans le code, il reste à le mettre en ligne. Archiver les anciennes formules à 299, 899 et 2 499 DH.
- [ ] 🤖 **Création d'une société cliente en 10 minutes**, avec une procédure écrite :
  - création de l'espace et du compte administrateur ;
  - import des marchands et des livreurs depuis Excel ;
  - zones, tarifs, délais.
- [ ] 🤖 **Facturation de nos abonnements.** Une facture mensuelle par client, PDF avec mentions légales et TVA 20 %. Au début, un modèle de facture suffit ; la facturation automatique dans la console viendra ensuite.
- [ ] 🤖 **Guide de démarrage d'une page pour le patron** et **un pour le livreur**, en français et en darija, avec captures. Ces guides restent privés : on les donne aux clients, on ne les publie pas.
- [ ] 👤 **Numéro WhatsApp Business dédié** au support et à la vente.

### 5. Vérifier que tout marche vraiment

- [ ] 🤖 **Recette complète de la console, écran par écran**, comme on vient de le faire pour le Profil : chaque bouton fait quelque chose de réel, aucune donnée de démonstration ou fictive affichée.
- [ ] 🤖 **Recette complète du portail marchand** et du **suivi client**.
- [ ] 🤖 **Vérification en arabe et en thème sombre** sur tous les écrans. Jamais faite de bout en bout.
- [ ] 🤖 **Test de charge** : 20 livreurs, 5 000 commandes par mois, 3 sociétés en parallèle. On vérifie qu'il n'y a ni lenteur ni mélange de données entre sociétés.
- [ ] 🤖 **Tests automatiques au vert** (déjà en place sur GitHub) avant chaque mise en production.

---

## P1 — Pendant les clients pilotes (mois 1 à 2)

- [ ] 🤖 **SMS / WhatsApp au client final** (« votre colis arrive ») : brancher un fournisseur. Les modèles de messages existent déjà. C'est le premier levier contre les retours.
- [ ] 🤖 **Impression des étiquettes et des bons** de ramassage et de livraison.
- [ ] 🤖 **Limiter les fonctionnalités selon la formule** (Démarrage, Pro, Business). Aujourd'hui, tout le monde a tout.
- [ ] 🤖 **Tableau de bord de nos propres indicateurs** : clients actifs, commandes par client, essais qui expirent, factures impayées.
- [ ] 🤖 **Rapport mensuel par client** (« ce mois-ci : X livraisons, Y DH encaissés, Z écarts ») : il donne envie de rester abonné.
- [ ] 👤 **Point hebdomadaire avec chaque pilote.** On mesure avant et après : temps de dispatch, appels, écarts de caisse.

## P2 — Quand les clients le demandent (mois 3 et plus)

- [ ] 🤖 **Intégrations** : Shopify, YouCan, eGrow, API publique documentée et notifications automatiques vers les outils des marchands (webhooks).
- [ ] 🤖 **App livreur sur iPhone** (compte Apple : 99 $/an).
- [ ] 🤖 **Assistant IA** (copilote du dispatcher, saisie d'une commande depuis un message WhatsApp) : c'est à ce moment-là qu'on pourra parler d'« IA ».
- [ ] 🤖 **Deuxième serveur et base de données gérée** au-delà de 15 à 20 clients.
- [ ] 🤖 **Confirmation de commande avant expédition** (WhatsApp interactif).

---

## Ordre conseillé pour les 10 prochains jours

1. 👤 Compte Scaleway + domaine `portrail.app` + révocation des clés → 🤖 mise en production, sauvegardes, surveillance.
2. 🤖 Cartes hébergées chez nous + corrections de l'app livreur → 👤 compte Google Play → 🤖 publication.
3. 🤖 Recette complète de la console et du portail (corrections au fil de l'eau).
4. 👤 SARL + fiduciaire, en parallèle → 🤖 contrat, conditions de confidentialité, modèle de facture.
5. 🤖 Procédure d'installation d'un client + guides → 👤 premiers messages aux prospects.
