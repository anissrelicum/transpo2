# PRD — Transpo · Vue d'ensemble de la plateforme

**Source** : projet Claude Design *"Transpo — Prompts Claude Design"* (`7671dfdf-e802-4730-96ab-65f0e37e1a87`), maquettes React + Radix UI, données de démonstration marocaines. Analyse exhaustive du code source (`transpo/home.jsx`, `transpo/lib.jsx`, `transpo/lot1.jsx` à `lot14.jsx`).

**Ce document est l'index.** Chaque profil a son propre fichier détaillé :
- [PRD-01-Console-Admin-Dispatcher.md](PRD-01-Console-Admin-Dispatcher.md) — Admin & Dispatcher (inclut les 4 écrans ajoutés : Reversement COD, Remboursements, Centre de notifications, Modération des avis)
- [PRD-02-Portail-Marchand.md](PRD-02-Portail-Marchand.md) — Marchand
- [PRD-Lot3-App-Livreur.md](PRD-Lot3-App-Livreur.md) — Livreur (mobile)
- [PRD-04-Client-Final.md](PRD-04-Client-Final.md) — Client final
- [PRD-05-Console-SaaS.md](PRD-05-Console-SaaS.md) — Super-Admin / exploitant SaaS
- [PRD-06-Authentification.md](PRD-06-Authentification.md) — Auth transverse (login, mot de passe oublié, 2FA, SSO)

---

## 1. Qu'est-ce que Transpo ?

Transpo est une **plateforme SaaS de livraison last-mile** destinée aux transporteurs et coursiers marocains (Casablanca, Rabat, Marrakech, Tanger, Fès, et au-delà). Elle connecte cinq types d'acteurs autour du cycle de vie d'une commande de livraison :

1. Un **marchand** crée une commande de livraison (manuellement ou via API).
2. Un **dispatcher/admin** l'assigne à un **livreur** (manuellement ou par suggestion automatique).
3. Le **livreur** (mobile) retire le colis, le scanne, le livre, encaisse le cash à la livraison (COD) si besoin.
4. Le **client final** suit sa livraison en temps réel (avec ou sans compte) et note le livreur.
5. Un **exploitant SaaS** (super-admin) gère les transporteurs clients de la plateforme elle-même (multi-tenant), leurs abonnements et leur facturation.

La plateforme est elle-même vendue en marque blanche à des sociétés de transport (« tenants ») — Transpo n'est pas un seul transporteur mais l'éditeur du logiciel utilisé par plusieurs transporteurs.

## 2. Les 6 profils utilisateurs

| # | Profil | Interface | Densité / plateforme |
|---|---|---|---|
| 1 | **Administrateur** | Console transport (desktop) | Haute densité, gestion globale |
| 2 | **Dispatcher** | Console transport (desktop) | Haute densité, opérations temps réel |
| 3 | **Marchand** | Portail marchand (desktop + mobile responsive) | Libre-service, sans intervention transporteur |
| 4 | **Livreur** | App mobile (390×844) | Terrain, usage tactile, parfois hors-ligne |
| 5 | **Client final** | Suivi public (sans compte) + App client | Grand public, zéro friction |
| 6 | **Exploitant SaaS (super-admin)** | Console SaaS `/admin` | Gestion des transporteurs clients de Transpo |

Admin et Dispatcher partagent la même Console transport ; leurs permissions diffèrent (voir [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § Rôles).

## 3. Architecture de l'information — sitemap complet

```
Authentification (transverse — Console, Marchand, SaaS)
├── Login ── Mot de passe oublié ── 2FA (6 chiffres)
└── SSO / SAML (Console SaaS uniquement)

Console transport (Admin/Dispatcher)
├── Tableau de bord
├── Commandes ── Créer (assistant 3 étapes) ── Détail commande (6 onglets)
├── Dispatch (carte temps réel) ── Suggestion automatique de livreur
├── Zones (éditeur de polygones géographiques)
├── PC flotte temps réel (géofencing, plein écran)
├── Tournées (planificateur multi-arrêts, réordonnancement + optimisation)
├── Véhicules (flotte, échéances assurance/contrôle technique)
├── Chauffeurs (permis, EU561, disponibilité, horaires)
├── Tarification (grille à paliers + simulateur)
├── Facturation marchands (factures, litiges)
├── Réconciliation cash (COD théorique vs déclaré vs déposé)
├── Tri en hub (scan, manifeste de transfert interurbain)
├── Retours (reverse logistics, tentatives, souffrance)
├── Analytics & SLA (par zone / livreur / marchand)
├── Fraude COD (score de risque, enquêtes)
├── Reversement COD → marchand (agence → marchand, net de commission)   ← ajouté
├── Remboursements (COD encaissé sur commande annulée/retournée)        ← ajouté
├── Centre de notifications admin (conformité, géofence, caisse, SLA)   ← ajouté
├── Modération des avis clients (revue humaine avant impact score)      ← ajouté
├── Modèles de notif. (canaux, consentement Loi 09-08)
└── Utilisateurs & rôles + Paramètres entreprise + Objectifs & primes

Portail marchand (/merchant, desktop + mobile)
├── Tableau de bord
├── Nouvelle commande (assistant 3 étapes)
├── Mes commandes ── Détail (code de suivi copiable)
├── Portefeuille (solde prépayé, recharge, mouvements)
├── Mes factures (+ ouverture de litige)
└── Intégration API (clé secrète, payload exemple, webhooks, logs)

App livreur (mobile, 390×844) — voir PRD-Lot3 pour le détail exhaustif
├── Onboarding / recrutement (4 étapes, avant le 1er shift)               ← ajouté
├── Connexion + permissions (GPS, caméra, notifications)
├── Missions du jour ── Détail mission ── Statut séquentiel ── Preuve ── COD ── Échec
├── Ma tournée (optimisation multi-arrêts)
├── Scanner de colis (retrait / hub / livraison)
├── Ma caisse (cash en main, plafond, dépôt) — intégré au flux            ← ajouté
├── Shift (temps de conduite réglementaire)
├── Profil ── Historique & gains ── Objectifs & primes ── Récap du jour
├── Support (chat dispatch) ── Documents ── Paramètres ── Aide/FAQ
└── Mode hors-ligne (file de synchronisation)

Client final
├── Suivi public sans compte (saisie code à 8 caractères → page de suivi FR/AR)
└── App client (live tracking, choix de créneau + confirmation, messagerie livreur, notation)   ← chat ajouté

Console SaaS /admin (super-admin exploitant)
├── Locataires / tenants (provisioning, suspension, MRR)
├── Abonnements & plans (Essai/TPE/Transporteur/Grand Compte/Sur-mesure)
├── Facturation plateforme (factures aux tenants, relances)
└── Écran de paiement bloquant (impayé / essai expiré / limite atteinte)
```

## 4. Modèle de données partagé

Ce noyau de données (`transpo/lib.jsx`) est partagé par **tous** les profils — toute implémentation doit centraliser ces entités plutôt que les dupliquer par écran.

### 4.1 Commande (Order)
```
ref: "CMD-YYYYMMDD-NNN"          code: 8 car. alphanumériques (scan)
status: enum (cycle de vie ci-dessous)
merchant, from (ville), to (ville), driver (nom | null)
cod: montant à encaisser (0 = prépayé)   codPaid: bool
size: "Petit" | "Moyen" | "Grand" | "Très grand"
urgent: bool
created, eta: horodatages
history: [{ at, label, by }]
```

### 4.2 Cycle de vie du statut (identique partout : mobile, console, suivi public)
```
PROGRAMMEE → NOUVELLE → ASSIGNEE → RETRAIT → RECUPEREE → LIVRAISON → LIVREE
                                                              ↘ ECHOUEE → RETOUR
                                                              ↘ ANNULEE
```
| Statut | FR | AR | Couleur |
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

### 4.3 Livreur (Driver)
```
nom, ville, véhicule (Moto|Voiture|Fourgon|Fourgon frigo), disponible: bool
permis: { catégories, échéance, couleur d'alerte }
contrat: "SALARIE" | "FREELANCE"   tauxCourse (si freelance, DH/course)
conduiteJour / 9h max (règle EU 561/2006)
zoneAssignée, horaires hebdomadaires
```

### 4.4 Autres entités partagées
- **Zone** : polygone géographique, région/province/commune, livreurs affectés.
- **Véhicule** : plaque (format marocain `NNNN-L-NN`), type, équipements (hayon/frigo), échéances assurance & contrôle technique.
- **Objectif (Goal)** : `{ metric, period, target, current, unit, bonus }` — défini par l'admin, consommé identiquement dans Profil livreur ET dans la console admin.
- **Tenant** (SaaS) : organisation cliente de Transpo, plan, statut, véhicules/commandes.
- **Session cash** : COD théorique (livré) vs déclaré (livreur) vs déposé (agence), avec statuts `EQUILIBRE / ECART / A_DEPOSER / DEPOSE / EN_COURS`.
- **Cas de fraude** : score de risque composite (0-100) construit à partir de signaux pondérés (écart de caisse, hors géofence, échec sans preuve, dépôt tardif, taux d'absence anormal, COD non déclaré).
- **Retour** : motif normalisé, compteur de tentatives (max 3), statuts `A_TRAITER / REPLANIFIE / RETOUR_HUB / A_RENDRE / RENDU / SOUFFRANCE`.

## 5. Règles métier transverses (valables sur toute la plateforme)

1. **Devise unique** : Dirham marocain, format `Intl.NumberFormat('fr-FR')` → `"1 250,00 DH"`.
2. **Bilingue FR/AR avec RTL complet** partout où un utilisateur final (livreur, client, marchand) est exposé — pas seulement traduction de texte, inversion de mise en page.
3. **Thème clair/sombre** disponible sur toutes les interfaces (accent indigo, gris slate, Radix Themes comme référence de design tokens).
4. **Numéro de téléphone client toujours masqué** côté livreur — relais d'appel/SMS/WhatsApp par la plateforme.
5. **Cascade tarifaire à 3 niveaux, priorité stricte** : ① prix fixe négocié par marchand → ② remise contractuelle → ③ grille standard à paliers de distance. Le premier niveau applicable l'emporte (voir [PRD-01](PRD-01-Console-Admin-Dispatcher.md) § Tarification).
6. **Commission plateforme** : 15 % par défaut sur le montant net des livraisons, configurable par l'admin ; TVA 20 %.
7. **Conformité temps de conduite (EU 561/2006)** : max 9h/jour, pause obligatoire 45 min après 4h30 cumulées, alerte 30 min avant limite. Bloque l'aptitude à conduire (`canDrive`) au niveau chauffeur.
8. **Consentement obligatoire (Loi 09-08)** avant tout envoi SMS/WhatsApp — canaux marqués d'un cadenas et bloqués sans opt-in explicite du destinataire.
9. **Preuve de livraison paramétrable par commande** : aucune / photo / signature / photo+signature — jamais un seul niveau figé.
10. **Retours plafonnés à 3 tentatives** avant reclassement automatique en retour hub / souffrance.
11. **Score de fraude ≠ sanction automatique** — toute alerte exige une revue humaine ; le livreur doit pouvoir se justifier avant suspension.
12. **Offline-first côté livreur** : toute action (statut, preuve, COD) doit fonctionner hors-ligne, horodatée, mise en file, sans perte ni duplication à la resynchronisation.
13. **Multi-tenant strict** : chaque transporteur (tenant) de la Console SaaS a ses propres véhicules/commandes/quotas — un plan expiré ou une facture impayée bloque l'accès (paywall) sans supprimer les données.
14. **Accessibilité tactile mobile** : cibles ≥ 44–48 px, action principale collée en bas d'écran.

## 6. Stack technique visée

Les maquettes sont en **React + Radix UI Themes** (web, y compris les cadres "téléphone" simulés en 390×844px) mais le texte de la maquette App Livreur précise explicitement une cible **React Native** pour le mobile réel. Les consoles desktop (Admin, Marchand, SaaS) restent des applications web. Carte : Leaflet + tuiles CartoDB (clair/sombre) — à remplacer par Mapbox/Google Maps en production si un meilleur support de géofencing/routing réel est nécessaire.

**État de la maquette — entièrement interactive.** Chaque écran est fonctionnel : aucun bouton mort, aucun filtre décoratif. L'infrastructure repose sur un **`Store` partagé et réactif** (`lib.jsx`) qui porte l'état métier (commandes, livreurs) et un **système de toasts** (`Store.toast` / `ToastHost`) utilisé pour les confirmations (exports, PDF, dépôts…). Les changements de statut, filtres, pagination, formulaires de création (tenant, utilisateur, commande, etc.) modifient réellement l'UI. Voir l'audit `AUDIT-Interactions-Non-Fonctionnelles.md` (marqué ✅ Résolu) pour le détail écran par écran. Réserves de production restantes : les toasts d'export ne produisent pas de vrai fichier, et l'écran d'authentification est une vitrine à transformer en vrai verrou (voir [PRD-06](PRD-06-Authentification.md)).

## 7. Points ouverts transverses

1. **Algorithmes d'optimisation de tournée** (plus proche voisin / distance à vol d'oiseau) sont des heuristiques de démonstration partout où ils apparaissent (App Livreur, Tournées desktop) — à remplacer par un vrai moteur de routing en production.
2. **Scanner caméra et capture de signature** sont simulés dans toutes les maquettes mobiles — nécessitent de vraies libs natives (ML Kit/ZXing, signature-canvas).
3. Le **taux de commission (15 %)** et la **grille tarifaire par défaut** sont-ils identiques pour tous les tenants SaaS, ou négociés par contrat ?
4. Le **score de fraude** et ses pondérations (30/28/22/18/15/35 points par signal) sont-ils fixes ou calibrables par transporteur ?
5. Gestion des **conflits de synchronisation hors-ligne** (deux statuts envoyés en désordre) — non spécifiée, à définir côté backend.
6. Confidentialité **Loi 09-08** : plusieurs écrans y font référence sans contenu réel — page à produire.

## 8. État d'avancement des écrans manquants

Suite à l'audit des manques, une première vague d'écrans a été générée dans Claude Design (`lot15.jsx` Auth, `lot16.jsx` Console admin). État au dernier check :

| # | Écran | Statut | Détail |
|---|---|---|---|
| 1 | Authentification (login, oublié, 2FA, SSO) | ✅ Livré | [PRD-06](PRD-06-Authentification.md) — vitrine, à transformer en vrai gate |
| 4 | Reversement COD → marchand | ✅ Livré | [PRD-01](PRD-01-Console-Admin-Dispatcher.md) §18 |
| 5 | Remboursement COD déjà encaissé | ✅ Livré | [PRD-01](PRD-01-Console-Admin-Dispatcher.md) §19 |
| 6 | Centre de notifications admin | ✅ Livré | [PRD-01](PRD-01-Console-Admin-Dispatcher.md) §20 |
| 9 | Modération des avis clients | ✅ Livré | [PRD-01](PRD-01-Console-Admin-Dispatcher.md) §21 |
| 2 | Onboarding / recrutement livreur | ✅ Livré | [PRD-Lot3](PRD-Lot3-App-Livreur.md) §5.24 — 4 étapes, accessible du login |
| 3 | « Ma caisse » intégrée au flux livreur | ✅ Livré | [PRD-Lot3](PRD-Lot3-App-Livreur.md) §5.25 — accessible du Profil |
| 7 | Chat support client final | ✅ Livré | [PRD-04](PRD-04-Client-Final.md) §2.3 |
| 8 | Conséquence du choix de créneau | ✅ Livré | [PRD-04](PRD-04-Client-Final.md) §2.2 — « Tournée replanifiée · ETA transmise » |
| ±1 | Cohérence `proof_level` | ✅ Livré | app livreur alignée sur `photo_signature` (= API marchand) |
| ±2 | Multi-langue FR/AR (SaaS/Flotte/Facturation/Analytics) | ✅ Livré | **Analytics** (`lot12`) ✅. **Flotte/Facturation** (`lot6`) ✅ — `useL6(lang)` désormais appelé dans les 7 écrans (Véhicules, Chauffeurs, Tarification, Facturation, Notifications, Utilisateurs, Objectifs), ~280 chaînes passées au dictionnaire. **Console SaaS** (`lot5`) ✅ — dictionnaire `SAAS` + `useSaas(lang)` câblés, sélecteur de langue + `dir=rtl` ajoutés à `AdminApp`. |
| ±3 | Clarification double facturation marchand | ✅ Livré | Marchand (`lot4`) : badge mode + callout prépayé/post-payé + portefeuille désactivé en post-payé. Admin (`lot6`) : carte « Mode de facturation par marchand » sur l'écran Facturation. Réserve : les deux côtés n'utilisent pas le même store. |

**Qualité des écrans livrés** : conformes aux conventions du projet (`window.Transpo`, palette, `money()`, thème clair/sombre), correctement câblés (menu `lib.jsx` `NAV` pour l'admin ; `SCREEN_LIST` pour l'app livreur ; showcase client). L'ancien écran « Notifications » a été renommé « Modèles de notif. » pour le distinguer du nouveau Centre de notifications.

**Bilan — terminé ✅** : les **9 écrans manquants** (vague 1 : 1, 4, 5, 6, 9 ; vague 2 : 2, 3, 7, 8) **et les 3 corrections de cohérence** (`proof_level`, double facturation, bilingue FR/AR) sont tous livrés et câblés. La correction ±2 a nécessité 2 relances (le premier essai avait laissé le dictionnaire `lot6` en code mort et n'avait pas touché `lot5`), corrigées à la vague suivante. Reste, en production, quelques réserves d'intégration mineures notées dans les fiches (Auth = vitrine à transformer en vrai gate ; store du mode de facturation à unifier admin↔marchand).

## 9. Interactivité complète (audit → correction)

Un audit dédié (`AUDIT-Interactions-Non-Fonctionnelles.md`) a recensé ~60 éléments qui, à l'écran, **ne réagissaient pas au clic** ou **ne calculaient rien** (boutons sans handler, filtres/pagination décoratifs, fonctions sans écran-cible). **Tous ont été corrigés et re-vérifiés dans le code** — le design fonctionne désormais comme une vraie application :

| Domaine | Avant | Après (vérifié) |
|---|---|---|
| Shell (transverse) | recherche/cloche/avatar inertes | recherche filtre les commandes ; cloche → centre de notifs ; menu avatar |
| Console SaaS | quasi 100 % statique | provisioning (formulaire réel), suspendre/réactiver/déprovisionner, fiche tenant, exports |
| Commandes | filtres & pagination factices | filtres Ville/Marchand/Livreur réels + pagination à état |
| Marchand | « Créer » ne créait rien | branché au `Store` (comme le Lot 1) |
| Flotte/Facturation | génération/invitation/édition mortes | dialogs réels + toasts |
| Hub / Retours / Cash / Fraude | actions de statut sans effet | déplacent le colis / changent le statut réellement |
| PC flotte | zoom & navigation morts | zoom carte réel, Suivre, Gérer les zones → éditeur |
| Exports (partout) | inertes | toast de confirmation (fichier réel = production) |

**Socle technique de la correction** : ajout au `Store` partagé d'un **système de toasts** (`Store.toast` + `ToastHost` + `window.Transpo.toast`), réutilisé par tous les écrans — pas de bricolage local. Aucun code mort : chaque handler ajouté est réellement appelé.
