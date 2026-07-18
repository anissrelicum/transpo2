# PRD — Transpo · Lot 3 : App mobile Livreur

**Source de la maquette** : `Transpo - Lot 3 App Livreur.dc.html` (projet Claude Design `Transpo — Prompts Claude Design`), maquette React + Radix UI, cadre téléphone 390×844, sans composants React Native (à ré-implémenter en natif).

**Statut** : rédigé à partir d'une analyse exhaustive du code source de la maquette (`transpo/lot3.jsx` + bibliothèque partagée `transpo/lib.jsx`). Ce document sert de spécification d'implémentation pour l'app livreur native (iOS/Android).

---

## 1. Contexte produit

Transpo est une plateforme de transport/livraison marocaine (Casablanca, Rabat, Marrakech, Tanger, Fès). Le système comprend plusieurs lots déjà maquettés : Commandes (Lot 1), Dispatch (Lot 2), **App Livreur (Lot 3, ce document)**, Portail Marchand (Lot 4), Suivi public (Lot 5a), Console SaaS (Lot 5b), Flotte & Facturation (Lot 6), Tournées (Lot 7).

L'app Livreur est l'outil de travail quotidien du chauffeur-livreur (freelance ou salarié) : recevoir des missions, s'y rendre, scanner les colis, livrer, encaisser le cash à la livraison (COD), gérer son temps de conduite réglementaire, et suivre ses gains.

**Langues** : Français (par défaut) et Arabe (RTL complet). Toute l'UI doit être bilingue dès la conception.

**Devise** : Dirham marocain (DH), format `1 250,00 DH` (`Intl.NumberFormat('fr-FR')`).

---

## 2. Objectifs

- Permettre à un livreur de gérer sa journée de A à Z depuis son téléphone : connexion → missions → tournée optimisée → scan colis → livraison → preuve → encaissement → clôture de journée.
- Garantir la conformité réglementaire du temps de conduite (règlement européen EU 561/2006, adapté ici au contexte marocain comme référence de repos obligatoire).
- Fonctionner en mode dégradé réseau (file d'attente hors-ligne, synchronisation différée).
- Servir aussi bien les livreurs freelances (rémunérés à la course) que salariés (fiche de paie classique).

### Non-objectifs (hors périmètre de ce lot)
- Back-office dispatch/admin (couvert par Lot 2 et Lot 5b).
- Paiement in-app par carte (seul le cash COD est traité ici).
- Suivi GPS temps réel côté serveur (l'app émet la position ; l'infrastructure de tracking est hors lot).

---

## 3. Persona

**Youssef Benali** — livreur freelance à moto sur la zone Maârif/Casablanca, contrat freelance rémunéré **18 DH/course livrée**, note 4,8★, permis A/B valide, ~7 livraisons/jour, quotas EU561 (9h de conduite max/jour, pause 45 min après 4h30).

Deux types de contrat existent et changent l'affichage : `FREELANCE` (rémunération à la course, badge violet) et `SALARIE` (badge bleu, pas d'écran de gains à la course).

---

## 4. Architecture de navigation

**Shell mobile** : barre de statut système (heure, réseau) + zone de contenu + barre d'onglets basse (5 onglets, 64px de haut) :

| Onglet | Icône | Écran |
|---|---|---|
| Missions | Archive | Liste des missions du jour |
| Tournée | Stack | Optimisation multi-arrêts |
| Scanner | Caméra | Scan des colis |
| Shift | Chrono | Temps de conduite / service |
| Profil | Personne | Profil, réglages, historique |

Les onglets sont masqués sur les écrans de flux (connexion, détail mission, statut, preuve, COD, échec) où une navigation retour (`←`) est utilisée à la place.

Contraintes UI transverses : cibles tactiles **≥ 44–48px**, thème clair/sombre, RTL complet en arabe, action principale toujours collée en bas de l'écran (bouton pleine largeur, hauteur 52px).

---

## 5. Inventaire des écrans (22)

### 5.1 Connexion & onboarding permissions
- **Connexion** : champs téléphone/identifiant + mot de passe, lien « Mot de passe oublié ? ».
- **Autorisations** (obligatoires avant de commencer) : Localisation (arrière-plan inclus), Caméra (preuve de livraison), Notifications (missions/alertes). Bouton principal désactivé tant que les 3 ne sont pas accordées ; affiche « x/3 autorisations » en attendant.

### 5.2 Missions du jour (`missions`, onglet par défaut)
- En-tête : date, titre, badge « N actives », cloche de notifications avec compteur non lues.
- 3 tuiles résumé : À livrer / Livrées / COD total du jour.
- Bandeau poussé (« Nouvelle mission assignée ») dismissible, menant aux notifications.
- Liste de cartes mission : n° d'ordre, référence commande, `StatusBadge`, adresse retrait (icône maison) et livraison (icône pin), distance, taille de colis, badge COD (montant) ou « Prépayé ».
- État `loading` : squelettes ; état vide/erreur gérés par le harnais (à répliquer côté app réelle).

### 5.3 Notifications
- Compteur non lues, bouton « Tout lire ».
- Types typés avec icône + couleur dédiées : `mission` (indigo), `address` (changement d'adresse, amber), `cancel` (annulation, rouge), `cod` (rappel encaissement, vert), `shift` (rappel pause réglementaire, cyan).
- Marquage lu au tap.

### 5.4 Détail de mission (`detail`)
- Carte (Leaflet, non interactive) avec marqueur chauffeur + marqueur destination.
- Étape **Retrait** (adresse marchand, contact) marquée « Fait » une fois passée.
- Étape **Livraison** (nom client, adresse, contact).
- Bloc colis : description, taille, fragilité, badge COD à encaisser, badge niveau de preuve requis.
- Callout note libre (ex. consignes d'accès).
- Barre d'action : 2 boutons contact (chat / appel) + bouton principal « Naviguer ».

### 5.5 Contact client (bottom sheet, réutilisable)
- Numéro **masqué** (affichage partiel type `06 12 34 •• ••`), appel relayé par la plateforme (jamais le vrai numéro exposé au livreur).
- 3 actions rapides : Appeler / WhatsApp / SMS.
- Messages rapides pré-rédigés sélectionnables (ex. « J'arrive dans 5 minutes », « Préparez l'appoint SVP »).
- Envoi via WhatsApp en action de confirmation.

### 5.6 Mise à jour de statut (`status`) — flux séquentiel obligatoire
Machine à états linéaire, une seule étape « active » à la fois, avec confirmation modale à chaque transition :
```
ASSIGNEE → RETRAIT (« Démarrer vers le retrait »)
RETRAIT → RECUPEREE (« Colis récupéré »)
RECUPEREE → LIVRAISON (« Démarrer la livraison »)
LIVRAISON → LIVREE (« Marquer comme livrée »)
```
- Chaque transition : `AlertDialog` de confirmation, précise que le client sera notifié.
- À l'étape active, bouton « Signaler un échec » toujours disponible → écran Échec.
- Horodatage affiché pour les étapes terminées.
- Dernière étape : bouton vert « Confirmer la livraison » → écran Preuve.

### 5.7 Preuve de livraison (`proof`)
- Sélecteur de niveau de preuve (paramétrable par commande) : **Aucune / Photo / Signature / Photo+signature**.
- Photo : jusqu'à 5 photos, ajout/suppression, compteur `(n/5)`.
- Signature : capture (placeholder SVG dans la maquette → à remplacer par un vrai composant de saisie tactile), option « refaire ».
- Champ nom du destinataire (obligatoire si signature requise).
- Capture GPS automatique affichée (coordonnées + précision en mètres).
- Bouton de validation désactivé tant que les preuves requises manquent, avec libellé contextuel (« Photo requise » / « Signature requise »).

### 5.8 Encaissement COD (`cod`)
- Montant à encaisser affiché en grand (carte ambre).
- Champ montant reçu (clavier numérique), boutons raccourcis de montants courants.
- Calcul automatique de la monnaie à rendre.
- Note : le montant sera reversé au marchand déduction faite de la commission.
- Confirmation modale avant clôture ; bouton désactivé si montant reçu < montant dû.

### 5.9 Échec de livraison (`fail`)
- Motif obligatoire (liste normalisée, sélection radio) : *Destinataire absent, Adresse introuvable, Refus du colis, Téléphone injoignable, Colis endommagé, Autre motif*.
- Notes complémentaires libres, photo justificative optionnelle.
- Confirmation → la commande repasse en statut **Retour** et est renvoyée au marchand.

### 5.10 Confirmation de livraison (`done`)
- Écran de succès : référence + montant encaissé, récap preuve fournie, aperçu de la mission suivante.

### 5.11 Ma tournée — optimisation multi-arrêts (`route`, onglet)
- Carte avec position dépôt/chauffeur + arrêts restants numérotés + polyligne pointillée du trajet.
- Carte « Optimiser la tournée » : calcule un ordre plus court (algorithme du plus proche voisin sur distance à vol d'oiseau/Haversine) et affiche le gain en km estimé vs. l'ordre actuel.
- Réordonnancement manuel des arrêts (flèches haut/bas) qui invalide l'optimisation.
- 3 cellules résumé : arrêts restants, distance restante, temps estimé (vitesse urbaine moyenne 22 km/h + 4 min d'arrêt par livraison).
- Liste des arrêts : nom, référence, adresse, COD éventuel ; arrêt courant mis en évidence (« suivant ») avec actions rapides « Voir sur carte » et « Marquer livré ».
- Bouton reset de la tournée.

**Règle métier** : l'algorithme de tri est un plus-proche-voisin simple — à documenter comme heuristique de démo ; en prod, un vrai moteur de routing (temps de trajet réel, sens de circulation) est nécessaire.

### 5.12 Scanner de colis (`scan`, onglet)
- Bascule Retrait / Livraison.
- Viseur caméra simulé avec cadre de visée et ligne de scan animée.
- Résultat de scan avec code couleur : **reconnu** (vert), **déjà scanné/doublon** (ambre), **hors tournée** (rouge), **tous scannés** (vert, écran de complétion).
- Saisie manuelle du code (8 caractères) en secours si le scan caméra échoue.
- Barre de progression `(scannés/total)`.
- Liste des colis de la tournée avec statut scanné/non scanné et code affiché.
- Action de test « Simuler un colis d'une autre tournée » (à retirer en prod — outil de démo uniquement).

### 5.13 Signalement d'incident (`incident`)
- 6 types d'incident sélectionnables en grille : Accident/panne, Colis endommagé, Client agressif, Zone inaccessible, Vol/perte, Autre — les 3 premiers/derniers marqués **SOS** (déclenchent une alerte prioritaire).
- Niveau de gravité : Faible / Moyen / Urgent.
- Si urgent (ou type SOS + gravité ≠ faible) : bandeau rouge avec numéros d'urgence + bouton d'appel direct au dispatch en priorité.
- Description libre, photos optionnelles (jusqu'à 3).
- Confirmation avec référence d'incident générée (`INC-xxx`).

### 5.14 Shift & conformité conduite (`shift`, onglet)
- Bascule service actif/inactif (switch), avec heure de démarrage affichée.
- Zone assignée (ville + secteur).
- **Temps de conduite réglementaire (EU 561/2006)** : barre de progression conduite du jour / max autorisé (9h), code couleur (vert → ambre < 2h restantes → rouge < 1h restante), alerte de pause obligatoire de 45 min affichée sous le seuil de 2h restantes.
- Compteurs : temps restant, pause cumulée, amplitude horaire totale.
- Récap journée : missions livrées, distance parcourue, COD encaissé.
- Bouton principal : démarrer/terminer le shift.

**Règle métier explicite à conserver** : seuil de pause obligatoire = 45 min après 4h30 de conduite cumulée ; alerte 30 min avant d'atteindre la limite.

### 5.15 Profil (`profil`, onglet)
- Avatar, nom, téléphone, note (★), badge type de contrat (Freelance + taux, ou Salarié).
- Switch disponibilité (reçoit des missions ou non).
- Fiche véhicule/permis/zone/conduite/horaire.
- Raccourcis : Historique & gains, Objectifs & primes, Récap du jour, Support dispatch, Mes documents, Paramètres, Aide/FAQ, Mon shift, Signaler un incident, **Se déconnecter**.

### 5.16 Historique & gains (`earnings`)
- Bascule semaine/mois.
- **Si freelance** : carte de gains totaux = `nombre de courses × taux par course` (taux configurable, ex. 18 DH/course), liste des courses livrées sur la période avec montant gagné par course.
- **Si salarié** : pas de carte de gains ; liste affichant simplement le COD par course ou badge « livrée ».
- État vide géré (« Aucune course livrée sur cette période »).

### 5.17 Objectifs & primes (`objectives`)
- Carte prime totale acquise vs. prime maximale possible sur la période.
- Liste d'objectifs (partagés avec le back-office admin) : ex. *Courses livrées* (30/semaine → +300 DH), *Note moyenne* (4,5★/semaine → +150 DH), *Taux de réussite* (95%/mois → +400 DH), *Ponctualité* (90%/semaine → +120 DH). Chaque objectif = barre de progression + statut atteint/non atteint.
- Note : ces objectifs sont définis par le transporteur (configurable côté admin, pas côté livreur).

### 5.18 Récap fin de journée (`recap`)
- 4 statistiques : courses livrées, échecs, distance, temps de conduite.
- Encaissement COD du jour : collecté vs. à déposer en agence.
- Gains estimés du jour (si freelance).
- Callout d'alerte si dépôt cash en agence requis avant clôture.
- Action « Clôturer ma journée » → écran de confirmation.

### 5.19 Support / chat dispatch (`support`)
- Fil de discussion type messagerie avec le dispatcher assigné (indicateur de présence en ligne).
- Réponses rapides suggérées (« J'arrive », « Retard 15 min », « Adresse introuvable »).
- Champ de saisie + envoi.

### 5.20 Mes documents (`docs`)
- Liste de documents avec statut : Permis de conduire (validité), Contrat (freelance/salarié), Carte grise véhicule, Attestation d'assurance, Contrôle technique (alerte échéance proche), Attestation de travail.
- Téléchargement par document, action « Téléverser un document ».

### 5.21 Paramètres (`settings`)
- Notifications : push, son, vibration (switches indépendants).
- Affichage : langue (FR/AR), thème (clair/sombre).
- Missions : acceptation automatique des missions de sa zone (switch), partage de position (statut lecture seule, actif pendant le shift).
- À propos : version app, lien confidentialité (référence loi marocaine 09-08 sur la protection des données personnelles).

### 5.22 Aide / FAQ (`help`)
- Recherche de question.
- Accordéon de questions/réponses courantes (accepter une mission, client absent, encaissement COD, règle de pause obligatoire, calcul des primes, fonctionnement hors-ligne).
- CTA de contact direct du dispatch si besoin d'aide supplémentaire.

### 5.23 État hors-ligne / synchronisation (`offline`)
- Bandeau persistant « Hors ligne — actions enregistrées localement ».
- File d'attente des actions en attente de synchronisation (ex. livraison + preuve, encaissement COD, changement de statut), chacune horodatée.
- Bouton « Forcer la synchronisation » (spinner pendant l'envoi).
- **Règle métier clé** : l'app doit rester pleinement utilisable hors-ligne ; toute action est horodatée localement et rejouée automatiquement au retour réseau, sans perte ni duplication.

### 5.24 Onboarding / recrutement livreur (`onboarding`) — ajouté
Parcours d'inscription avant le premier shift, accessible depuis l'écran de connexion (« Devenir livreur »). Assistant 4 étapes avec barre de progression :
1. **Vos informations** : nom, téléphone, ville de rattachement.
2. **Contrat & véhicule** : Salarié (rémunération fixe) ou Freelance (payé à la course, callout explicatif), type de véhicule (moto/voiture/fourgon).
3. **Vos documents** : téléversement des pièces avec états — **À fournir / En vérification / Validé / Refusé** (un document refusé affiche le motif « illisible » et propose « Reprendre »). Vérification annoncée sous 48 h.
4. **Dossier en cours de vérification** : récap contrat/véhicule/documents, message d'attente, notification promise à la validation.

**Règle** : réutilise les mêmes statuts de documents que l'écran « Mes documents » (§5.20). Le livreur ne peut pas démarrer de shift tant que son dossier n'est pas validé.

### 5.25 Ma caisse (`macaisse`) — ajouté, désormais intégré au flux
Anciennement une démo autonome (voir §11.3), désormais un écran à part entière accessible depuis le Profil :
- **Cash en main** cumulé depuis le dernier dépôt (grand, coloré selon le niveau de plafond).
- **Plafond de cash** (barre de progression vert → ambre > 60 % → rouge > 85 %) avec alerte « Proche du plafond — pensez à déposer ».
- **Liste des COD encaissés** depuis le dernier dépôt (client, réf, heure, montant).
- **Déposer en agence** (`AlertDialog` de confirmation) → génère un bordereau (`BRD-…`) et **remet la caisse à zéro** ; état post-dépôt affiché en callout vert.

**Couplage** : c'est la vue livreur de la « session » de la réconciliation cash admin ([PRD-01](PRD-01-Console-Admin-Dispatcher.md) §10). Consultable **en cours de shift**, pas seulement à la clôture (§5.18).

---

## 6. Modèle de données (déduit de la maquette)

### Mission / Commande
```
ref: string            // "CMD-20260712-014"
code: string           // code colis à scanner, 8 car. alphanumériques
status: enum           // voir cycle de vie ci-dessous
pickup / drop: adresse + contact (nom, téléphone masqué)
dist: distance estimée
size: enum ("Petit" | "Moyen" | "Grand" | "Très grand")
cod: montant à encaisser (0 si prépayé)
codPaid: bool
proofLevel: enum ("aucune" | "photo" | "signature" | "photo_signature")  // aligné sur l'API marchand
urgent: bool
history: [{ at, label, by }]
```

### Cycle de vie du statut (partagé avec Lot 1/Lot 2)
```
PROGRAMMEE → NOUVELLE → ASSIGNEE → RETRAIT → RECUPEREE → LIVRAISON → LIVREE
                                                              ↘ ECHOUEE → RETOUR
                                                              ↘ ANNULEE
```
Chaque statut a un libellé FR + AR et une couleur figée (voir tableau `STATUS` — à réutiliser tel quel pour rester cohérent avec les autres lots) :

| Statut | Libellé FR | Libellé AR | Couleur |
|---|---|---|---|
| PROGRAMMEE | Programmée | مبرمجة | gray |
| NOUVELLE | Nouvelle | جديدة | blue |
| ASSIGNEE | Assignée | مُسندة | indigo |
| RETRAIT | En route (retrait) | في الطريق (الاستلام) | cyan |
| RECUPEREE | Récupérée | تم الاستلام | violet |
| LIVRAISON | En route (livraison) | في الطريق (التسليم) | amber |
| LIVREE | Livrée | تم التسليم | green |
| ECHOUEE | Échouée | فشل | red |
| RETOUR | Retour | إرجاع | orange |
| ANNULEE | Annulée | ملغاة | gray |

### Livreur (Driver)
```
nom, téléphone, note (★), avatar
contrat: "FREELANCE" | "SALARIE"
tauxCourse: number         // si freelance, DH par course livrée
véhicule, permis (types + expiration)
zoneAssignée
conduiteJour / conduiteMax (heures, EU561)
disponible: bool
```

### Objectif (Goal, partagé avec back-office)
```
metric, period ("semaine" | "mois"), target, current, unit, bonus (DH)
```

---

## 7. Règles métier transverses à respecter

1. **Numéro client toujours masqué** côté livreur — tout appel/SMS est relayé par la plateforme, jamais le vrai numéro exposé.
2. **Preuve de livraison paramétrable par commande** (aucune/photo/signature/les deux) — ne pas coder en dur un seul niveau.
3. **COD** : montant à encaisser affiché avant validation, calcul de monnaie à rendre, traçabilité du dépôt en agence en fin de journée.
4. **Conformité temps de conduite** : alertes de pause à seuils fixes (45 min après 4h30 conduite cumulée, alerte 30 min avant la limite journalière).
5. **Freelance vs salarié** change l'affichage des gains partout (Profil, Historique, Récap) — un seul flag de contrat pilote ces variantes.
6. **Offline-first** : toute action métier (statut, preuve, COD) doit pouvoir être déclenchée hors-ligne et mise en file, horodatée, sans bloquer le livreur.
7. **Bilingue FR/AR avec RTL complet**, y compris libellés de statuts et repères directionnels (pas seulement traduction de texte).
8. **Accessibilité tactile** : toutes les cibles interactives ≥ 44×44px (boutons d'action bas d'écran en 52px).

---

## 8. Exigences non-fonctionnelles

- **Plateformes** : iOS + Android (la maquette précise « React Native » comme cible d'implémentation).
- **Connectivité** : dégradée/intermittente par design (zones rurales/parkings) → synchronisation en file d'attente obligatoire, jamais de perte d'action.
- **Permissions device** : géolocalisation (y compris arrière-plan), caméra, notifications push — à demander explicitement à l'onboarding avec justification affichée.
- **Cartographie** : fond de carte type CartoDB (clair/sombre selon thème), position chauffeur + arrêts + polylignes.
- **Thème** : clair/sombre au niveau app (couleur d'accent indigo, palette Radix comme référence de design token si le design system est repris).
- **Sécurité/vie privée** : conformité loi marocaine 09-08 mentionnée explicitement dans les réglages.

---

## 9. Points ouverts / à trancher avec le produit

1. Le composant de **capture de signature** est un placeholder statique dans la maquette (SVG figé) — à remplacer par un vrai composant de saisie tactile (ex. `react-native-signature-canvas`).
2. Le **scanner caméra** est simulé (bouton déclenchant un résultat aléatoire) — l'implémentation réelle nécessite un lecteur de code-barres/QR (ex. `vision-camera` + `MLKit`/`ZXing`).
3. L'**algorithme d'optimisation de tournée** (plus proche voisin, distance à vol d'oiseau) est une heuristique de démonstration — confirmer si un vrai moteur de routing (temps réel, sens interdits) est requis pour la v1 ou si l'heuristique suffit au lancement.
4. Le **taux de rémunération freelance** (18 DH/course) est-il fixe, variable par zone/type de colis, ou négocié par contrat individuel ?
5. Le seuil de conduite « EU 561/2006 » est une référence européenne — à confirmer si le Maroc a une réglementation locale équivalente à afficher à la place, ou si c'est un choix assumé de la plateforme.
6. Gestion des **conflits de synchronisation** hors-ligne (ex. deux statuts contradictoires envoyés en désordre) — non spécifiée dans la maquette, à définir côté backend.
7. Confidentialité : le lien « Confidentialité (Loi 09-08) » dans les Réglages est un espace réservé sans contenu — la page réelle est à produire.

---

## 10. Annexe — Liste exhaustive des identifiants d'écran (navigation interne)

`login`, `missions`, `route`, `notifs`, `scan`, `detail`, `status`, `proof`, `cod`, `fail`, `shift`, `offline`, `done`, `profil`, `earnings`, `incident`, `objectives`, `recap`, `support`, `docs`, `settings`, `help`.

## 11. Réconciliation avec les maquettes mobiles autonomes de l'Accueil

L'écran d'accueil du projet (« Toutes les interfaces ») liste, sous « App livreur (mobile) », 4 tuiles : **App livreur** (ce document), **Ma tournée**, **Ma caisse**, **Scanner**. Ces 3 dernières sont des démonstrations **autonomes à un seul écran** (`transpo/lot7.jsx` fonction `MobileTour`, `transpo/lot8.jsx` fonction `MobileCash`, `transpo/lot9.jsx` fonction `MobileScan`), distinctes du flux intégré de `lot3.jsx`. Analyse de réconciliation :

### 11.1 Ma tournée (`lot7.jsx :: MobileTour`) — ⚠️ divergence avec l'écran `route` de ce document
La version autonome est une **lecture simplifiée** : ordre déjà pré-optimisé (aucun bouton « Optimiser », aucun réordonnancement manuel), le prochain arrêt est mis en avant avec un unique bouton « Marquer comme fait » qui fait avancer un compteur linéaire. L'écran `route` de la §5.11 (ce document) est la version **enrichie et interactive** : réordonnancement manuel (flèches haut/bas), bouton « Optimiser la tournée » avec calcul de gain en km, reset de la tournée.

**À trancher pour l'implémentation** : ce sont deux itérations de la même fonctionnalité, pas deux écrans différents du produit final. Retenir la version interactive (§5.11) comme référence — la version simplifiée semble être une itération de maquette antérieure conservée dans le projet à titre de comparaison.

### 11.2 Scanner (`lot9.jsx :: MobileScan`) — cohérent avec l'écran `scan`, avec une nuance de périmètre
Comportement quasi identique à la §5.12 (viseur caméra simulé, code couleur reconnu/dup/hors-tournée, historique des scans). Différence : la version autonome propose 3 étapes conceptuelles — **Retrait / Entrée hub / Livraison** — alors que l'écran intégré (`lot3.jsx`) n'expose que 2 phases : **Retrait / Livraison** (bascule `SegmentedControl`).

**Point ouvert** : le scan « Entrée hub » est-il réalisé par le livreur lui-même (au moment où il dépose ses colis au hub de tri, cf. [PRD-01](PRD-01-Console-Admin-Dispatcher.md) §11 Tri en hub) ou uniquement par un agent de tri au hub ? Si le livreur doit scanner à l'entrée hub, l'écran `scan` de ce document doit être étendu à une 3ᵉ phase pour rester cohérent avec la traçabilité affichée côté admin ([PRD-01](PRD-01-Console-Admin-Dispatcher.md) §2.3, onglet Traçabilité, qui montre bien une étape « Entrée hub » horodatée et attribuée à un agent de tri).

### 11.3 Ma caisse — ✅ résolu (désormais intégré)
> **Mise à jour** : ce manque a été corrigé — l'écran « Ma caisse » a été intégré au flux livreur (voir §5.25, id `macaisse`, accessible depuis le Profil). La note ci-dessous documente l'analyse d'origine, conservée pour historique.

Ceci **n'était pas** une variante de l'écran `cod` (§5.8, encaissement par commande) ni de `recap` (§5.18, récap fin de journée). C'était un **écran dédié distinct**, initialement absent de la `SCREEN_LIST` de `lot3.jsx` :

- **Cash en main** : total cumulé du cash collecté depuis le dernier dépôt (pas juste la journée courante).
- **Plafond de cash** (`cap`, ex. 6 000 DH) avec barre de progression colorée (vert → ambre à 60% → rouge à 85%) et callout d'alerte quand le plafond approche.
- **Liste des COD encaissés** depuis le dernier dépôt (référence, client, montant).
- **Action « Déposer en agence »** : `AlertDialog` de confirmation qui génère un bordereau de dépôt et **remet la caisse à zéro**.

Ce même modèle (cash en main / plafond / dépôt) existe côté console admin dans [PRD-01](PRD-01-Console-Admin-Dispatcher.md) §10 (Réconciliation cash) comme **« session »** avec statuts `EQUILIBRE/ECART/A_DEPOSER/DEPOSE/EN_COURS` — l'écran « Ma caisse » est la vue livreur de cette même session.

**Recommandation d'implémentation** : ajouter un écran `cash` au parcours livreur intégré (accessible depuis le Profil, à côté de « Historique & gains », ou en badge sur l'onglet Shift), plutôt que de considérer que le récap de fin de journée (§5.18) suffit — celui-ci ne montre le cash qu'au moment de la clôture, alors que « Ma caisse » doit rester consultable **en cours de shift**, notamment pour anticiper le passage du plafond avant qu'il ne bloque de nouvelles collectes.
