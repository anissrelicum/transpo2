# Portrail — Intégrer l'IA, et refaire l'app livreur

Étude du 18 octobre 2026. Point de départ : le produit tel qu'il est en ligne (console, portail
marchand, console SaaS, app livreur), et ce que les utilisateurs attendent désormais d'un
logiciel — pouvoir lui parler.

---

## 1. Le principe : l'IA là où elle fait gagner du temps ou de l'argent, mesurablement

Trois règles pour ne pas faire de « l'IA décorative » :

1. **Chaque usage remplace un geste pénible et fréquent** (recopier, chercher, téléphoner,
   expliquer un écart) — et on sait mesurer le gain (minutes par commande, appels évités,
   litiges en moins).
2. **L'humain garde la décision sur ce qui engage** : argent, sanction, affectation d'une
   exception. L'IA prépare, propose, explique ; elle n'exécute une action qu'après
   confirmation (même règle que la fraude aujourd'hui : « aucune sanction automatique »).
3. **Les données d'une société ne servent qu'à elle** : l'isolation par société, déjà au cœur
   du produit, s'applique aussi aux requêtes IA (chaque question ne voit que les données du
   tenant et des droits de l'utilisateur), fournisseurs sous contrat de traitement (RGPD,
   loi 09-08), rien n'est utilisé pour entraîner un modèle tiers.

---

## 2. Les briques techniques

Toutes ne sont pas de l'« IA générative » : une bonne partie du gain vient d'algorithmes
classiques (optimisation, prévision), moins chers et plus fiables.

| Brique | À quoi elle sert | Exemple d'outil | Coût indicatif |
|---|---|---|---|
| **Modèle de langage (LLM)** | Comprendre une demande, extraire des informations d'un texte, résumer, répondre | Claude (API Anthropic, ou via OpenRouter déjà utilisé) | quelques centimes de DH par échange |
| **Reconnaissance vocale** | Parler à l'app au lieu de taper — FR, et **arabe marocain (ar-MA)** | Deepgram Nova-3 (déjà utilisé pour la démo) | ≈ 0,05 DH / minute |
| **Synthèse vocale** | L'app répond à voix haute (mains libres sur la moto) | Deepgram Aura / OpenAI audio | ≈ 0,1 DH / réponse |
| **Vision / OCR** | Lire une étiquette, un permis, une carte grise, un relevé de virement ; vérifier une photo de preuve | Modèle multimodal (Claude, Gemini) | quelques centimes / image |
| **Moteur d'itinéraires** | Ordre optimal des arrêts, temps de trajet réels, navigation | OSRM ou Valhalla (libres, auto-hébergés) ; ou Google / Mapbox | gratuit auto-hébergé |
| **Optimisation (VRP)** | Construire des tournées multi-arrêts sous contraintes (capacité, créneaux, COD max) | OR-Tools (libre) | gratuit |
| **Prévision** | Volumes par zone et par jour, besoin en livreurs, ETA | Modèles statistiques / ML classiques sur l'historique | gratuit |
| **Détection d'anomalies** | Compléter le score de fraude actuel (règles) par des schémas appris | ML classique | gratuit |
| **Recherche documentaire (RAG)** | Répondre « comment faire X ? » à partir de la documentation du produit | LLM + index de la doc | faible |

---

## 3. Où mettre l'IA dans Portrail, acteur par acteur

Légende — **Valeur** : gain pour le client ; **Effort** : S (≤ 2 semaines), M (≤ 6 semaines), L (plus) ;
**IA** : brique principale.

### 3.1 Le marchand (portail)

| # | Usage | Ce que ça change | Valeur | Effort | IA |
|---|---|---|---|---|---|
| M1 | **Créer une commande en collant le message du client** (« Salam, c'est Nadia, 0661…, livrez-moi au Maârif, voici ma position https://maps… ») | Contact, téléphone, adresse, position, montant pré-remplis : la saisie passe de 2 min à 10 s. Prolonge directement la localisation par lien livrée cette semaine. | ★★★ | S | LLM |
| M2 | **Importer un fichier Excel/CSV « tel quel »** | L'IA reconnaît les colonnes (même mal nommées), signale les lignes incomplètes ; plus de modèle de fichier imposé | ★★★ | S | LLM |
| M3 | **Assistant du portail** : « où en est la commande de Nadia ? », « combien vous me devez ce mois-ci ? », « pourquoi cette livraison a échoué ? » | Moins d'appels au transporteur ; réponses tirées des vraies données du marchand, et de lui seul | ★★ | M | LLM + accès aux données |

### 3.2 Le dispatcher et l'administrateur (console)

| # | Usage | Ce que ça change | Valeur | Effort | IA |
|---|---|---|---|---|---|
| D1 | **Copilote conversationnel** : « quelles commandes sont en retard à Casablanca ? », « réaffecte les commandes du Maârif de Youssef à Imane » | On demande au lieu de filtrer ; les actions sont proposées puis **confirmées** d'un clic | ★★★ | M | LLM + outils de l'API |
| D2 | **Brief du matin** : résumé de la veille et de la journée (retards, exceptions, caisses en écart, livreurs bientôt non conformes) | 5 minutes pour savoir où regarder | ★★ | S | LLM sur les indicateurs existants |
| D3 | **Aide aux exceptions de l'affectation automatique** : pour une commande « zone non couverte », proposer le livreur le plus proche hors zone, ou l'étendre | Le dispatcher ne traite que les exceptions — l'IA les lui rend plus rapides | ★★ | S | règles + LLM pour l'explication |
| D4 | **Tournées optimisées** : regrouper les commandes en tournées et ordonner les arrêts (capacité, créneaux, plafond de COD transporté) | Moins de kilomètres, plus de livraisons par livreur | ★★★ | M | moteur d'itinéraires + OR-Tools |
| D5 | **ETA fiables et alertes SLA proactives** | Prévenir le client et le marchand **avant** le retard | ★★ | M | prévision |
| D6 | **Prévision de charge** : volume attendu demain par zone → combien de livreurs mobiliser | Moins de sur- ou sous-effectif | ★★ | M | prévision |

### 3.3 Le livreur (app mobile) — voir aussi la partie 4

| # | Usage | Ce que ça change | Valeur | Effort | IA |
|---|---|---|---|---|---|
| L1 | **Assistant vocal mains libres, en français et en darija** : « prochaine livraison », « je suis arrivé », « le client ne répond pas », « combien j'ai encaissé ? » | Utilisable en roulant ; aucun texte à taper | ★★★ | M | voix + LLM |
| L2 | **Itinéraire de la journée optimisé** et réordonné en direct (nouvelle mission, échec, embouteillage) | Le livreur ne choisit plus son trajet au hasard | ★★★ | M | moteur d'itinéraires |
| L3 | **Lecture d'étiquette par la caméra** (référence, destinataire) au retrait et au hub | Fin des saisies et des erreurs de colis | ★★ | S | vision |
| L4 | **Incident déclaré à la voix** → classé automatiquement (client absent, adresse fausse, colis abîmé) avec la note | Motifs propres pour les retours et la qualité | ★★ | S | voix + LLM |
| L5 | **Vérification de la photo de preuve** (floue, sans colis, prise ailleurs) avant validation | Moins de litiges « jamais reçu » | ★★ | S | vision |

### 3.4 Le client final

| # | Usage | Ce que ça change | Valeur | Effort | IA |
|---|---|---|---|---|---|
| C1 | **Suivi conversationnel sur WhatsApp** : « où est mon colis ? », « livrez plutôt demain », « j'ai changé d'adresse » (avec position) | Moins d'appels au livreur et au marchand ; moins d'échecs | ★★★ | M | LLM + WhatsApp Business API (payant) |
| C2 | **Proposition de créneau** selon les tournées réelles | Plus de livraisons réussies au premier passage | ★★ | M | optimisation |

### 3.5 La comptabilité et la qualité

| # | Usage | Ce que ça change | Valeur | Effort | IA |
|---|---|---|---|---|---|
| F1 | **Explication des écarts de caisse** (quelle commande, quel encaissement manque) et motif proposé | Rapprochement plus rapide, motifs homogènes | ★★ | S | règles + LLM |
| F2 | **Lecture des relevés et preuves de virement** pour marquer les reversements payés | Moins de saisie | ★★ | S | vision / OCR |
| F3 | **Fraude COD enrichie** : schémas appris en plus des règles actuelles | Détection plus fine — décision toujours humaine | ★★ | M | ML |

### 3.6 La plateforme (onboarding, support)

| # | Usage | Ce que ça change | Valeur | Effort | IA |
|---|---|---|---|---|---|
| P1 | **Onboarding assisté** : importer flotte, chauffeurs et marchands depuis leurs fichiers et documents (permis, cartes grises lus par OCR) | Un nouveau transporteur opérationnel en une journée | ★★ | M | LLM + vision |
| P2 | **Assistant d'aide** sur la documentation, dans toutes les consoles | Moins de support humain | ★ | S | RAG |

---

## 4. Refaire l'app livreur

### 4.1 Le constat (ce qui ne va pas aujourd'hui)

- **Une app de liste** : missions → détail → étapes. Rien n'aide à **organiser** la journée.
- **Pas de carte** : l'écran mission affichait « Carte indisponible » ; les boutons d'itinéraire
  (localisation par lien) sont prêts mais pas encore dans un build installé.
- **Pas d'ordre de passage** ni de trajet : le livreur décide seul, sans temps de trajet.
- Des écrans **de démonstration** : récap du jour à 0 avec des valeurs d'exemple, objectifs et
  primes statiques, contact client « non alimenté ».
- **Photo de preuve** bloquée sur l'émulateur (à revérifier sur téléphone réel).
- Beaucoup de saisie au pouce, peu adaptée à la conduite.

### 4.2 La nouvelle expérience proposée : « ma journée, sur une carte »

1. **Écran principal = la carte de la journée** : la tournée optimisée, les arrêts numérotés,
   la position du livreur ; en bas, une **grande carte « prochain arrêt »** (qui, où, quoi
   encaisser, preuve exigée) et **une seule action principale** à la fois.
2. **Navigation en un geste** vers Google Maps / Waze (le lien du client quand il existe) ;
   **arrivée détectée automatiquement** (géorepérage) → l'app propose « Je suis arrivé ».
3. **Missions proposées par l'affectation automatique** : carte d'offre avec compte à rebours,
   Accepter / Refuser, et la tournée se réorganise.
4. **Mode retrait au hub** : scanner les colis en série, caméra ouverte, sans taper.
5. **Encaissement** clair : montant, monnaie à rendre, caisse du jour en temps réel.
6. **Bouton micro permanent** : l'assistant vocal (L1) sur tous les écrans.
7. **Hors réseau d'abord** (déjà en place) : tout reste utilisable sans connexion.
8. **Une main, plein soleil** : contraste fort, cibles de 48 px, mode sombre, arabe RTL.

### 4.3 Comment on s'y prend

1. **Maquettes d'abord** (5 à 8 écrans clés), validées par toi — et idéalement testées avec
   2 ou 3 livreurs réels — avant d'écrire du code.
2. **Moteur d'itinéraires** côté serveur (OSRM auto-hébergé sur le homelab : gratuit, données
   OpenStreetMap) pour l'ordre des arrêts et les temps de trajet.
3. **Carte dans l'app** (MapLibre, libre, ou la même base CARTO que la console).
4. Livraison par étapes : carte + prochain arrêt + navigation → offres d'affectation →
   scan au hub → assistant vocal.

---

## 5. Offre commerciale : « Portrail IA », un module payant

| Formule | Contenu | Logique de prix |
|---|---|---|
| **Inclus dans tous les plans** | Itinéraires optimisés, ETA, prévision simple (ce n'est pas de l'IA générative : coût quasi nul, et c'est ce qui rend le produit meilleur que la concurrence) | — |
| **Portrail IA** | Création de commande depuis un message, import Excel intelligent, copilote dispatcher, brief du matin, assistant vocal livreur, explication des écarts | Forfait mensuel par société + quota d'usage (ex. N conversations / N minutes de voix), puis à l'usage |
| **Portrail IA+** | Suivi client WhatsApp, vérification des preuves photo, fraude enrichie, onboarding assisté | Supplément, car coûts tiers (WhatsApp Business facture chaque conversation) |

Ordres de grandeur des coûts, pour fixer les prix :
- une commande créée depuis un message : **≈ 0,02 à 0,05 DH** ;
- une question au copilote ou à l'assistant du portail : **≈ 0,05 à 0,3 DH** ;
- une minute d'assistant vocal (écoute + réponse) : **≈ 0,1 à 0,3 DH** ;
- un livreur qui parle 15 minutes par jour à l'app : **≈ 50 à 100 DH par mois**.

Un **plafond de consommation par société** (comme celui qu'on a mis sur la clé OpenRouter)
évite toute facture surprise.

---

## 6. Feuille de route proposée

| Phase | Durée | Contenu | Pourquoi d'abord |
|---|---|---|---|
| **1 — Gains rapides** | 3–4 semaines | M1 commande depuis un message · M2 import Excel · D2 brief du matin · F1 explication des écarts | Peu risqués, visibles en démo, prolongent ce qui vient d'être livré |
| **2 — Nouvelle app livreur** | 6–8 semaines | Maquettes validées → carte de la journée, prochain arrêt, navigation, offres d'affectation (L2), scan (L3) | C'est le point le plus faible du produit aujourd'hui |
| **3 — La voix et le copilote** | 6 semaines | L1 assistant vocal FR/darija · D1 copilote avec actions confirmées · M3 assistant du portail | Demande la nouvelle app et des garde-fous solides |
| **4 — Optimisation et prévision** | 6–8 semaines | D4 tournées optimisées · D5 ETA et alertes SLA · D6 prévision de charge | Il faut quelques semaines d'historique réel |
| **5 — Le client** | 4–6 semaines | C1 suivi WhatsApp · C2 créneaux | Dépend du compte WhatsApp Business |

---

## 7. Décisions à prendre

1. **Ordre des chantiers** : commencer par les gains rapides IA (phase 1) ou par la nouvelle app
   livreur (phase 2) ? Les deux peuvent avancer en parallèle.
2. **Fournisseur du modèle de langage** : Claude via l'API Anthropic (contrat de traitement des
   données, hébergement) ou via OpenRouter (plus simple, déjà en place).
3. **Darija** : l'assistant vocal doit-il comprendre la darija dès la première version
   (reconnaissance possible avec Nova-3 « ar-MA », à valider sur de vrais enregistrements de
   livreurs) ou commencer en français ?
4. **WhatsApp Business** : prêt à ouvrir un compte (payant à la conversation) pour le suivi client ?
5. **Prix du module IA** : forfait + quota, ou tout à l'usage ?
