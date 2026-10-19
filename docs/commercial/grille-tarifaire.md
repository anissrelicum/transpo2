# Portrail — Grille tarifaire de lancement

*18 octobre 2026. Proposition à valider. Montants en DH hors taxes (TVA 20 % en sus au Maroc).*

**Légende** : [NV] = chiffre non vérifié sur une source primaire. [H] = hypothèse de travail, à remplacer
par un devis réel.

---

## 1. La proposition en une page

| Offre | Prix mensuel | Pour qui | Inclus |
|---|---|---|---|
| **Essai** | **0 DH, 30 jours** | Tout le monde | Tout le produit, accompagnement à la mise en route |
| **Démarrage** | **390 DH** | Coursier jusqu'à **5 livreurs** | 1 500 commandes/mois, app livreur, portail marchand, caisse COD et reversements, factures, suivi client |
| **Pro** ⭐ | **990 DH** | Société de **6 à 20 livreurs** | 6 000 commandes/mois, + affectation automatique, PC flotte en direct, délais et express, tournées optimisées, API |
| **Business** | **2 490 DH** | Société de **21 à 60 livreurs** | 20 000 commandes/mois, + plusieurs agences/hubs, rôles avancés, support prioritaire |
| **Sur mesure** | sur devis | Au-delà de 60 livreurs | Volume, hébergement dédié, marque blanche |

- **Commandes au-delà du forfait** : 0,20 DH la commande (jamais de blocage en pleine journée).
- **Paiement annuel** : 10 mois payés pour 12 (−17 %).
- **Mise en route** : offerte pour les 10 premiers clients ; ensuite 1 500 DH (import des marchands et
  livreurs, formation des livreurs sur place), offerte sur un engagement annuel.
- **Options futures** (quand elles existeront) : SMS et WhatsApp refacturés au coût + 30 %, marque blanche.

**Pourquoi ce découpage** : un patron de société de livraison raisonne en **nombre de livreurs**, pas en
« commandes incluses ». Le palier est lisible en une seconde ; le volume de commandes sert seulement de
garde-fou (il est large : 300 commandes/livreur/mois).

Changement par rapport au catalogue actuel de l'application (299 / 899 / 2 499 DH par volume de commandes) :
le catalogue est en base et versionné, il se modifie depuis la console plateforme (`/saas/plans`)
sans redéploiement ; les éventuels abonnés gardent leur prix.

---

## 2. Ce que coûte Portrail à faire tourner

### 2.1 Coûts variables (ce qui grossit avec les clients)

| Poste | 10 clients | 50 clients | 200 clients | Source |
|---|---|---|---|---|
| Hébergement production (2–3 serveurs, base Postgres gérée avec sauvegardes, stockage des photos) | ≈ 1 500 DH/mois | ≈ 2 850 DH/mois | ≈ 5 000 DH/mois | Scaleway Paris, tarifs du 18/10/2026 (estimation) |
| **Soit par client** | **≈ 150 DH** | **≈ 57 DH** | **≈ 25 DH** | |
| Fonds de carte | 0 (palier gratuit CARTO 1 M tuiles) | ⚠️ dépassement probable → 500 $/mois chez CARTO | idem | carto.com/basemaps |
| Notifications push (OneSignal) | 0 | 0 (< 1 000 livreurs) | ≈ 19 $ + 0,012 $/livreur actif | onesignal.com/pricing |
| Itinéraires (OSRM) | 0 (auto-hébergé, inclus dans l'hébergement) | 0 | 0 | |
| SMS / WhatsApp | non branchés | — | — | refacturés au client le jour venu |

⚠️ **Action avant le 30 novembre 2026** : CARTO exige désormais une clé enregistrée pour l'usage commercial
(palier gratuit : 1 M de tuiles/mois pour toute l'entreprise, puis 500 $/mois). Une console de dispatch ouverte
toute la journée en consomme vite. **Recommandation : passer au fond de carte auto-hébergé (Protomaps, même
source OpenStreetMap que le moteur d'itinéraires) — coût quasi nul** — avant d'avoir 20 clients.

### 2.2 Coûts fixes mensuels (phase de lancement)

| Poste | Montant/mois | Source / statut |
|---|---|---|
| Hébergement de base | 1 500 DH | ci-dessus |
| Comptable | 1 200 DH | [H] aucun tarif public trouvé — demander 2 devis |
| Assurance RC professionnelle | ≈ 400 DH (≈ 5 000 DH/an) | fourchette 2 500–25 000 DH/an [NV] |
| Outils (e-mail pro, domaines, voix de la vidéo, divers) | 300 DH | [H] |
| Compte Apple (99 $/an) | ≈ 90 DH | developer.apple.com |
| Marketing (publicité Facebook/Instagram/LinkedIn ciblée, déplacements terrain) | 3 000 DH | [H] budget de lancement |
| **Total sans salaire** | **≈ 6 500 DH/mois** | |
| Un commercial terrain (si recruté) | ≈ 7 300 DH chargé (6 000 brut × 1,21) + commission | salaires 2026 [NV] |

### 2.3 Coûts de lancement (une fois)

| Poste | Montant | Source |
|---|---|---|
| Création SARL AU | 5 000 – 15 000 DH | [NV] guides 2026 |
| Dépôt de la marque Portrail (OMPIC, classes 9, 39, 42) | à chiffrer | [H] |
| Google Play | ≈ 270 DH (25 $) | support.google.com |
| Vidéo, site, supports | 0 (faits en interne) | |
| **Total** | **≈ 10 000 – 20 000 DH** | |

> Le statut **auto-entrepreneur** est à éviter : plafond de 200 000 DH/an pour les services et retenue de
> 30 % au-delà de 80 000 DH avec un même client [NV]. La **SARL AU** est plus adaptée à du SaaS B2B.

---

## 3. Le point mort

| Hypothèse | Clients nécessaires (prix moyen 990 DH) |
|---|---|
| Couvrir les coûts fixes sans salaire (≈ 6 500 DH) | **7 clients** |
| + un commercial terrain (≈ 14 000 DH au total) | **15 clients** |
| + un salaire fondateur de 15 000 DH (≈ 29 000 DH au total) | **30 clients** |

La marge brute par client est élevée (hébergement ≈ 25 à 150 DH pour 990 DH facturés, soit **85 à 97 %**) :
le vrai coût de Portrail, ce sont les gens (vente, mise en route, support), pas les serveurs.

---

## 4. Comment on se situe

| | Portrail Pro | Everest Starter | Swiftly Starter | Un dispatcher salarié |
|---|---|---|---|---|
| Prix | **990 DH/mois** | ≈ 5 570 DH/mois (499 €) + 5,6 DH/mission au-delà de 1 500 | 11 000 MAD de licence (périodicité non précisée [NV]) | ≈ 5 450 DH/mois chargé |
| Livreurs | jusqu'à 20 | — | jusqu'à 10 | 1 personne, 8 h/jour |
| Cash et reversements marchands | ✅ | non annoncé | ✅ | à la main, sur Excel |
| Flotte en direct, affectation automatique | ✅ | ✅ | non annoncé | au téléphone |
| Essai gratuit | 30 jours | non | non | — |

**Lecture** : on est 5 fois moins cher que l'étranger le mieux placé et sans ticket d'entrée, là où le
concurrent local demande 11 000 DH d'avance. On reste **assez cher pour être pris au sérieux** : sous
300 DH, un patron pense « gadget ».

---

## 5. L'argument « Portrail plutôt qu'une embauche »

C'est l'argument central de la vente (et de la future partie IA). À présenter comme un calcul que le
prospect refait avec ses propres chiffres.

### 5.1 Ce que coûte aujourd'hui une société de 15 livreurs, 3 000 colis/mois

| Poste | Aujourd'hui (Excel + WhatsApp + téléphone) | Avec Portrail Pro |
|---|---|---|
| Dispatch : affecter les courses, appeler les livreurs, répondre « il est où ? » | **1 dispatcher à plein temps : ≈ 5 450 DH/mois** chargé (4 500 DH brut [NV]) | Affectation automatique : la course part au livreur le plus proche, qui accepte sur son téléphone ; le patron ne traite que les exceptions |
| Rapprochement du cash et reversements marchands | **≈ 2 à 3 jours par mois** d'un comptable ou du patron (≈ 1 500 DH) [H] | Caisse livreur et reversements calculés automatiquement, factures générées |
| Pertes de cash non expliquées | Exemple : 0,5 % d'écart sur 3 000 colis × 250 DH de COD moyen = **≈ 3 750 DH/mois** [H, exemple] | Chaque dirham rattaché à une commande et à un livreur, encaissement plafonné au montant dû |
| Appels clients « où est mon colis ? » | Le livreur décroche en roulant | Lien de suivi en direct pour le client |
| **Total** | **≈ 10 700 DH/mois** | **990 DH/mois** |

**Message** : *« Pour moins que 4 jours de salaire d'un dispatcher, Portrail fait le dispatch,
la caisse et la facturation, 7 jours sur 7, sans erreur de calcul et sans arrêt maladie. »*

### 5.2 Ce qu'on dit honnêtement

- Portrail **ne remplace pas toute supervision** : il faut quelqu'un pour les exceptions (client absent,
  colis abîmé). Dans une société de 5 à 20 livreurs, c'est le patron lui-même, en quelques minutes par
  jour. Au-delà, **un dispatcher gère deux à trois fois plus de livreurs**.
- Les chiffres de pertes de cash et de temps de rapprochement sont des **exemples à recalculer avec le
  prospect**, pas des promesses. Les vrais chiffres viendront des 10 clients pilotes.
- **IA** : aujourd'hui, l'affectation et les tournées sont des **automatisations** (règles et
  algorithmes d'itinéraires). On les vend comme telles. Le mot « IA » viendra avec l'assistant
  (« quelles commandes sont en retard ? », « réaffecte les commandes de Youssef à Imane », création d'une
  commande en collant le message WhatsApp du client), décrit dans `docs/etudes/2026-10-18-ia-et-app-livreur.md`.
  Ce sera alors une option payante (repère : Everest vend son assistant IA de 49 à 399 €/mois).

---

## 6. Ce qu'il faut décider

1. **Valider la grille** (390 / 990 / 2 490 DH, essai 30 jours) — ou garder
   l'actuelle (299 / 899 / 2 499 DH).
2. **Créer la SARL AU** avant la première facture (TVA, contrats, CNDP).
3. **Remplacer CARTO par un fond de carte auto-hébergé** avant le 30 novembre 2026.
4. Demander **2 devis comptables** et **1 devis d'assurance RC pro** pour remplacer les hypothèses.

## Sources

- Scaleway (instances, bases gérées, stockage) : https://www.scaleway.com/en/pricing/
- CARTO Basemaps : https://carto.com/basemaps — Protomaps : https://docs.protomaps.com/basemaps/downloads
- OneSignal : https://onesignal.com/pricing — Expo : https://expo.dev/pricing — Apple : https://developer.apple.com/programs/enroll/
- SMIG 2026 et CNSS : https://humantal.ma/blog/smig-2026-maroc , https://upsilon-consulting.com/cotisations-cnss-2026-taux-assiettes/
- Salaires (dispatcher, commercial, comptable) : https://bghit-nekhdem.com/tectra-recrute-dispatcheur-experimente-sur-mohammedia/ , https://www.jobsquare.ma/blog/commercial-maroc-salaire-carriere/ , https://www.jobsquare.ma/blog/comptable-maroc-salaire-carriere/
- Création SARL : https://upsilon-consulting.com/cout-creation-sarl-maroc-2026/
- Auto-entrepreneur : https://upsilon-consulting.com/auto-entrepreneur/
- Everest : https://geteverest.io/tarifs — Swiftly : https://swiftly.ink
- Conversion : 1 € = 11,16 DH (Bank Al-Maghrib, 7/10/2026, via bladi.net)
