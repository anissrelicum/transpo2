# API

NestJS (`apps/api`), PostgreSQL en **schéma par tenant** via Drizzle. Toutes les routes
métier sont préfixées `v1/`.

## Comment une requête est autorisée

Trois gardes, dans cet ordre, sur presque toutes les routes :

1. **`JwtAuthGuard`** — exige un `Authorization: Bearer <jwt>` valide et pose `req.user`.
2. **`TenantGuard`** — résout le tenant (claim JWT > en-tête `x-tenant-slug` > sous-domaine),
   pose `req.tenantSchema = tenant_<slug>`, refuse un en-tête divergent du JWT (403
   « Incohérence de tenant ») et refuse une organisation `SUSPENDU` (403 « Espace suspendu »).
3. **`RolesGuard`** — compare `req.user.role` aux rôles déclarés par `@Roles`. Un `@Roles`
   de méthode **prime** sur celui de la classe : c'est ainsi qu'une route est durcie ou
   rouverte à l'intérieur d'un contrôleur.

`CONSOLE_ROLES` = `ADMIN`, `DISPATCHER`, `COMPTABLE`. Il est posé au niveau **classe** sur
tous les contrôleurs d'exploitation : sans lui, un `MERCHANT` ou un `DRIVER` authentifié du
même tenant lirait les données de toute l'organisation.

Deux familles échappent à `TenantGuard` :

- le **realm plateforme** (`/v1/saas`, `/v1/audit`) — sinon une plateforme dont tous les
  clients sont suspendus ne pourrait plus en réactiver aucun ;
- les **routes publiques** (`/v1/public/track`, `/health`) — pas d'authentification du tout,
  le tenant est un segment d'URL validé côté serveur.

## Conventions

- **`@HttpCode(200)` sur les POST qui renvoient 200** (Nest répond 201 par défaut).
- **Injection explicite `@Inject()`** sur tous les constructeurs : sous `tsx`/`esbuild`,
  NestJS n'émet pas la métadonnée de type.
- **Idempotence** : les actions terrain acceptent un en-tête `Idempotency-Key`. Le rejeu
  d'une clé déjà vue ne produit pas de seconde transition — c'est ce qui rend sûre la file
  hors ligne de l'app livreur.
- La **resolution de tenant ne vient jamais du client** : ni d'un champ de corps, ni d'un
  paramètre de requête.

---

## Authentification — `v1/auth`

| Méthode | Route | Accès | Ce que ça fait |
|---|---|---|---|
| POST | `auth/login` | public | Connexion d'un utilisateur d'organisation → `{ token, role, name }` |
| POST | `auth/super/login` | public | Connexion plateforme (`SUPER_ADMIN`), jeton `platform: true` |

**Anti-bruteforce.** Compteurs d'échecs sur fenêtre glissante de 15 min, tenus **en base**
(`platform.login_attempts`) et non en mémoire du processus — un compteur mémoire repartait
de zéro à chaque déploiement et ignorait les autres répliques. Deux clés indépendantes,
parce que ce sont deux attaques différentes :

- par compte (`u:<tenant>:<email>`) — 5 échecs, contre l'acharnement sur une adresse connue ;
- par IP (`ip:<addr>`) — 30 échecs, contre le *password spraying* (un essai sur des
  centaines d'adresses), que le compteur par compte ne voit pas. Le seuil est plus haut
  parce qu'un bureau entier peut partager une sortie NAT.

Une connexion réussie efface le compteur du compte, pas celui de l'IP. Le dépassement
renvoie **429**.

**Pas d'énumération.** Une organisation inconnue renvoie exactement la même réponse qu'un
mot de passe faux ; le détail reste dans les journaux serveur. Le message « Tenant inconnu :
`<slug>` » permettait d'énumérer les clients de la plateforme en comparant les réponses.

> **Non implémenté** : 2FA, SSO/SAML, mot de passe oublié en libre-service. Le PRD-06 les
> décrit ; l'API ne les expose pas. La réinitialisation passe par un administrateur
> (`POST /v1/users/:id/reset-password`) ou, pour l'administrateur d'une organisation, par le
> super-admin (`POST /v1/saas/tenants/:slug/admin`).

## Commandes — `v1/orders`

Classe : `CONSOLE_ROLES`.

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| GET | `orders` | console | Liste, filtrable par `?status=` |
| GET | `orders/:ref` | console | Fiche d'une commande |
| GET | `orders/:ref/proof` | console | Preuve déposée par le livreur (404 si aucune) |
| GET | `orders/:ref/events` | console | Journal des transitions |
| POST | `orders` | `ADMIN`, `DISPATCHER`, `MERCHANT` | Création. Pour un marchand, le marchand est forcé à celui du compte |
| POST | `orders/:ref/advance` | `ADMIN`, `DISPATCHER` | Étape suivante du cycle |
| POST | `orders/:ref/assign` | `ADMIN`, `DISPATCHER` | Affectation d'un livreur |
| POST | `orders/:ref/cancel` | `ADMIN`, `DISPATCHER` | Annulation (refusée sur une commande livrée) |

## Dispatch et zones — `v1/dispatch`

Classe : `CONSOLE_ROLES`.

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| GET | `dispatch/zones` | console | Zones de l'organisation |
| POST | `dispatch/zones` | `ADMIN`, `DISPATCHER` | Création d'une zone |
| PATCH | `dispatch/zones/:id` | `ADMIN`, `DISPATCHER` | Modification |
| DELETE | `dispatch/zones/:id` | `ADMIN`, `DISPATCHER` | Suppression |
| GET | `dispatch/suggest/:ref` | `ADMIN`, `DISPATCHER` | Livreurs suggérés, avec le détail du score (zone 40 / dispo 30 / charge 30) |

## Tournées — `v1/tournees`

Classe : `ADMIN`, `DISPATCHER` — la planification appartient à l'exploitation.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `tournees` | Liste, filtrable par `?driver=` et `?status=` |
| GET | `tournees/:id` | Détail avec ses arrêts |
| POST | `tournees` | Création à partir de commandes non affectées |
| POST | `tournees/:id/reorder` | Nouvel ordre des arrêts — **refusé 400 sur une tournée clôturée** |
| POST | `tournees/:id/advance` | `PLANIFIEE → EN_COURS → CLOTUREE` — **refusé 400 au-delà** |

## Tri en hub — `v1/hub`

Classe : `ADMIN`, `DISPATCHER`. Un `COMPTABLE` reçoit 403.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `hub` | Colis présents au hub, avec leur phase |
| POST | `hub/scan` | Déclare l'arrivée d'un colis par son code à 8 caractères. Refuse un code inconnu, et refuse une course livrée, annulée ou déjà en retour |
| POST | `hub/:ref/phase` | Change la phase (`arrive` → `trier` → `quai`) |

## Retours — `v1/returns`

Classe : `CONSOLE_ROLES` en lecture, écriture réservée à `ADMIN` et `DISPATCHER`.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `returns` | Retours ouverts et clos |
| POST | `returns/fail/:ref` | Déclare un échec (motif obligatoire, uniquement depuis `LIVRAISON`) et ouvre le retour |
| POST | `returns/:ref/reschedule` | Nouvelle tentative — **refusé 400** au-delà de 3 tentatives, et **refusé 400** sur un retour déjà rendu |
| POST | `returns/:ref/return-to-merchant` | Restitution au marchand — **refusé 400** si déjà rendu |

## Caisse et reversements — `v1/cash`

Classe : `CONSOLE_ROLES`, mais chaque route se durcit.

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| POST | `cash/collect/:ref` | `ADMIN`, `DISPATCHER` | Marque le COD encaissé depuis la console |
| GET | `cash/sessions` | `ADMIN`, `COMPTABLE` | Sessions de caisse du jour, avec leurs mouvements |
| POST | `cash/sessions/:id/deposit` | `ADMIN`, `COMPTABLE` | Dépôt en agence — **second dépôt refusé 400** |
| POST | `cash/sessions/:id/resolve` | `ADMIN`, `COMPTABLE` | Résout un écart avec motif et note ; **ouvre un dossier de fraude** (`ecart_cash`) |
| GET | `cash/reconciliation` | `ADMIN`, `COMPTABLE` | Théorique / déclaré / déposé |
| GET | `cash/reversements` | `ADMIN`, `COMPTABLE` | Reversements aux marchands |
| POST | `cash/reversements/generate` | `ADMIN`, `COMPTABLE` | Génération par période (brut − commission = net) |
| POST | `cash/reversements/:id/pay` | `ADMIN`, `COMPTABLE` | Paiement avec méthode et référence — **second paiement refusé 400** |
| GET | `cash/payouts` | `ADMIN`, `COMPTABLE` | Historique des versements |

Un `DISPATCHER` reçoit 403 sur toute écriture de caisse ou de reversement.

## Tarification et facturation — `v1`

Classe : `CONSOLE_ROLES`.

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| POST | `pricing/quote` | console | Devis selon la cascade à 3 niveaux |
| GET | `pricing/config` | `ADMIN`, `COMPTABLE`, `DISPATCHER` | Grille, suppléments, remise, commission, TVA |
| POST | `pricing/config` | `ADMIN` | Enregistre la configuration |
| GET | `invoices` | `ADMIN`, `COMPTABLE` | Factures marchands |
| GET / POST | `invoices/billing-modes` | `ADMIN`, `COMPTABLE` | Mode prépayé / post-payé par marchand |
| POST | `invoices/generate` | `ADMIN`, `COMPTABLE` | Génération d'une période |
| POST | `invoices/:id/send` · `/pay` | `ADMIN`, `COMPTABLE` | Envoi, encaissement |
| POST | `invoices/:id/dispute` · `/resolve` | `ADMIN`, `COMPTABLE` | Ouverture et résolution de litige |

## Flotte et effectif

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| GET | `v1/vehicles` | console | Parc |
| POST | `v1/vehicles` | `ADMIN` | Création |
| PATCH | `v1/vehicles/:id/state` | `ADMIN` | Changement d'état |
| POST | `v1/vehicles/:id/renew` | `ADMIN` | Renouvelle `insurance` ou `ct` — refuse une date passée |
| DELETE | `v1/vehicles/:id` | `ADMIN` | Retrait du parc |
| GET | `v1/drivers` | console | Effectif |
| POST | `v1/drivers` | `ADMIN` | Création d'une fiche chauffeur |
| PATCH | `v1/drivers/:id` | `ADMIN` | Modification |
| PATCH | `v1/drivers/:id/availability` | `ADMIN`, `DISPATCHER` | Disponibilité (même champ que celui piloté par l'app livreur) |
| POST | `v1/drivers/:id/renew` | `ADMIN` | Renouvelle `license` ou `medical` |
| PATCH | `v1/drivers/:id/vehicle` | `ADMIN` | Rattachement d'un véhicule |
| DELETE | `v1/drivers/:id` | `ADMIN` | Retrait, avec `?transferTo=` pour reprendre ses courses |

## Suivi de flotte — `v1/tracking`

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| POST | `tracking/position` | `DRIVER` | Remontée de position (le livreur, pour lui-même) |
| GET | `tracking/live` | `ADMIN`, `DISPATCHER` | Dernière position de chaque livreur |
| GET | `tracking/alerts` | `ADMIN`, `DISPATCHER` | Alertes de sortie de géofence |
| POST | `tracking/geofence` | `ADMIN`, `DISPATCHER` | Création d'une géofence |

La sortie de zone est détectée à l'ingestion, par distance de haversine.

## App livreur — `v1/driver`

Classe : `DRIVER`. **Le scope est toujours le chauffeur du jeton** ; une commande non
assignée à ce livreur renvoie 403 « Commande non assignée à ce livreur. »

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `driver/me` | Sa fiche : véhicule rattaché, permis et échéance, zone |
| PATCH | `driver/availability` | Se déclare disponible ou non ; met à jour `drivers.available` |
| GET | `driver/missions` | Ses commandes **actives** |
| GET | `driver/tour` | Les arrêts de la tournée du jour, **dans l'ordre du dispatch** |
| POST | `driver/orders/:ref/advance` | Étape suivante (borne `LIVRAISON` : la livraison passe par `/proof`). Accepte `Idempotency-Key` |
| POST | `driver/orders/:ref/fail` | Échec avec motif obligatoire → `ECHOUEE` + retour `A_TRAITER` |
| POST | `driver/orders/:ref/proof` | **Un seul appel** : COD encaissé + photo + signature, sous une seule clé d'idempotence. Refuse si la preuve exigée manque |
| GET | `driver/cash` | Sa caisse du jour : théorique, déclaré, écart |
| POST | `driver/cash/declare` | Déclare ce qu'il a réellement en main |
| GET / POST | `driver/incidents` | Ses incidents (5 types normalisés) |
| GET / POST | `driver/support` | Son fil avec le dispatch |
| GET | `driver/history` | Historique et gains (tarif par livraison inclus) |

## Terrain côté exploitation — `v1/field`

Classe : `ADMIN`, `DISPATCHER`.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `field/incidents` | Incidents remontés par les livreurs, filtrables par `?status=` |
| POST | `field/incidents/:id/resolve` | Clôture d'un incident |
| GET | `field/support/:driver` | Le fil d'un livreur |
| POST | `field/support/:driver/reply` | Réponse du dispatch |

## Portail marchand — `v1/merchant`

Classe : `MERCHANT`. **Scope = le claim `merchant` du jeton**, résolu côté serveur. Un
compte marchand sans rattachement reçoit 403.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `merchant/orders` | Ses commandes uniquement |
| GET | `merchant/dashboard` | Volume, livrées, en cours, COD en attente, taux de réussite |
| GET | `merchant/wallet` | COD encaissé, commission, net à reverser |
| GET | `merchant/invoice` | Décompte dérivé des livraisons (indicatif, non fiscal) |

## Notifications — `v1/notifications`

Classe : `ADMIN`, `DISPATCHER`. Les lectures sont rouvertes au `COMPTABLE`.

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| GET | `notifications` | + `COMPTABLE` | Journal des envois |
| POST | `notifications/send` | `ADMIN`, `DISPATCHER` | Envoi manuel — **bloqué sans consentement** hors événement transactionnel |
| POST | `notifications/:id/retry` | `ADMIN`, `DISPATCHER` | Relance |
| GET | `notifications/templates` | + `COMPTABLE` | Catalogue bilingue |
| PUT | `notifications/templates/:event` | `ADMIN` | Personnalisation |
| POST | `notifications/templates/:event/reset` | `ADMIN` | Retour au modèle par défaut |
| GET | `notifications/consent/:subject` | `ADMIN`, `DISPATCHER` | Consentements d'une personne |
| POST | `notifications/consent` | `ADMIN`, `DISPATCHER` | Accorde ou retire un consentement par canal |

Quatre événements de course (`order.created`, `order.out`, `order.delivered`,
`order.failed`) alimentent le journal automatiquement, **après** l'écriture métier et sans
jamais la bloquer.

## Fraude — `v1/fraud`

Classe : `ADMIN` seulement. `DISPATCHER` et `COMPTABLE` reçoivent 403.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `fraud/cases` | Dossiers de risque, un par livreur, signaux cumulés |
| GET | `fraud/leaderboard` | Classement des livreurs à risque |
| POST | `fraud/cases/:id/:action` | Décision humaine : enquête, confirmation, blanchiment — tracée au journal d'audit |

## Analytique, avis, paramètres, géo

| Méthode | Route | Rôles | Ce que ça fait |
|---|---|---|---|
| GET | `v1/analytics/summary` | console | Indicateurs agrégés (taux de réussite…) |
| GET | `v1/reviews` | console | Avis clients agrégés — **lecture seule, pas de modération** |
| GET | `v1/settings/company` | console | Identité et réglages régionaux |
| POST | `v1/settings/company` | `ADMIN` | Enregistrement |
| GET | `v1/geo/regions` | authentifié | Référentiel administratif marocain |
| GET | `v1/geo/commune/:iso` | authentifié | Communes d'une province |

## Droits des personnes (Loi 09-08 / RGPD) — `v1/privacy`

Classe : `ADMIN`.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `privacy/export?subject=` | Export de portabilité, **courses comprises** |
| POST | `privacy/erase` | Effacement |

L'effacement **anonymise les courses sans les supprimer** : la commande reste due,
facturée et comptée ; c'est la personne qui disparaît, pas l'écriture comptable. La version
précédente ne touchait que les consentements et les notifications, si bien que la fiche
commande affichait toujours le numéro du destinataire après un effacement, et que le suivi
client continuait de servir ces champs.

## Suivi public — `v1/public/track`

Aucune authentification. Le tenant est un segment d'URL, validé côté serveur.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `public/track/:slug/:code` | Statut, étapes, villes. **Aucun téléphone, aucune adresse, aucun nom de livreur** |
| POST | `public/track/:slug/:code/rate` | Note 1–5 + commentaire. Refusé si non livré, refusé si déjà noté |

## Plateforme — `v1/saas` et `v1/audit`

Classe : `SUPER_ADMIN`. Hors `TenantGuard`.

| Méthode | Route | Ce que ça fait |
|---|---|---|
| GET | `saas/tenants` | Organisations et leur statut |
| POST | `saas/tenants` | Provisionnement (slug, nom, ville, plan, administrateur). Refuse un sous-domaine réservé |
| POST | `saas/tenants/:slug/admin` | Crée ou réinitialise l'administrateur d'une organisation |
| GET | `saas/tenants/:slug/subscription` | Abonnement courant |
| POST | `saas/tenants/:slug/subscription` | Souscription ou changement de plan (`immediate` ou à l'échéance) |
| POST | `saas/tenants/:slug/subscription/cancel` · `/suspend` · `/reactivate` | Cycle de vie, avec motif |
| POST | `saas/cycle/run` | Exécute le cycle : expiration d'essai, suspension après grâce, renouvellement. Une transition par appel, **rejouable sans effet de bord** |
| GET | `saas/billing` | Revenu mensuel et usage face au quota |
| GET | `saas/plans` | Catalogue, `?include=archived` |
| POST / PATCH | `saas/plans` · `saas/plans/:code` | Création, modification d'un plan |
| POST | `saas/plans/:code/archive` · `/restore` | Archivage, restauration |
| GET / POST | `saas/plans/:code/versions` | Versions tarifées d'un plan |
| GET | `audit` | Journal, filtrable par `?tenant=`, `?action=`, `?limit=` (500 max) |

## Santé

| Méthode | Route | Accès |
|---|---|---|
| GET | `health` | public |

---

## Ce que le PRD décrit et qui n'existe pas

- **Pas de webhooks sortants** vers les marchands, ni de clé d'API marchand, ni de journal
  d'appels : le PRD-02 décrit un écran « Intégration API », il n'a pas de contrepartie
  serveur.
- **Pas de temps réel** : ni WebSocket ni SSE. Le PC flotte, le dispatch et le suivi client
  lisent l'état à chaque chargement.
- **Pas de passerelle de notification** : les envois sont tracés, ils n'atteignent pas un
  opérateur.
- **Pas de paiement** : aucun abonnement Stripe ni encaissement en ligne côté plateforme.
- **Pas d'endpoint de shift** : le temps de conduite du livreur est local à son téléphone
  et ne remonte pas.
