# PRD — Transpo · Console transport (Admin & Dispatcher)

Retour à [PRD-00-Vue-Ensemble.md](PRD-00-Vue-Ensemble.md). Modèle de données et règles transverses : voir ce document, § 4 et § 5.

**Sources analysées** : `transpo/lot1.jsx` (Commandes), `lot2.jsx` (Dispatch/Zones), `lot6.jsx` (Flotte/Tarif/Facturation/Notifications/Users), `lot7.jsx` (Tournées), `lot8.jsx` (Cash), `lot9.jsx` (Hub), `lot10.jsx` (Retours), `lot12.jsx` (Analytics), `lot13.jsx` (Fraude), `lot14.jsx` (PC Flotte).

> **Interactivité** : tous les écrans de cette console sont désormais fonctionnels (voir [PRD-00](PRD-00-Vue-Ensemble.md) §9). En particulier : recherche globale et cloche du bandeau branchées ; filtres Ville/Marchand/Livreur et pagination réels sur la liste des commandes ; actions de statut effectives sur Hub (déplacement de colis), Retours, Cash (dépôt), Fraude (enquête/blanchir) ; zoom carte et « Gérer les zones » sur le PC flotte ; exports → toast de confirmation.

**Rôles** : Administrateur (accès complet) et Dispatcher (Commandes, Dispatch, lecture seule Chauffeurs) partagent la même console via un système de permissions par rôle (voir § Utilisateurs & rôles). Un troisième rôle, Comptable, n'a accès qu'à Facturation et Tarification (lecture).

---

## 1. Tableau de bord (`dashboard`)

Vue d'atterrissage : 5 KPI (commandes du jour, en cours, livrées, échouées, COD collecté) + graphique d'activité par heure (pic visuel) + liste des commandes urgentes (clic → détail commande) + panneau conformité flotte (alertes assurance/CT/permis expirés, cliquables) + suivi COD du jour (encaissé vs à encaisser, barres de progression) + accès rapide au reversement marchands.

**Règle** : les alertes de conformité (assurance expirée, CT proche, permis à renouveler) remontent ici en priorité — c'est la vue de sécurité opérationnelle quotidienne de l'admin.

## 2. Commandes (`orders` → `order-create` → `order-detail`)

### 2.1 Liste (dense, FR/AR)
Recherche libre (réf/code/marchand/téléphone), filtres Statut/Ville/Marchand/Livreur/Date, sélection multiple avec actions groupées (**Assigner en masse** au premier livreur disponible, **Mettre en attente**), menu par ligne (Voir détail, Assigner, Mettre en attente, Dupliquer, Annuler, **Supprimer — réservé admin**, désactivé pour dispatcher). Pagination.

### 2.2 Création (assistant 3 étapes)
1. **Point de retrait** : contact, téléphone, adresse, ville, position GPS, notes livreur.
2. **Point de livraison** : idem côté destinataire + créneau souhaité.
3. **Colis & options** : taille (Petit/Moyen/Grand/Très grand — détermine le tarif de base), description, type de véhicule requis, **niveau de preuve exigé** (aucune/photo/signature/photo+signature — propagé jusqu'à l'app livreur), option fragile (+15 DH), livraison programmée (date+créneau), montant COD.

Panneau de droite : **récapitulatif de prix en temps réel** (base taille + distance×4,50 DH/km + option fragile), callout COD si applicable.

### 2.3 Détail commande (6 onglets)
En-tête : statut, code de suivi copiable, actions contextuelles (**Faire progresser** le statut si assigné, **Encaisser le COD** si en livraison avec COD non payé, Mettre en attente, **Assigner** via dialogue de scoring, **Annuler** avec confirmation).

- **Détails** : retrait / livraison / colis / encaissement, en 4 blocs.
- **Suivi GPS** : carte Leaflet avec position livreur + destination, popup temps réel.
- **Preuve de livraison** : galerie de photos (remplies/vides selon niveau exigé) + statut signature.
- **Traçabilité** : timeline de scans horodatés et géolocalisés (retrait → entrée hub → sortie hub/quai → chargement tournée → remise client).
- **Historique** : journal d'événements avec auteur (API marchand, dispatcher, livreur).
- **Facturation** : décomposition du prix (base + option − remise = net HT + TVA 20% = TTC), rattachement à une facture.

**Dialogue d'assignation** : classement automatique de 3 livreurs par score de compatibilité (0-100) = zone (40 pts) + disponibilité (≤30) + shift actif (20) + faible charge (10), avec détail visuel de la décomposition par barre segmentée colorée.

## 3. Dispatch (`dispatch` → `dispatch-suggest`) et Zones (`zones`)

### 3.1 Carte temps réel
Carte Leaflet (Casablanca par défaut) avec marqueurs livreurs (couleur = statut) et commandes non affectées (losange bleu). Panneau latéral rétractable listant les commandes non affectées avec bouton **Affecter** → écran de suggestion. Légende et contrôles de zoom superposés.

### 3.2 Suggestion automatique
Reprend le même algorithme de scoring que le détail commande, présenté en plein écran avec carte estompée en fond. Section **« Exclus de la suggestion »** listant les livreurs disponibles mais écartés avec motif explicite (en congé, compte inactif, véhicule incompatible avec la taille du colis) — **transparence de l'algorithme obligatoire**, pas une boîte noire.

### 3.3 Éditeur de zones
Découpage géographique en polygones dessinables sur carte (Région → Province/préfecture → Commune, données administratives marocaines réelles en placeholder). Chaque zone a un nom bilingue FR/AR, une couleur, une liste de livreurs affectés (ajout/retrait via popover). Actions : créer, dessiner un polygone, supprimer une zone, enregistrer.

## 4. PC de commandement flotte (`fleet`, temps réel + géofencing)

Carte avec géofences (polygones de zone) + positions de tous les livreurs, rafraîchies en continu (interpolation de trajet simulée pour la démo). **Mode plein écran** dédié avec barre de lecture/pause et roster flottant.

Alertes automatiques : **sortie de géofence** (livreur hors de sa zone assignée), **excès de vitesse**, arrêt prolongé. Flux d'événements horodaté (`EnterIcon`/`ExitIcon`/vitesse/pause). Panneau détail livreur sélectionné : statut, vitesse, **niveau de batterie** (alerte si < 30%), ETA, mission en cours.

**Règle** : une sortie de zone déclenche un callout rouge avec action rapide « Localiser » — c'est un signal d'alerte opérationnelle, pas juste informatif.

## 5. Tournées (`planner`, planificateur multi-arrêts desktop)

Distinct de l'écran "Ma tournée" côté mobile (même algorithme, vue admin). Carte + panneau ordonnable (drag conceptuel via boutons haut/bas) des arrêts d'un livreur donné, avec bouton **Optimiser l'ordre** (plus proche voisin depuis le hub, retour au hub inclus dans le calcul de distance). Bandeau récap : distance, durée estimée (vitesse urbaine 22 km/h + 4 min/arrêt), nombre d'arrêts, taux de remplissage véhicule, gain en km si optimisé. COD total à collecter affiché en pied de panneau. Distingue visuellement les arrêts **Retrait** (cyan) des **Livraison** (indigo), avec fenêtres horaires (créneaux client) affichées en badge.

## 6. Véhicules (`vehicles`)

Table : plaque (format marocain validé par regex `NNNN-L-NN`), type, ville de rattachement, équipements (Hayon/Frigo), capacité, plage de température (si frigo), état (Actif/Maintenance/Hors service), échéances **assurance** et **contrôle technique** avec code couleur (vert/ambre ≤30j/rouge expiré). 

**Règle bloquante** : un véhicule à l'assurance expirée ne peut plus être affecté à une commande — callout rouge explicite. Actions : ajouter véhicule (formulaire complet), changer d'état, renouveler assurance/CT, retirer.

## 7. Chauffeurs (`drivers`)

Cartes par chauffeur : permis (catégories + échéance, code couleur), disponibilité (En shift/Disponible/Congé/Hors ligne), **temps de conduite du jour vs 9h max (EU 561/2006)** avec barre de progression colorée, horaires hebdomadaires (dialogue dédié, total contractuel calculé, alerte si > 44h/semaine), **type de contrat** (Salarié/Freelance avec taux DH/course affiché), badge **« Peut conduire »/« Ne peut pas conduire »** avec tooltip expliquant la raison (congé, permis expiré, limite EU561 atteinte).

Formulaire d'ajout : validation conditionnelle (le taux par course devient obligatoire si contrat = Freelance).

## 8. Tarification (`pricing`)

Grille éditable à 5 paliers de distance (0-3km, 3-7, 7-15, 15-30, 30+ au tarif au km), plus majorations fixes (fragile +15 DH, programmée +10 DH) et TVA (20%, éditable). **Simulateur interactif** : slider de distance (1-40 km) + switches "prix fixe marchand" et "remise contractuelle −10%", affichant en temps réel quel niveau de la cascade tarifaire (① fixe → ② remise → ③ grille standard) s'applique, avec le montant retenu mis en évidence.

**Règle centrale** : la priorité de calcul est stricte et affichée explicitement à l'admin — ce n'est pas une simple grille, c'est une cascade de priorité à respecter dans le moteur de tarification backend.

## 9. Facturation marchands (`invoices`)

Liste de factures (réf, marchand, net HT, statut : Brouillon/Envoyée/Payée/En litige) + panneau détail : décomposition complète (montant livraisons − commission 15% = net HT, + TVA 20% = TTC). Génération groupée, export comptable (JSON/CSV). **Gestion de litige** : dialogue de décision (émettre un avoir total/partiel, rejeter) avec motif et montant.

## 10. Réconciliation cash (`cash`)

Rapproche, par session de shift livreur : **COD théorique** (somme des commandes livrées) vs **cash déclaré** (annoncé par le livreur) vs **déposé** (remis en agence). Statuts : Équilibrée / Écart / À déposer / Déposé / En cours. KPI : cash en circulation, à déposer, écarts du jour, déposé.

**Détail session avec écart** : liste des mouvements COD individuels, ceux non retrouvés dans le déclaratif marqués visuellement. **Dialogue de résolution d'écart** : motif normalisé (monnaie rendue non enregistrée, paiement partiel, erreur de saisie, cash manquant à retenir sur prime, autre) + note libre — **aucune résolution silencieuse**, toujours tracée avec motif.

## 11. Tri en hub (`hub`)

Vue en 3 colonnes par phase : **Arrivés** (à scanner) → **Scannés** (à trier) → **Sur quai** (regroupés par ville de destination, prêts au transfert interurbain). Zone de scan/saisie manuelle de code à 8 caractères en haut. **Manifeste de transfert** : dialogue générant un bordereau scellé par destination (véhicule + chauffeur de transfert assignés, liste des colis, total COD embarqué).

## 12. Retours (`returns`, reverse logistics)

Table des livraisons échouées avec motif normalisé, compteur de tentatives (`n/max`, max = 3), COD bloqué, statut (À traiter/Reprogrammée/Retour au hub/À rendre marchand/Rendu/En souffrance). Onglets Actifs/Clôturés.

**Détail retour** : flux visuel (échec → retour hub → restitution marchand), actions : **Reprogrammer une tentative** (date+créneau, tentative n+1/max, notifie le client) si sous le plafond, sinon **Lancer le retour au marchand** obligatoire, ou **Classer en souffrance** (stockage hub, aucune nouvelle tentative, confirmation requise).

**Règle bloquante** : au-delà de 3 tentatives, la reprogrammation est désactivée — seul le retour marchand ou la souffrance reste possible.

## 13. Analytics & SLA (`analytics`)

> **Bilingue** : cet écran a été rendu **FR/AR** (dictionnaire `TXT[lang]`, colonnes/unités/motifs d'échec traduits, noms de zones/villes mappés en arabe). Depuis, la correction ±2 a été finalisée : **toute** la Console transport (`lot6` : Véhicules, Chauffeurs, Tarification, Facturation, Notifications, Utilisateurs, Objectifs — via `useL6(lang)`) et la Console SaaS (`lot5`) sont également bilingues (voir [PRD-00](PRD-00-Vue-Ensemble.md) §8).

4 KPI avec tendance (taux de réussite, délai moyen, coût/livraison, respect SLA) + graphique combiné volume/réussite par semaine + top motifs d'échec (barres de progression) + alerte SLA (zones sous l'objectif de 90%, pénalités contractuelles estimées chiffrées). 3 tableaux d'analyse croisée : **par zone**, **par livreur** (volume, réussite, ponctualité, note), **par marchand** (volume, réussite, SLA, CA généré).

## 14. Fraude COD (`fraud`)

Score de risque composite (0-100) par cas, construit à partir de signaux pondérés :

| Signal | Points |
|---|---|
| COD encaissé non déclaré | 35 |
| Écart de caisse récurrent | 30 |
| Livraison hors géofence | 28 |
| Échec sans preuve GPS | 22 |
| Taux « client absent » anormal | 18 |
| Dépôt cash tardif (> 24h) | 15 |

KPI : alertes ouvertes, montant à risque, dépôts en retard, taux de faux échec. **Callout de principe explicite** : *« Aucune sanction n'est automatique — chaque cas exige une revue humaine, et le livreur peut se justifier »*. Détail cas : décomposition du score, actions **Ouvrir une enquête** / **Blanchir** / **Confirmer la fraude & suspendre** (dialogue avec mesure appliquée : retenue sur prime, suspension temporaire, résiliation, signalement autorités). Panneau latéral : leaderboard des livreurs à risque (score composite 30 jours).

## 15. Notifications (`notifications`)

3 onglets : **Modèles** (par événement métier — assignée/en route/livrée/échec —, canaux activés par événement, langues FR/AR), **Consentement** (opt-in/opt-out/en attente par destinataire pour SMS et WhatsApp), **Historique des envois** (log avec statut succès/échec).

**Règle bloquante (Loi 09-08)** : SMS et WhatsApp affichent un cadenas et sont grisés/bloqués sans consentement explicite du destinataire — ce n'est pas configurable, c'est un garde-fou légal.

## 16. Utilisateurs & rôles + Paramètres entreprise (`users` / `settings`)

**Utilisateurs** : liste avec rôle (Administrateur/Dispatcher/Comptable), permissions par rôle affichées à droite. Le dernier administrateur ne peut pas être désactivé (protection contre le verrouillage total). Actions : inviter, changer de rôle, réinitialiser mot de passe, désactiver.

**Paramètres entreprise** : identité légale (raison sociale, ICE, RC — identifiants fiscaux marocains), adresse, devise (MAD), fuseau horaire (Africa/Casablanca), langue par défaut, **commission plateforme** (15% éditable) et TVA (20% éditable) — ce sont les paramètres qui pilotent la cascade tarifaire et la facturation dans toute la console.

## 17. Objectifs & primes — vue admin (`goals`)

Table éditable des objectifs (identiques en structure à ceux consommés côté livreur) : intitulé, période (jour/semaine/mois), cible, prime en DH — édition inline des valeurs cible/prime, création/suppression d'objectifs. KPI : objectifs actifs, prime max par livreur, livreurs éligibles.

**Couplage critique** : ces objectifs sont **exactement** ceux affichés dans l'app livreur (écran Profil › Objectifs & primes) — une seule source de vérité, pas une duplication de config.

---

# Écrans ajoutés (générés par Claude Design — `lot16.jsx`)

> Ces 4 écrans ont été ajoutés après la première version du PRD pour combler des manques identifiés. Ils sont câblés dans le menu latéral (`lib.jsx` `NAV`) et chargés par la Console complète. **Note** : l'ancien écran « Notifications » (§15) a été renommé **« Modèles de notif. »** dans le menu pour le distinguer du nouveau Centre de notifications (§20).

## 18. Reversement COD au marchand (`payout`) — groupe Facturation

Ferme le circuit du cash : l'argent collecté par les livreurs et déposé en agence (§10) est ici **reversé aux marchands**, commission déduite. Table des marchands : COD brut collecté, commission retenue (taux **par marchand** : 15/12/10 % — cohérent avec la priorité « grille marchand » de la tarification), **net à virer**, statut (À reverser / En cours / Reversé). KPI : à reverser net, commission retenue, marchands en attente, reversé période précédente.

**Détail reversement** : décomposition brut − commission = net, **compte bénéficiaire** (RIB bancaire marocain vérifié, ex. Attijariwafa Bank), dialogue « Générer le virement » avec référence (`VIR-AAAA-NNNN`). Un reversement déjà effectué affiche sa référence de virement au lieu du bouton.

**Règle** : c'est le pendant sortant de la réconciliation cash (§10) — la boucle COD complète est désormais : livreur encaisse → dépose en agence → agence reverse au marchand net de commission.

## 19. Remboursements (`refund`) — groupe Facturation

Traite le cas métier de la **transaction inverse** : un colis annulé ou retourné **après** que le COD a été encaissé. Liste des commandes concernées (motif : retour / annulée après livraison / colis endommagé), COD déjà encaissé, statut à traiter / traité.

**Détail** : client, marchand, COD encaissé, code de suivi, puis **décision de remboursement** (radio) : rembourser le client / re-créditer le marchand (colis retourne au stock) / retenir (litige, cash conservé). Note de traçabilité obligatoire + confirmation `AlertDialog`. La transaction inverse est tracée (`RBT-AAAA-NNN`) et déclarée irréversible.

**Règle** : aucune transaction inverse silencieuse — motif + pièces + confirmation obligatoires, cohérent avec la traçabilité exigée sur la réconciliation cash et la fraude.

## 20. Centre de notifications admin (`notifcenter`) — groupe Administration

L'admin dispose enfin de **son propre** centre de notifications (le livreur en avait déjà un). Alertes catégorisées : conformité (assurance/CT/permis), géofence (sortie de zone), caisse (écart), SLA (dépassement), litige. Compteur de non-lues, filtres par catégorie, « Tout marquer lu », marquage lu au clic.

**Couplage** : ces alertes agrègent des signaux déjà présents ailleurs dans la console (conformité du Dashboard §1, sorties de zone du PC Flotte §4, écarts de la réconciliation §10, SLA de l'Analytics §13, litiges de la Facturation §9) — c'est une vue transversale, pas une nouvelle source de données.

## 21. Modération des avis clients (`reviews`) — groupe Administration

Gère les avis laissés par les clients finaux (§ [PRD-04](PRD-04-Client-Final.md) notation). Liste avec étoiles, auteur → livreur, date ; **signalement abusif** (bordure rouge, exclu du calcul de score) ; filtres par note (tous / ≤2★ / 1★). Actions sur avis en attente : **Publier** / **Masquer** / **Répondre** (réponse publique ou note interne). KPI : note moyenne, à modérer, avis du mois, signalés abusifs.

**Règle centrale (identique à la fraude COD §14)** : *un avis négatif n'impacte le score du livreur qu'après validation humaine ; les avis signalés abusifs sont exclus du calcul.* La note modérée ici est la même donnée que celle affichée dans Analytics (§13) et le profil livreur — une seule source de vérité.

## 22. Mode de facturation par marchand (ajouté sur l'écran Facturation `lot6`)

Carte « Mode de facturation par marchand » ajoutée à l'écran Facturation (§9) : permet de définir, pour chaque marchand, s'il est en **Prépayé** (débit du portefeuille en temps réel) ou en **Post-payé** (facture mensuelle regroupée). C'est le pendant admin de l'indicateur affiché côté marchand ([PRD-02](PRD-02-Portail-Marchand.md) §6). **Réserve** : dans la maquette, ce contrôle admin et l'indicateur marchand ne partagent pas encore le même état (à unifier en production).
