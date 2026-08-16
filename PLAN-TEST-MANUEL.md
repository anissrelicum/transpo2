# Plan de test manuel — Transpo

Recette fonctionnelle complète, à exécuter **à la main**, **sur une base vide** dans laquelle
seul l'**admin plateforme (super-admin)** subsiste. Tout le reste — organisations, utilisateurs,
chauffeurs, véhicules, zones, commandes — est créé par le testeur au fil des cas.

Le document se lit dans l'ordre : **§0 préparation** → **§1 cartographie des pages/boutons** →
**§2 cas de test** (les cas se chaînent : les données créées en TC-01 servent en TC-40).
La **§3** liste ce qui est connu comme démo/non branché (à ne pas déclarer en bug),
la **§4** est la feuille de suivi à remplir.

---

## 0. Préparation

### 0.1 Environnements

| Cible | Console transport (tenant) | Console plateforme | Portail marchand | API |
|---|---|---|---|---|
| **Prod (Dokku)** | `https://<slug>.transpo.wedo.technology` | `https://transpo.wedo.technology/login?realm=saas` | `https://<slug>.transpo.wedo.technology/portail` | `https://api.transpo.wedo.technology` |
| **Local (Docker)** | `http://localhost:3001/login?org=<slug>` | `http://localhost:3001/login?realm=saas` | `http://localhost:3001/portail` | `http://localhost:3000` |

- Le **tenant est résolu par le sous-domaine**. En local (pas de sous-domaine), on force
  l'organisation avec le paramètre `?org=<slug>` sur la page de login.
- Certificat **self-signed** en prod → avertissement navigateur attendu, on continue.
- Apps mobiles : `apps/driver-app` (livreur) et `apps/client-app` (client) via Expo
  (`pnpm --filter driver-app start`, puis Expo Go / simulateur).

### 0.2 Remise à zéro (⚠️ destructif)

Supprime **tous** les schémas `tenant_*`, toutes les lignes `platform.tenants` et le journal
d'audit. **Conserve uniquement `platform.super_admins`**, et garantit qu'un super-admin
utilisable existe.

```bash
# Local
RESET_CONFIRM=oui pnpm --filter @transpo/db reset-test

# Prod (depuis la VM Dokku, avec DATABASE_URL de l'app)
dokku run transpo-api sh -c 'RESET_CONFIRM=oui pnpm --filter @transpo/db reset-test'
```

Variables optionnelles : `SUPER_ADMIN_EMAIL` (défaut `ops@transpo.ma`),
`SUPER_ADMIN_PASSWORD` (défaut `transpo`), `SUPER_ADMIN_NAME`.

**Vérification du point de départ** — après le reset :
- `https://transpo.wedo.technology/login?realm=saas` → connexion `ops@transpo.ma` / `transpo` OK ;
- page **Organisations** vide (0 tenant) ;
- toute tentative de connexion à un tenant échoue (aucun tenant n'existe).

### 0.3 Trou fonctionnel à connaître AVANT de commencer

> **Aucune interface ne permet de créer le premier utilisateur d'un tenant.**
> La console plateforme provisionne le schéma et la ligne tenant, mais **ne crée aucun compte**.
> La page **Utilisateurs** d'un tenant ne sait inviter que `ADMIN`/`DISPATCHER`/`COMPTABLE`
> — et il faut déjà être connecté comme ADMIN pour y accéder.
> Il n'existe **aucun écran** de création de compte `MERCHANT` ni `DRIVER`
> (« Ajouter un chauffeur » crée une **fiche RH**, pas un identifiant de connexion).

C'est une **anomalie produit à consigner** (voir AN-01, AN-02 en §3). Pour dérouler la recette,
on amorce chaque compte manquant en ligne de commande :

```bash
# Usage : <slug> <email> "<Nom>" <ROLE> <motdepasse> ["<scope>"]
pnpm --filter @transpo/db account -- rabatexpress admin@rabatexpress.ma "Nadia Alaoui" ADMIN Test1234
pnpm --filter @transpo/db account -- rabatexpress marchand@rabatexpress.ma "Boutique Test" MERCHANT Test1234 "Boutique Test"
pnpm --filter @transpo/db account -- rabatexpress livreur@rabatexpress.ma "Hamid Ouali" DRIVER Test1234 "Hamid Ouali"
```

Le `scope` (6ᵉ argument) doit être **exactement** le nom du marchand tel qu'il sera saisi dans
les commandes, ou le nom du chauffeur tel que créé dans **Chauffeurs**.

### 0.4 Jeu de données à créer par le testeur (référence pour toute la recette)

| Élément | Valeur à utiliser |
|---|---|
| Organisation 1 | slug `rabatexpress`, nom `Rabat Express`, ville `Rabat`, plan `Transporteur` |
| Organisation 2 (isolation) | slug `tangerlog`, nom `Tanger Logistique`, ville `Tanger`, plan `TPE Coursier` |
| Admin org 1 | `admin@rabatexpress.ma` / `Test1234` |
| Dispatcher org 1 | `dispatch@rabatexpress.ma` (invité depuis l'UI, mdp temporaire affiché) |
| Comptable org 1 | `compta@rabatexpress.ma` (invité depuis l'UI) |
| Marchand org 1 | `marchand@rabatexpress.ma` / `Test1234`, marchand `Boutique Test` |
| Chauffeur 1 | `Hamid Ouali`, Rabat, Moto, permis `ZZ111111` échéance `2029-01-01`, visite `2029-01-01` |
| Chauffeur 2 | `Sara Bennis`, Rabat, Fourgon, permis `ZZ222222`, **visite médicale échue** (date passée) |
| Véhicule 1 | `1111-A-11`, Fourgon, Rabat, assurance `2029-01-01`, CT `2029-01-01` |
| Véhicule 2 | `2222-B-22`, Moto, Rabat, **assurance échue** (date passée) |
| Zone 1 | `Rabat Centre`, couleur indigo, polygone dessiné, chauffeur `Hamid Ouali` |
| Compte livreur | `livreur@rabatexpress.ma` / `Test1234`, lié au chauffeur `Hamid Ouali` |

---

## 1. Cartographie — où cliquer

### 1.1 Console plateforme (super-admin) — `/saas`

| Page | Éléments cliquables |
|---|---|
| `/saas` **Organisations** | champ *Rechercher (slug, nom, ville)*, filtre *Tous statuts*, bouton **Provisionner** (dialogue : Slug, Nom, Ville, Plan → **Annuler** / **Provisionner**), menu « … » par ligne : **Changer le plan** (→ **Enregistrer**), **Activer**, **Repasser en essai**, **Suspendre** (confirmation) |
| `/saas/billing` **Facturation** | tableau montant/plan/usage par tenant |
| `/saas/plans` **Plans** | catalogue (Essai 0 DH/50, TPE Coursier 299 DH/500, Transporteur 899 DH/5000, Entreprise 2499 DH/illimité) + répartition du parc |

### 1.2 Console transport (tenant) — barre latérale

| Groupe | Entrée | Route |
|---|---|---|
| Pilotage | Tableau de bord / Commandes / Analytique / Fraude | `/dashboard` `/orders` `/analytics` `/fraud` |
| Exploitation | Tournées / Dispatch / PC flotte / Zones / Hub / Retours | `/tournees` `/dispatch` `/fleet` `/zones` `/hub` `/returns` |
| Flotte | Véhicules / Chauffeurs | `/vehicles` `/drivers` |
| Finance | Tarification / Factures / Caisse / Reversements | `/pricing` `/invoices` `/cash` `/payout` |
| Administration | Utilisateurs / Notifications / Avis / Modèles / Paramètres | `/users` `/notifications` `/reviews` `/templates` `/settings` |

**Barre supérieure (toutes les pages)** : recherche globale (Entrée → `/orders?q=`),
bascule **clair/sombre** (icône lune/soleil), **cloche** de notifications,
**sélecteur de langue FR/AR**, menu avatar → **Se déconnecter**.

### 1.3 Boutons d'action par page (console transport)

| Page | Actions |
|---|---|
| `/orders` | recherche, filtres *Statut / Ville / Marchand / Livreur*, **Réinitialiser**, cases à cocher → **Assigner** / **Faire avancer** (masse), pagination, menu « … » : **Voir le détail**, **Assigner à** ›, **Faire progresser**, **Annuler** |
| `/orders/new` | assistant 3 étapes : **Continuer** / **Précédent** / **Créer la commande**, retour **Retour aux commandes** |
| `/orders/[ref]` | copie du code, onglets **Détails / Preuve de livraison / Historique / Facturation**, menu d'actions : **Assigner à**, **Faire progresser**, **Encaisser le COD**, **Annuler** |
| `/dispatch` | zoom ±, **Actualiser**, carte (livreurs / commandes), **Affecter** par commande → dialogue *Assigner un livreur* (score /100) → **Choisir** / **Fermer** |
| `/tournees` | **Nouvelle tournée** (livreur, jour, sélection d'arrêts → **Créer**), **Optimiser l'ordre**, réordonnancement, **Valider la tournée** puis **Clôturer** |
| `/fleet` | **Plein écran** / **Quitter le plein écran**, **Suivre**, **Localiser** (alerte hors zone), **Gérer les zones** |
| `/zones` | **Nouvelle zone**, **Dessiner un polygone** / **Effacer**, **Ajouter** un livreur, **Enregistrer**, **Supprimer la zone** |
| `/hub` | champ *Scanner ou saisir un code colis (8 car.)* → **Enregistrer l'entrée**, **Marquer scanné**, **Placer sur quai**, **Manifeste** → **Sceller le bordereau** |
| `/returns` | onglets **Retours actifs / Clôturés**, ligne → panneau : **Reprogrammer une tentative (n/3)**, **Lancer le retour au marchand** |
| `/vehicles` | **Ajouter un véhicule** → **Ajouter**, menu : états **ACTIF / MAINTENANCE / HORS SERVICE**, **Renouveler** (assurance/CT) → **Enregistrer**, **Retirer** |
| `/drivers` | **Ajouter un chauffeur** → **Ajouter**, menu : **Rattacher un véhicule** → **Enregistrer**, renouvellement permis/visite → **Enregistrer**, **Retirer** |
| `/pricing` | grille par distance, suppléments, remise, **Simulateur de devis**, **Export grille**, **Enregistrer** |
| `/invoices` | **Générer les factures**, **Export CSV**, fiche : **PDF** / **Revoir**, **Envoyer**, **Marquer payée**, **Ouvrir litige** → **Ouvrir le litige**, **Traiter le litige** → **Valider** |
| `/cash` | sélection d'une session : **Enregistrer le dépôt en agence**, **Résoudre l'écart de X** → **Valider la résolution**, **Export comptable** |
| `/payout` | **Générer les reversements**, **Reverser à …** (méthode + référence) → **Confirmer**, export CSV |
| `/fraud` | liste des cas + classement, fiche : **Ouvrir une enquête**, **Confirmer** (la fraude), **Blanchir** |
| `/users` | **Inviter** (Nom, Email, Rôle) → mot de passe temporaire affiché **une seule fois** (**Copier**), menu : **Changer de rôle**, **Réinitialiser le mot de passe**, **Désactiver** / **Réactiver** |
| `/notifications` | filtres canal/statut, **Envoyer une notification** (destinataire, canal, langue, message, aperçu) → **Envoyer**, **Réessayer** sur un échec, section **Consentement marketing** |
| `/templates` | **Nouveau modèle** → **Créer**, édition → **Enregistrer**, **Rétablir** (valeur d'origine) |
| `/reviews` | filtres note, distribution, lien vers la commande |
| `/settings` | Identité légale, Adresse, Commission & TVA, Régional (devise, fuseau, langue) → **Enregistrer** |
| `/analytics` | répartition par statut, motifs d'échec, tableaux marchands/chauffeurs |
| `/dashboard` | KPI + alertes conformité (Assurance, Contrôle technique) + raccourcis |

### 1.4 Portail marchand — `/portail`

| Page | Éléments |
|---|---|
| `/portail` | KPI (Commandes, Livrées, En cours, COD à encaisser), **Voir mes commandes**, **Tout voir** |
| `/portail/commandes` | onglets **Toutes / En cours / Livrées / Incidents**, recherche |
| `/portail/portefeuille` | COD encaissé, calcul du solde, **Net à reverser** |
| `/portail/facture` | Contre-remboursement encaissé, Commission du transporteur, Net HT, Total TTC |

### 1.5 App livreur (mobile)

| Écran | Éléments |
|---|---|
| Login | Organisation, Email, Mot de passe, **Se connecter**, bascule **FR/AR**, **Devenir livreur** (→ onboarding démo) |
| Permissions | **Autoriser** Localisation / Caméra / Notifications → **Continuer** |
| Onglet **Missions** | liste des missions, cloche → **Notifications**, bandeau **hors ligne** / file d'attente → **Synchronisation** |
| Onglet **Ma tournée** | arrêts ordonnés |
| Onglet **Scanner** | segments *Retrait / Livraison*, saisie manuelle → **Valider**, **Scanner** |
| Onglet **Shift** | compteurs EU 561, **Démarrer / Arrêter le service** |
| Onglet **Profil** | disponibilité, accès **Historique & gains**, **Mes documents**, **Objectifs & primes**, **Récap du jour**, **Signaler un incident**, **Support dispatch**, **Aide / FAQ**, **Paramètres** |
| Mission `/mission/[ref]` | détail + **Naviguer** → **Progression** (étapes) → **Échec de livraison** ou **Preuve** → COD → **Livraison réussie** |

### 1.6 App client (mobile)

| Écran | Éléments |
|---|---|
| Accueil | *Code de suivi* → **Suivre** |
| Suivi `/track/[code]` | statut, étapes, **Notez votre livraison** (1–5 ★) → **Envoyer** |

---

## 2. Cas de test

Convention : **PRÉ** = préconditions, **PAS** = pas à pas, **ATT** = résultat attendu.
Les cas s'exécutent dans l'ordre.

### A. Plateforme & provisioning (super-admin)

**TC-A01 — Connexion super-admin**
PRÉ : base réinitialisée (§0.2).
PAS : ouvrir `/login?realm=saas` → badge **Plateforme** affiché → `ops@transpo.ma` / `transpo` → **Se connecter**.
ATT : redirection vers `/saas`, liste d'organisations **vide**.

**TC-A02 — Bascule de realm sur la page de login**
PAS : depuis `/login?realm=saas`, cliquer le lien de bascule en bas de carte.
ATT : le badge passe de **Plateforme** à l'organisation détectée et l'email pré-rempli change ; re-cliquer revient à la plateforme.

**TC-A03 — Provisionner l'organisation 1**
PAS : `/saas` → **Provisionner** → Slug `rabatexpress`, Nom `Rabat Express`, Ville `Rabat`, Plan `Transporteur` → **Provisionner**.
ATT : la ligne apparaît (statut **Essai** par défaut si non forcé), schéma créé côté base.

**TC-A04 — Slug réservé refusé**
PAS : **Provisionner** avec le slug `api` (puis `www`, `admin`).
ATT : erreur explicite « Slug réservé à l'infrastructure », rien n'est créé.

**TC-A05 — Slug en doublon refusé**
PAS : re-provisionner `rabatexpress`.
ATT : erreur « Tenant déjà existant », aucune duplication dans la liste.

**TC-A06 — Provisionner l'organisation 2 (isolation)**
PAS : provisionner `tangerlog` / `Tanger Logistique` / `Tanger` / `TPE Coursier`.
ATT : 2 organisations listées.

**TC-A07 — Recherche et filtre**
PAS : taper `tanger` dans la recherche ; puis filtrer sur chaque statut.
ATT : filtrage réel de la liste, **Réinitialiser** l'état (vider le champ) restaure les 2 lignes.

**TC-A08 — Changer le plan**
PAS : menu « … » de `rabatexpress` → **Changer le plan** → `Entreprise` → **Enregistrer**.
ATT : plan mis à jour dans la liste ; le bouton **Enregistrer** est désactivé si le plan choisi est identique.

**TC-A09 — Activer / repasser en essai**
PAS : menu → **Activer**, vérifier ; puis **Repasser en essai**, vérifier ; remettre **Activer**.
ATT : le statut change à chaque fois.

**TC-A10 — Facturation plateforme**
PAS : `/saas/billing`.
ATT : une ligne par organisation, montant mensuel cohérent avec le plan, usage (nb de commandes) à 0 à ce stade.

**TC-A11 — Catalogue des plans**
PAS : `/saas/plans`.
ATT : 4 plans avec tarifs et quotas ; la répartition du parc reflète TC-A08 (1 Entreprise, 1 TPE Coursier).

**TC-A12 — Cloisonnement du realm plateforme**
PAS : connecté en super-admin, tenter d'ouvrir `/dashboard` puis `/orders`.
ATT : accès refusé / redirection vers le login — un super-admin n'entre pas dans un tenant.

#### A-bis. Catalogue de plans (lot L1 — `design/SPEC-PLANS-ABONNEMENTS.md`)

PRÉ : `pnpm --filter @transpo/db migrate` puis `pnpm --filter @transpo/db migrate-plans`
(amorce les 4 plans historiques en base). `/saas/plans` doit lister 4 plans, chacun en
mode **Forfait** avec un tarif **v1**.

**TC-A13 — Créer un plan à l'usage avec paliers**
PAS : `/saas/plans` → **Nouveau plan** → libellé FR `Pay as you go`, libellé AR, code auto-rempli
`pay-as-you-go` → **Créer le plan**. Puis menu « … » → **Nouvelle version de tarif** → mode
**À l'usage** → saisir 3 paliers : 1–100 à `6`, 101–500 à `4.50`, 501+ à `3` → **Publier le tarif**.
ATT : le bandeau ambre « plan sans tarif » disparaît ; la carte affiche « À l'usage — dès 3 DH/cmd »
et « 3 paliers · rétroactif ».

**TC-A14 — Grille non contiguë refusée**
PAS : dans l'éditeur de paliers, forcer un trou (mettre la borne haute du palier 1 à `50` alors que
le palier 2 commence à `101` — éditer directement le champ « À »).
ATT : message rouge « Paliers 1 et 2 non contigus : le suivant doit commencer à 51 », bouton
**Publier le tarif** désactivé. L'appel API direct est également refusé (400).

**TC-A15 — Simulateur : l'écart VOLUME / GRADUÉ**
PAS : avec la grille de TC-A13, saisir `600` dans le **Simulateur**.
ATT : **1 800 DH** en lecture *Rétroactif*, et le rappel « (en par tranche : 2 700 DH) ».
Basculer sur *Par tranche* inverse les deux montants.

**TC-A16 — Le prix est gelé pour les abonnés**
PAS : sur un plan ayant ≥ 1 abonné, créer une **v2** à un tarif différent avec une date d'effet
au lendemain → puis **Historique des tarifs**.
ATT : v1 passe en période fermée (`… → veille`) mais **conserve ses abonnés** ; v2 est « courante »
avec 0 abonné. Aucune facture existante n'est modifiée.

**TC-A17 — Date d'effet antérieure refusée**
PAS : créer une version avec une date d'effet ≤ celle de la version courante.
ATT : champ en rouge « Doit être postérieure au AAAA-MM-JJ », publication impossible.

**TC-A18 — Archivage protégé**
PAS : menu d'un plan **avec** abonnés → **Archiver** → confirmer. Puis archiver un plan **sans** abonné.
ATT : le premier est refusé (« N organisation(s) sont abonnées à ce plan »), le second est archivé,
sort du sélecteur de plan de `/saas` et n'apparaît que si l'on active **Afficher les plans archivés**.
**Restaurer** le remet au catalogue.

**TC-A19 — Code de plan en doublon**
PAS : créer un plan avec un code déjà pris.
ATT : erreur « Plan déjà existant : <code> », rien n'est créé.

**TC-A20 — Traçabilité**
PAS : après TC-A13 à TC-A18, consulter `/v1/audit`.
ATT : les actions `plan.create`, `plan.version`, `plan.archive`, `plan.restore` sont tracées avec
leur acteur et leur cible.

> Les cas d'abonnement (expiration d'essai, suspension automatique, factures plateforme)
> arrivent avec les lots **L2** et **L3** — cf. §11 de la spec. À ce stade, `/saas/billing`
> et les boutons **Activer / Repasser en essai / Suspendre** de `/saas` gardent leur
> comportement manuel actuel (TC-A09, TC-B05 inchangés).

### B. Amorçage des comptes & authentification

**TC-B01 — Un tenant provisionné n'a aucun compte**
PAS : `/login?org=rabatexpress` → `admin@rabatexpress.ma` / n'importe quoi → **Se connecter**.
ATT : « Identifiants invalides ». *Consigner AN-01 (§3).*

**TC-B02 — Amorçage de l'admin (contournement documenté)**
PAS : exécuter la commande `account` de §0.3 pour `admin@rabatexpress.ma`.
ATT : la connexion `/login?org=rabatexpress` avec `Test1234` aboutit sur `/dashboard`.

**TC-B03 — Tenant inconnu**
PAS : `/login?org=inexistant` → n'importe quel identifiant.
ATT : erreur « Tenant inconnu : inexistant » (400).

**TC-B04 — Anti-bruteforce**
PAS : sur `/login?org=rabatexpress`, 6 tentatives avec un mauvais mot de passe.
ATT : les 5 premières → « Identifiants invalides » ; la 6ᵉ → **429 « Trop de tentatives. Réessayez plus tard. »**. Attendre ou changer d'email pour la suite.

**TC-B05 — Paywall : organisation suspendue**
PAS : en super-admin, **Suspendre** `rabatexpress` (confirmer) ; puis tenter de se connecter sur `/login?org=rabatexpress`.
ATT : « Espace suspendu — contactez la plateforme. » — connexion bloquée. **Réactiver** ensuite (TC-A09) et vérifier que la connexion repasse.

**TC-B06 — Déconnexion**
PAS : connecté en admin → menu avatar → **Se déconnecter**.
ATT : retour `/login`, et un accès direct à `/orders` renvoie au login (cookies purgés).

**TC-B07 — Invitation d'un dispatcher**
PAS : `/users` → **Inviter** → Nom `Reda Ziani`, email `dispatch@rabatexpress.ma`, rôle **Dispatcher** → **Inviter**.
ATT : dialogue **Mot de passe temporaire** affiché une seule fois, bouton **Copier** fonctionnel. Noter le mot de passe.

**TC-B08 — Invitation d'un comptable**
PAS : idem avec `compta@rabatexpress.ma`, rôle **Comptable**.
ATT : compte créé, listé.

**TC-B09 — Email invalide / doublon**
PAS : inviter `pasunemail` ; puis réinviter `dispatch@rabatexpress.ma`.
ATT : « Email invalide. » puis « Cet email est déjà utilisé. ».

**TC-B10 — Connexion des comptes invités**
PAS : se déconnecter, se connecter avec le dispatcher puis avec le comptable (mots de passe temporaires).
ATT : les deux atterrissent sur `/dashboard`, le nom et le rôle s'affichent dans la barre supérieure.

**TC-B11 — Réinitialisation de mot de passe**
PAS : en admin, `/users` → menu du dispatcher → **Réinitialiser le mot de passe**.
ATT : nouveau mot de passe temporaire affiché ; l'ancien ne fonctionne plus, le nouveau fonctionne.

**TC-B12 — Changement de rôle**
PAS : `/users` → menu du comptable → **Changer de rôle** → `Dispatcher` → **Enregistrer**.
ATT : rôle mis à jour ; reconnexion → l'accès correspond au nouveau rôle. Remettre **Comptable**.

**TC-B13 — Désactivation / réactivation**
PAS : **Désactiver** le dispatcher (confirmation) → tenter sa connexion → puis **Réactiver**.
ATT : connexion refusée quand inactif, rétablie après réactivation.

**TC-B14 — Protection du dernier admin**
PAS : tenter de **Désactiver** l'unique compte ADMIN, puis de lui **Changer de rôle**.
ATT : refus explicite — il doit rester au moins un administrateur actif.

**TC-B15 — RBAC console (matrice)**
PAS : pour chaque rôle, se connecter et parcourir les pages.
ATT :

| Page / action | ADMIN | DISPATCHER | COMPTABLE |
|---|:--:|:--:|:--:|
| Commandes : créer / assigner / faire progresser / annuler | ✅ | ✅ | ❌ (lecture) |
| Dispatch, Zones, Hub, Retours, Tournées : écriture | ✅ | ✅ | ❌ |
| Chauffeurs / Véhicules : ajouter, retirer, renouveler | ✅ | ❌ (dispo seule) | ❌ |
| Caisse, Reversements, Factures : écriture | ✅ | ❌ | ✅ |
| Tarification (enregistrer la grille) | ✅ | ❌ | ❌ |
| Fraude (arbitrage) | ✅ | ❌ | ❌ |
| Utilisateurs, Paramètres, Modèles de notification | ✅ | ❌ | ❌ |
| Notifications (journal / envoi) | ✅ | ✅ | ❌ (journal seul) |
| Analytique, Avis | ✅ | ✅ | ✅ |

Toute action interdite doit être **absente ou désactivée** dans l'UI **et** refusée par l'API (403) si l'URL est appelée directement.

### C. Paramètres de l'organisation

**TC-C01 — Renseigner l'identité légale**
PAS : `/settings` → Raison sociale, ICE/RC, adresse complète → **Enregistrer**.
ATT : bouton passe à **Enregistré ✓** ; après rechargement de la page, les valeurs persistent.

**TC-C02 — Commission & TVA**
PAS : régler la commission plateforme (ex. 15 %) et la TVA (20 %) → **Enregistrer**.
ATT : persistance ; ces taux se retrouvent dans la facture marchand (TC-N03).

**TC-C03 — Régional**
PAS : devise, fuseau horaire, langue par défaut → **Enregistrer**.
ATT : persistance.

**TC-C04 — Écriture réservée à l'admin**
PAS : se connecter en dispatcher → `/settings`.
ATT : consultation possible, **Enregistrer** absent/refusé (403 côté API).

### D. Référentiel flotte

**TC-D01 — Ajouter un véhicule conforme**
PAS : `/vehicles` → **Ajouter un véhicule** → `1111-A-11`, Fourgon, Rabat, assurance `2029-01-01`, CT `2029-01-01` → **Ajouter**.
ATT : ligne créée, état **ACTIF**, aucune alerte de conformité.

**TC-D02 — Ajouter un véhicule non conforme**
PAS : ajouter `2222-B-22`, Moto, Rabat, **assurance à une date passée**.
ATT : véhicule créé avec un signal d'alerte assurance ; il remonte dans les alertes du `/dashboard` (bloc **Assurance**).

**TC-D03 — Changer d'état**
PAS : menu du véhicule 1 → **MAINTENANCE**, vérifier ; → **HORS SERVICE**, vérifier ; → **ACTIF**.
ATT : l'état change à chaque fois et est reflété dans la liste.

**TC-D04 — Renouveler un document**
PAS : menu du véhicule 2 → renouveler l'assurance avec une date future → **Enregistrer**.
ATT : l'alerte disparaît de la liste et du tableau de bord.

**TC-D05 — Retirer un véhicule**
PAS : créer un véhicule jetable, puis menu → **Retirer** → confirmer.
ATT : suppression effective ; tenter de retirer un véhicule **rattaché à un chauffeur** doit être refusé ou détacher proprement (consigner le comportement observé).

**TC-D06 — Ajouter les chauffeurs**
PAS : `/drivers` → **Ajouter un chauffeur** → `Hamid Ouali` (données §0.4) → **Ajouter** ; puis `Sara Bennis` avec une **visite médicale échue**.
ATT : les deux fiches existent ; `Sara Bennis` est marquée non conforme / **non affectable**.

**TC-D07 — Téléphone invalide**
PAS : créer un chauffeur avec le téléphone `abc`.
ATT : refus « Téléphone invalide. ».

**TC-D08 — Rattacher un véhicule**
PAS : menu de `Hamid Ouali` → **Rattacher un véhicule** → `1111-A-11` → **Enregistrer**.
ATT : la plaque apparaît sur la fiche chauffeur.

**TC-D09 — Régulariser un chauffeur**
PAS : renouveler la visite médicale de `Sara Bennis` avec une date future → **Enregistrer**.
ATT : elle redevient **affectable**.

**TC-D10 — Disponibilité**
PAS : basculer la disponibilité de `Sara Bennis` sur *indisponible* (accessible aussi au dispatcher).
ATT : bascule persistée ; un chauffeur indisponible ne doit plus être proposé par le dispatch (vérifié en TC-F03).

**TC-D11 — Retirer un chauffeur**
PAS : créer un chauffeur jetable → **Retirer** → confirmer.
ATT : suppression effective ; le retrait d'un chauffeur avec des courses en cours doit être refusé (consigner).

### E. Zones

**TC-E01 — Créer une zone**
PAS : `/zones` → **Nouvelle zone** → nom FR `Rabat Centre`, nom AR, couleur indigo → **Dessiner un polygone** → cliquer 4 sommets sur la carte → **Enregistrer**.
ATT : zone visible dans la liste et tracée sur la carte.

**TC-E02 — Effacer le tracé en cours**
PAS : rouvrir la zone → **Dessiner un polygone** → 2 clics → **Effacer**.
ATT : les sommets disparaissent sans supprimer la zone tant qu'on n'enregistre pas.

**TC-E03 — Affecter un livreur à la zone**
PAS : dans l'éditeur → **Ajouter** → `Hamid Ouali` → **Enregistrer**.
ATT : l'initiale/le nom du chauffeur apparaît sur la zone ; quand tous sont affectés, le message « Tous les livreurs sont affectés. » s'affiche.

**TC-E04 — Retirer un livreur / supprimer une zone**
PAS : retirer le livreur → **Enregistrer** ; créer une zone jetable → **Supprimer la zone**.
ATT : les deux opérations sont effectives après rechargement.

**TC-E05 — Zones visibles au dispatch et au PC flotte**
PAS : ouvrir `/dispatch` puis `/fleet`.
ATT : le cercle/la zone `Rabat Centre` est affiché sur les deux cartes.

### F. Commandes — cycle de vie complet

**TC-F01 — Créer la première commande (assistant)**
PAS : `/orders` → **Nouvelle commande** (ou `/orders/new`) → étape 1 : marchand `Boutique Test` (champ libre, la liste est vide au départ), description, taille `Moyen`, niveau de preuve `photo` → **Continuer** → étape 2 : expéditeur/destinataire, villes `Rabat` → `Casablanca` → **Continuer** → étape 3 : COD `450` → **Créer la commande**.
ATT : redirection vers la commande créée, référence `CMD-…` et code de suivi 8 caractères générés, statut **Nouvelle**.

**TC-F02 — Créer un jeu de commandes**
PAS : répéter TC-F01 pour obtenir **au moins 6 commandes** : 2 avec COD, 2 prépayées (COD = 0), 1 avec preuve `photo_signature`, 1 avec preuve `aucune`, villes variées.
ATT : toutes listées dans `/orders`.

**TC-F03 — Assignation depuis le dispatch (score)**
PAS : `/dispatch` → une commande non affectée → **Affecter** → dialogue *Assigner un livreur*.
ATT : les chauffeurs sont classés par score /100 avec le détail **Zone /40 + Dispo /30 + Charge /30** ; le 1ᵉʳ porte le badge **Recommandé** ; un chauffeur **indisponible ou non conforme n'apparaît pas**. Cliquer **Choisir** → la commande quitte la colonne « Non affectées » et passe en **Assignée**.

**TC-F04 — Assignation depuis la liste**
PAS : `/orders` → menu « … » → **Assigner à** › `Hamid Ouali`.
ATT : statut **Assignée**, chauffeur affiché ; le chauffeur déjà affecté est marqué d'un ✓ dans le menu.

**TC-F05 — Progression pas à pas**
PAS : sur une commande assignée, **Faire progresser** de façon répétée.
ATT : la séquence respecte **Nouvelle → Assignée → En route (retrait) → Récupérée → En route (livraison)** ; arrivé à **En route (livraison)**, l'action est **désactivée** (la clôture se fait par l'app livreur avec preuve).

**TC-F06 — Transition invalide refusée**
PAS : appeler directement l'API pour passer une commande **Nouvelle** à **Livrée** (`POST /v1/orders/<ref>/advance` répété n'est pas le cas ; utiliser l'appel direct avec un statut cible).
ATT : refus — seul le pas suivant du cycle nominal est autorisé.

**TC-F07 — Actions de masse**
PAS : `/orders` → cocher 3 commandes → **Assigner** ; puis cocher 2 commandes → **Faire avancer**.
ATT : les actions s'appliquent à toute la sélection ; la sélection se vide ensuite.

**TC-F08 — Filtres et recherche**
PAS : filtrer par **Statut**, puis **Ville**, **Marchand**, **Livreur** ; taper une référence dans la recherche de page ; puis **Réinitialiser**.
ATT : chaque filtre réduit réellement la liste ; **Réinitialiser** restaure tout ; les filtres se combinent.

**TC-F09 — Recherche globale (barre supérieure)**
PAS : taper une référence dans la barre du haut → **Entrée**.
ATT : atterrissage sur `/orders?q=<référence>` avec la liste filtrée.

**TC-F10 — Pagination**
PAS : créer assez de commandes pour dépasser une page, naviguer avec ‹ / › et les numéros.
ATT : pagination réelle, page courante mise en évidence, bornes désactivées aux extrémités.

**TC-F11 — Fiche commande**
PAS : ouvrir `/orders/<ref>` → parcourir les onglets **Détails**, **Preuve de livraison**, **Historique**, **Facturation** ; cliquer l'icône **copier** du code.
ATT : onglets fonctionnels ; historique horodaté cohérent avec les transitions faites ; code copié (icône ✓).

**TC-F12 — Annulation**
PAS : sur une commande non terminale → **Annuler**.
ATT : statut **Annulée** ; l'action **Annuler** devient indisponible sur les commandes **Livrée** et **Annulée**.

**TC-F13 — Création par le marchand**
PAS : se connecter avec `marchand@rabatexpress.ma` → `/portail` → créer une commande.
ATT : création autorisée pour le rôle MERCHANT, mais **ni assignation ni progression** (actions absentes/403).

### G. App livreur — mission de bout en bout

**TC-G01 — Connexion livreur**
PRÉ : compte `livreur@rabatexpress.ma` créé (§0.3) et chauffeur `Hamid Ouali` existant.
PAS : ouvrir l'app → Organisation `rabatexpress`, email, mot de passe → **Se connecter**.
ATT : écran des permissions, puis onglet **Missions**.

**TC-G02 — Permissions**
PAS : **Autoriser** Localisation, Caméra, Notifications l'une après l'autre.
ATT : **Continuer** reste désactivé tant que les 3 ne sont pas accordées.

**TC-G03 — Liste des missions**
PAS : consulter l'onglet **Missions**.
ATT : seules les commandes **assignées à `Hamid Ouali`** apparaissent (jamais celles d'un autre chauffeur) ; compteurs *À livrer* et *COD à encaisser* justes ; tirer pour rafraîchir fonctionne.

**TC-G04 — Détail de mission**
PAS : ouvrir une mission → vérifier adresses, contact, chips COD et niveau de preuve → **Naviguer**.
ATT : écran **Progression** avec les étapes du cycle.

**TC-G05 — Avancement avec confirmation**
PAS : faire avancer étape par étape ; confirmer chaque boîte de dialogue.
ATT : chaque étape demande confirmation ; le statut remonte **dans la console** (`/orders`) après rafraîchissement.

**TC-G06 — Preuve de livraison**
PAS : à la dernière étape → **Preuve** → prendre/joindre une photo (et signature si niveau `photo_signature`).
ATT : le bouton de validation reste **désactivé tant que la preuve exigée est incomplète**.

**TC-G07 — Encaissement du COD**
PAS : saisir le montant reçu → confirmer.
ATT : montant ≤ 0 refusé ; à la validation → écran **Livraison réussie** ; la commande passe **Livrée** dans la console et le COD est rattaché à la caisse du chauffeur.

**TC-G08 — Commande prépayée**
PAS : dérouler une mission dont le COD est 0.
ATT : l'étape d'encaissement est absente ou affiche **Prépayé**.

**TC-G09 — Preuve « aucune »**
PAS : dérouler la mission créée avec preuve `aucune`.
ATT : clôture possible sans photo ni signature.

**TC-G10 — Échec de livraison**
PAS : sur une mission en **En route (livraison)** → **Échec de livraison** → choisir un motif → notes → confirmer.
ATT : statut **Échouée** dans la console ; la commande apparaît dans `/returns` avec le motif et 1 tentative.

**TC-G11 — Mode hors ligne**
PAS : couper le réseau du téléphone → faire avancer une mission / déclarer un échec → observer le bandeau **Hors ligne** et **n action(s) en attente** → ouvrir **Synchronisation** → **Forcer la synchronisation** → rétablir le réseau.
ATT : les actions sont mises en file localement, la liste reste consultable (données du dernier chargement), et **tout se rejoue automatiquement** au retour du réseau, **sans doublon** côté console (idempotence).

**TC-G12 — Scanner**
PAS : onglet **Scanner** → segment **Retrait** → saisir un code colis valide → **Valider** ; puis re-saisir le même ; puis un code inconnu.
ATT : succès / doublon signalé / code inconnu rejeté ; compteur *n/total* mis à jour.

**TC-G13 — Shift & EU 561**
PAS : onglet **Shift** → **Démarrer** → laisser tourner → **Arrêter**.
ATT : les compteurs *Temps de conduite / Restant / Repos / Amplitude* évoluent ; alerte visuelle à l'approche des 9 h de conduite.

**TC-G14 — Signaler un incident**
PAS : Profil → **Signaler un incident** → type, description → envoyer.
ATT : l'incident remonte à l'exploitation (visible via l'API `/v1/field/incidents`) ; consigner s'il n'existe pas d'écran console dédié (voir AN-04).

**TC-G15 — Support dispatch**
PAS : Profil → **Support dispatch** → écrire un message.
ATT : message enregistré ; une réponse de l'exploitation doit apparaître dans le fil.

**TC-G16 — Historique & gains**
PAS : Profil → **Historique & gains**.
ATT : les livraisons réussies du jour apparaissent avec la rémunération par course (12 DH/livraison).

**TC-G17 — Notifications & disponibilité**
PAS : cloche → **Notifications** → **Tout lire** ; Profil → basculer *Disponible*.
ATT : compteur de non-lues remis à zéro ; la disponibilité se reflète dans `/drivers` de la console.

**TC-G18 — Bilingue & RTL (mobile)**
PAS : sur l'écran de login, basculer **FR → AR**, puis parcourir missions, mission, preuve, échec.
ATT : textes en arabe, mise en page **RTL** (alignements et flèches inversés), montants lisibles (jamais de chiffres inversés).

### H. Hub

**TC-H01 — Scanner une entrée**
PRÉ : au moins 3 commandes au statut **Récupérée**.
PAS : `/hub` → saisir un code colis à 8 caractères → badge **Prêt** → **Enregistrer l'entrée**.
ATT : le colis apparaît dans la colonne *Arrivés — à scanner* ; les KPI se mettent à jour.

**TC-H02 — Code invalide**
PAS : saisir 7 caractères, puis un code inexistant de 8 caractères.
ATT : bouton désactivé à 7 caractères ; erreur explicite pour un code inconnu.

**TC-H03 — Flux de tri**
PAS : **Marquer scanné** sur un colis, puis **Placer sur quai**.
ATT : le colis passe *Arrivés* → *Scannés — à trier* → *Sur quai*, regroupé par ville de destination.

**TC-H04 — Manifeste de transfert**
PAS : sur un groupe de destination → **Manifeste**.
ATT : liste des colis, total COD embarqué correct, **Sceller le bordereau** ferme le dialogue.

**TC-H05 — Accès**
PAS : se connecter en comptable → `/hub`.
ATT : accès refusé (page réservée ADMIN/DISPATCHER).

### I. Tournées

**TC-I01 — Créer une tournée**
PAS : `/tournees` → **Nouvelle tournée** → livreur `Hamid Ouali`, jour du test, cocher ≥ 3 arrêts → **Créer**.
ATT : tournée créée au statut **Planifiée**, arrêts listés dans l'ordre de sélection, **COD total à collecter** correct.

**TC-I02 — Optimiser l'ordre**
PAS : **Optimiser l'ordre**.
ATT : l'ordre change et un libellé *Ordre optimisé* apparaît ; le bouton est désactivé en dessous de 2 arrêts.

**TC-I03 — Réordonner manuellement**
PAS : déplacer un arrêt.
ATT : nouvel ordre persistant après rechargement.

**TC-I04 — Cycle de vie**
PAS : **Valider la tournée** → puis **Clôturer**.
ATT : statut Planifiée → En cours → Clôturée ; plus aucune action d'écriture sur une tournée clôturée.

**TC-I05 — Vue livreur**
PAS : app livreur → onglet **Ma tournée**.
ATT : les arrêts de la tournée du jour s'affichent dans l'ordre défini.

### J. PC flotte & tracking

**TC-J01 — Positions temps réel**
PRÉ : l'app livreur envoie des positions (service actif).
PAS : `/fleet`.
ATT : le chauffeur apparaît sur la carte avec sa dernière position et sa zone.

**TC-J02 — Suivre / plein écran**
PAS : sélectionner un chauffeur → **Suivre** ; puis **Plein écran** → **Quitter le plein écran**.
ATT : recentrage effectif, bascule plein écran fonctionnelle.

**TC-J03 — Alerte hors zone (géofence)**
PAS : définir une géofence pour `Hamid Ouali` puis faire remonter une position éloignée (déplacement réel ou appel API `POST /v1/tracking/position`).
ATT : bandeau rouge « … est sorti de zone », **Localiser** recentre la carte sur lui ; le cas remonte aussi dans `/fraud` (signal `hors_geo`) si la règle s'applique.

**TC-J04 — Raccourci zones**
PAS : **Gérer les zones**.
ATT : navigation vers `/zones`.

### K. Retours

**TC-K01 — Un échec crée un retour**
PRÉ : TC-G10 exécuté.
PAS : `/returns` → onglet **Retours actifs**.
ATT : la commande échouée est listée, statut **À traiter**, tentatives **1/3**, motif affiché, KPI **COD bloqué** correct.

**TC-K02 — Reprogrammer**
PAS : sélectionner la ligne → **Reprogrammer une tentative (2/3)**.
ATT : statut **Reprogrammée**, compteur incrémenté, la commande redevient livrable côté livreur.

**TC-K03 — Plafond de tentatives**
PAS : enchaîner échec + reprogrammation jusqu'à 3 tentatives.
ATT : au-delà, message « Plafond de tentatives atteint — reprogrammation impossible » et le bouton disparaît.

**TC-K04 — Retour au marchand**
PAS : **Lancer le retour au marchand**.
ATT : statut **Rendu au marchand**, frise *Échec → Retour au hub → Restitution marchand* complète, ligne basculée dans l'onglet **Clôturés**, plus aucune action possible.

### L. Caisse & COD

**TC-L01 — Session de caisse alimentée**
PRÉ : ≥ 2 livraisons avec COD encaissé par `Hamid Ouali` (TC-G07).
PAS : `/cash`.
ATT : une session au nom du chauffeur, **COD théorique (livré)** = somme des COD encaissés, nombre de livraisons correct, statut **En cours** ou **À déposer**.

**TC-L02 — Enregistrer le dépôt**
PAS : sélectionner la session → **Enregistrer le dépôt en agence**.
ATT : statut **Déposé**, montant déposé = montant déclaré.

**TC-L03 — Écart de caisse**
PAS : provoquer un écart (déclarer un montant différent du théorique côté livreur) → sur la session en **Écart** → **Résoudre l'écart de X** → motif + note → **Valider la résolution**.
ATT : l'écart est tracé et la session clôturée ; le cas peut alimenter `/fraud`.

**TC-L04 — Export comptable**
PAS : **Export comptable**.
ATT : téléchargement d'un CSV `reconciliation-cash.csv` contenant les sessions affichées.

**TC-L05 — Générer les reversements**
PAS : `/payout` → **Générer les reversements** (période du test).
ATT : une ligne par marchand avec COD encaissé − commission = net à reverser.

**TC-L06 — Payer un reversement**
PAS : **Reverser à `Boutique Test`** → méthode (virement) + référence → **Confirmer**.
ATT : statut **Payé** avec méthode et référence conservées ; export CSV `reversements-cod.csv` disponible.

**TC-L07 — Accès finance**
PAS : se connecter en dispatcher → `/cash` et `/payout`.
ATT : lecture éventuelle mais **aucune action d'écriture** (403 côté API).

### M. Tarification & facturation

**TC-M01 — Grille tarifaire**
PAS : `/pricing` → modifier les paliers (De/À km, tarif, DH/km), les suppléments (fragile, programmé) et la remise → **Enregistrer**.
ATT : **Enregistré ✓**, valeurs persistantes après rechargement.

**TC-M02 — Simulateur de devis**
PAS : saisir une distance et des options dans le **Simulateur de devis**.
ATT : le total TTC correspond à la grille enregistrée (paliers + suppléments + TVA de `/settings`).

**TC-M03 — Export de la grille**
PAS : **Export grille**.
ATT : CSV `grille-tarifaire.csv` téléchargé.

**TC-M04 — Générer les factures**
PAS : `/invoices` → **Générer les factures** pour la période du test.
ATT : une facture par marchand ayant des livraisons, montants cohérents avec commission et TVA.

**TC-M05 — Cycle de vie d'une facture**
PAS : sélectionner une facture → **PDF** / **Revoir** → **Envoyer** → **Marquer payée**.
ATT : statuts successifs Brouillon → Envoyée → Payée ; le PDF s'ouvre.

**TC-M06 — Litige**
PAS : sur une facture envoyée → **Ouvrir litige** → montant contesté + note → **Ouvrir le litige** ; puis **Traiter le litige** → décision → **Valider**.
ATT : la facture porte le statut litige puis la décision ; les montants sont ajustés selon la décision.

**TC-M07 — Export CSV**
PAS : **Export CSV**.
ATT : `factures.csv` téléchargé, conforme à l'affichage.

### N. Portail marchand

**TC-N01 — Tableau de bord marchand**
PAS : se connecter avec `marchand@rabatexpress.ma` → `/portail`.
ATT : KPI **Commandes / Livrées / En cours / COD à encaisser** cohérents avec **les seules commandes de `Boutique Test`** ; **Voir mes commandes** et **Tout voir** naviguent bien.

**TC-N02 — Mes commandes**
PAS : `/portail/commandes` → onglets **Toutes / En cours / Livrées / Incidents** + recherche.
ATT : filtrage réel, aucune commande d'un autre marchand n'apparaît jamais.

**TC-N03 — Portefeuille & facture**
PAS : `/portail/portefeuille` puis `/portail/facture`.
ATT : COD encaissé, calcul du solde et **Net à reverser** cohérents avec `/payout` ; la facture reprend commission et TVA de `/settings`.

**TC-N04 — Cloisonnement marchand**
PAS : connecté en marchand, tenter `/dashboard`, `/orders`, `/cash`.
ATT : redirection vers `/portail` ou refus — un marchand n'accède jamais à la console transport.

### O. Suivi client public & avis

**TC-O01 — Suivi par code**
PAS : app client → saisir le code de suivi d'une commande en cours → **Suivre**.
ATT : statut et étapes affichés, sans aucune donnée sensible (pas d'adresse complète du marchand, pas de téléphone chauffeur).

**TC-O02 — Code invalide**
PAS : saisir un code inexistant.
ATT : message d'erreur clair, aucune fuite d'information.

**TC-O03 — Notation**
PAS : suivre une commande **livrée** → **Notez votre livraison** → 4 ★ → envoyer.
ATT : « Merci pour votre note ! » ; une seconde notation du même code est refusée.

**TC-O04 — Remontée dans la console**
PAS : `/reviews` en console.
ATT : l'avis apparaît avec note, commande, chauffeur, marchand ; les filtres par note et le bloc **Distribution** sont exacts ; le lien vers la commande fonctionne.

### P. Notifications

**TC-P01 — Journal**
PAS : `/notifications` → filtres **Tous canaux** / **Tous statuts**.
ATT : journal des envois avec destinataire, canal, statut, date ; filtres réels.

**TC-P02 — Envoi manuel**
PAS : **Envoyer une notification** → destinataire, canal (SMS/WhatsApp/Push/Email), langue (FR/AR), message → vérifier l'**Aperçu** → **Envoyer**.
ATT : la notification apparaît dans le journal avec son statut.

**TC-P03 — Réessai**
PAS : sur une notification en échec → **Réessayer**.
ATT : nouvelle tentative tracée.

**TC-P04 — Consentement marketing**
PAS : section **Consentement marketing** → accorder puis retirer le consentement d'un destinataire.
ATT : statut **Consentement accordé** / **retiré** persisté ; un envoi marketing vers un destinataire ayant retiré son consentement doit être **refusé** (les messages transactionnels, eux, passent).

**TC-P05 — Modèles**
PAS : `/templates` → **Nouveau modèle** → événement, texte FR + AR avec variables → **Créer** ; puis modifier → **Enregistrer** ; puis **Rétablir**.
ATT : création, modification, et retour à la valeur d'origine après confirmation ; les **Variables du modèle** listées sont bien substituées dans l'aperçu.

**TC-P06 — Notification automatique**
PAS : faire passer une commande à **Livrée** (via l'app livreur).
ATT : une notification correspondant au modèle de l'événement apparaît automatiquement dans le journal.

### Q. Fraude

**TC-Q01 — Génération d'un cas**
PAS : provoquer un signal — livraison validée hors zone (TC-J03), ou écart de caisse (TC-L03), ou dépôt tardif.
PAS : `/fraud`.
ATT : un cas est créé avec le(s) signal(s), un **score** et un résumé ; le classement des chauffeurs est cohérent.

**TC-Q02 — Ouvrir une enquête**
PAS : sélectionner le cas → **Ouvrir une enquête**.
ATT : statut **Enquête**.

**TC-Q03 — Confirmer la fraude**
PAS : → **Confirmer** (avec confirmation).
ATT : statut **Confirmé** ; action tracée dans le journal d'audit.

**TC-Q04 — Blanchir**
PAS : sur un autre cas → **Blanchir**.
ATT : statut **Blanchi**, sort de la liste active.

**TC-Q05 — Réservé à l'admin**
PAS : se connecter en dispatcher → `/fraud`.
ATT : accès refusé (403).

### R. Pilotage

**TC-R01 — Tableau de bord**
PAS : `/dashboard`.
ATT : les KPI reflètent **exactement** les données créées (commandes, livrées, en cours, COD) ; les alertes **Assurance** et **Contrôle technique** listent les véhicules non conformes (TC-D02) ; les raccourcis naviguent correctement.

**TC-R02 — Analytique**
PAS : `/analytics`.
ATT : **Répartition par statut** cohérente avec `/orders` ; **Motifs d'échec** reprend les motifs saisis en TC-G10 ; tableaux par marchand et par chauffeur exacts ; affiche « Aucun échec sur la période. » si aucun échec.

**TC-R03 — Cohérence croisée**
PAS : comparer les totaux `/dashboard`, `/analytics`, `/orders`, `/cash`, `/portail`.
ATT : les mêmes faits donnent les mêmes chiffres partout (nombre de livraisons, COD encaissé, taux de réussite).

### S. Multi-tenant, sécurité, conformité

**TC-S01 — Isolation stricte des données**
PAS : amorcer un admin sur `tangerlog`, créer 1 commande, puis se connecter sur `rabatexpress`.
ATT : **aucune** donnée de `tangerlog` (commande, chauffeur, zone, facture, avis) n'est visible depuis `rabatexpress`, et réciproquement — sur **toutes** les pages.

**TC-S02 — Isolation par l'API**
PAS : avec le jeton de `rabatexpress`, appeler l'API en forçant l'en-tête d'un autre tenant (`x-tenant-slug: tangerlog`).
ATT : refus ou données du tenant du jeton — jamais de fuite entre schémas.

**TC-S03 — Isolation du scope livreur**
PAS : avec le compte livreur, appeler `/v1/driver/missions`.
ATT : uniquement les missions de `Hamid Ouali`, jamais celles d'un autre chauffeur.

**TC-S04 — Isolation du scope marchand**
PAS : avec le compte marchand, appeler `/v1/merchant/orders`.
ATT : uniquement les commandes de `Boutique Test`.

**TC-S05 — Journal d'audit**
PAS : super-admin → consulter `/v1/audit`.
ATT : les actions sensibles sont tracées avec acteur, cible et horodatage : provisioning, changement de plan/statut de tenant, invitation/rôle/désactivation d'utilisateur, arbitrage fraude.

**TC-S06 — Droits des personnes (Loi 09-08)**
PAS : en admin, appeler `GET /v1/privacy/export` pour un sujet, puis `POST /v1/privacy/erase`.
ATT : export complet des données du sujet ; après effacement, les données personnelles disparaissent des écrans tout en conservant l'intégrité comptable (commande anonymisée, pas supprimée). Consigner s'il n'existe pas d'écran console dédié (AN-05).

**TC-S07 — Session expirée**
PAS : supprimer le cookie de session dans le navigateur → recharger `/orders`.
ATT : redirection vers `/login`.

### T. Interface, i18n, thème

**TC-T01 — Bascule de langue (console)**
PAS : sélecteur FR/AR de la barre supérieure → parcourir 5 pages (dashboard, commandes, dispatch, caisse, paramètres).
ATT : libellés traduits, mise en page **RTL** complète (barre latérale, tableaux, badges, flèches), montants et dates lisibles.

**TC-T02 — Thème clair/sombre**
PAS : icône lune/soleil → parcourir les mêmes pages.
ATT : contraste correct partout, y compris cartes, tableaux, badges de statut et dialogues ; préférence conservée à la navigation.

**TC-T03 — Responsive**
PAS : réduire la fenêtre à ~1024 px puis ~768 px sur `/orders`, `/dispatch`, `/cash`.
ATT : pas de débordement horizontal de la page ; les tableaux et cartes défilent dans leur propre conteneur.

**TC-T04 — États vides**
PAS : sur un tenant fraîchement provisionné (`tangerlog`), ouvrir chaque page de la console.
ATT : **aucune page ne plante** ; chaque liste vide affiche un message dédié (« Aucune zone. Créez-en une. », « Aucune tournée planifiée… », « Tout est affecté… », etc.), et non un écran blanc ou une erreur.

**TC-T05 — Cohérence des statuts**
PAS : comparer un même statut de commande entre `/orders`, `/dashboard`, fiche commande, app livreur et suivi client.
ATT : même libellé et même couleur partout (Nouvelle bleu, Assignée indigo, Récupérée violet, En route (livraison) ambre, Livrée vert, Échouée rouge, Retour orange, Annulée gris).

**TC-T06 — Accessibilité tactile (mobile)**
PAS : sur l'app livreur, vérifier les cibles tactiles et l'action principale.
ATT : boutons ≥ 44 px, action principale en bas d'écran, atteignable au pouce.

---

## 3. Anomalies connues & zones de démo

**À vérifier mais à ne pas requalifier en bug de régression** — ce sont des manques structurels à consigner tels quels.

| Réf | Constat | Impact test |
|---|---|---|
| **AN-01** | Aucun écran ne crée le **premier administrateur** d'un tenant provisionné. | Bloque toute recette « depuis zéro » sans la commande `account` (§0.3). **À corriger côté produit** (créer l'admin dans le formulaire de provisioning). |
| **AN-02** | Aucun écran ne crée de compte **MERCHANT** ni **DRIVER** ; « Ajouter un chauffeur » ne crée qu'une fiche RH sans identifiant. | Contournement §0.3 obligatoire pour tester le portail marchand et l'app livreur. |
| **AN-03** | La **cloche de notifications** de la barre supérieure (console) n'a **aucune action**. | Attendu : clic sans effet. Consigner comme anomalie ouverte. |
| **AN-04** | Incidents et support livreur existent côté API (`/v1/field/*`) sans écran console de traitement identifié. | TC-G14/TC-G15 se vérifient par l'API. |
| **AN-05** | Export/effacement RGPD-09.08 exposés en API sans écran dédié. | TC-S06 se vérifie par l'API. |
| **AN-06** | App livreur — écrans marqués **« Démo »** : *Objectifs & primes*, *Mes documents*, *Aide/FAQ*, *Récap du jour*, statistiques du *Shift*, *Devenir livreur* (onboarding), *Notifications*. | Vérifier l'affichage et la navigation uniquement ; **ne pas attendre de données serveur**. |
| **AN-07** | La liste des marchands de l'assistant de création est **dérivée des commandes existantes** — vide sur un tenant neuf. | Normal en TC-F01 : le champ bascule en saisie libre. |
| **AN-08** | Périodes de facturation/reversement figées dans l'UI (`2026-07`). | Si la génération ne renvoie rien, vérifier la période avant de conclure au bug. |

---

## 4. Feuille de suivi

Un cas = une ligne. Statuts : **OK** / **KO** / **BLOQUÉ** / **N/A**.

| Cas | Rôle testeur | Env. | Statut | Constat / n° d'anomalie | Date |
|---|---|---|---|---|---|
| TC-A01 | Super-admin | | | | |
| … | | | | | |

**Critères de sortie de la recette :**
1. 100 % des cas exécutés, aucun **KO bloquant** sur les sections **A, B, F, G, L, S** (provisioning, auth/RBAC, cycle de commande, app livreur, caisse, isolation multi-tenant).
2. Les anomalies **AN-01** et **AN-02** sont corrigées ou explicitement acceptées comme dette.
3. Aucun écart de chiffres entre `/dashboard`, `/analytics`, `/cash` et `/portail` (TC-R03).
4. Isolation multi-tenant vérifiée sur **toutes** les pages (TC-S01), sans exception.
