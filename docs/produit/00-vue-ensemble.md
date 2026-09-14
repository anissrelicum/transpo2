# Vue d'ensemble

Transpo est une plateforme SaaS de **livraison du dernier kilomètre au Maroc**. Elle est
vendue en marque blanche à des sociétés de transport : Transpo n'est pas un transporteur,
c'est le logiciel que plusieurs transporteurs utilisent, chacun dans son espace étanche.

Cette documentation décrit **ce qui existe dans le code**, pas ce que les PRD projettent.
Quand une fonction est simulée, statique ou absente, c'est écrit à l'endroit où le lecteur
se poserait la question.

## À quoi ça sert

Une course traverse toujours les mêmes mains :

1. un **marchand** dépose une commande de livraison (portail web ou API) ;
2. un **dispatcher** l'affecte à un livreur, seul ou groupée dans une tournée ;
3. le **livreur** retire le colis, le scanne, le livre, dépose une preuve et encaisse le
   contre-remboursement (COD) si la commande en porte un ;
4. le **client final** suit son colis par un code à 8 caractères, sans compte, puis note
   la livraison ;
5. l'**exploitant de la plateforme** (super-admin) gère les organisations clientes, leurs
   plans, leur facturation et leur suspension.

Tout ce qui touche à l'argent liquide remonte ensuite : caisse du livreur, dépôt en agence,
réconciliation comptable, reversement au marchand net de commission.

## Le cycle de vie d'une commande

C'est la colonne vertébrale du produit. Le même enchaînement vaut pour la console, l'app
livreur et le suivi client — il est défini une seule fois, dans `packages/domain`.

```
PROGRAMMEE → NOUVELLE → ASSIGNEE → RETRAIT → RECUPEREE → LIVRAISON → LIVREE
                                                             ↘ ECHOUEE → RETOUR
                                                             ↘ ANNULEE
```

| Statut | Libellé FR | Libellé AR | Couleur |
|---|---|---|---|
| `PROGRAMMEE` | Programmée | مبرمجة | gris |
| `NOUVELLE` | Nouvelle | جديدة | bleu |
| `ASSIGNEE` | Assignée | مُسندة | indigo |
| `RETRAIT` | En route (retrait) | في الطريق (الاستلام) | cyan |
| `RECUPEREE` | Récupérée | تم الاستلام | violet |
| `LIVRAISON` | En route (livraison) | في الطريق (التسليم) | ambre |
| `LIVREE` | Livrée | تم التسليم | vert |
| `ECHOUEE` | Échouée | فشل | rouge |
| `RETOUR` | Retour | إرجاع | orange |
| `ANNULEE` | Annulée | ملغاة | gris |

**Le serveur est autoritaire sur les transitions.** `canTransition()` n'autorise que
l'étape suivante du chemin nominal ; `ECHOUEE` n'est atteignable que depuis `LIVRAISON`,
`RETOUR` que depuis `ECHOUEE`, et une commande `LIVREE` ne s'annule plus. Un client qui
envoie une transition hors séquence est refusé, pas corrigé.

## Les rôles

Six rôles, vérifiés **côté serveur** par `RolesGuard`. La console masque ce qui n'est pas
permis, mais c'est l'API qui fait autorité : chaque écran en lecture seule correspond à un
403 réel si on force la requête.

| Rôle | Où il travaille | Ce qu'il peut faire |
|---|---|---|
| `SUPER_ADMIN` | Console SaaS `/saas` | Organisations, plans, abonnements, facturation plateforme, journal d'audit. Hors tenant : son jeton porte `platform: true`. |
| `ADMIN` | Console d'exploitation | Accès complet à tous les modules de son organisation, y compris flotte, tarification, caisse, fraude, droits Loi 09-08. |
| `DISPATCHER` | Console d'exploitation | Commandes, dispatch, zones, tournées, hub, retours, incidents, notifications. **Fermé** : caisse, reversements, fraude, facturation. |
| `COMPTABLE` | Console d'exploitation | Facturation, caisse, reversements, tarification en lecture. **Fermé** : les gestes d'exploitation (scan hub, assignation, avancement de statut). |
| `MERCHANT` | Portail marchand `/portail` | Ses commandes à lui, son portefeuille, sa facture. Redirigé hors de la console d'exploitation. |
| `DRIVER` | App livreur (mobile) | Ses missions à lui, sa tournée, sa caisse, ses incidents, son fil de support. |

Les trois rôles de console (`ADMIN`, `DISPATCHER`, `COMPTABLE`) sont regroupés sous
`CONSOLE_ROLES` et posés au niveau **classe** sur chaque contrôleur d'exploitation : sans
cette restriction, un marchand ou un livreur authentifié du même tenant lirait les données
de toute l'organisation.

## Le cloisonnement multi-tenant

Un tenant = une organisation = **un schéma PostgreSQL** (`tenant_<slug>`). Il n'y a pas de
colonne `tenant_id` à filtrer : l'isolation est structurelle, portée par le `search_path`.

La résolution du tenant se fait **uniquement côté serveur**, dans cet ordre de priorité :

1. le claim `tenant` du JWT ;
2. l'en-tête `x-tenant-slug` ;
3. le sous-domaine de l'hôte (`rabatexpress.transpo.wedo.technology` → `rabatexpress`).

Un en-tête qui **diverge** du JWT est refusé en 403 « Incohérence de tenant » — c'est une
tentative inter-tenant délibérée, pas une ambiguïté. Le sous-domaine ne sert que de repli
quand rien d'autre ne désigne le tenant ; les sous-domaines d'infrastructure (`api`, `www`,
`app`, `admin`…) sont réservés et ne peuvent jamais être un slug de tenant.

**Paywall.** Une organisation au statut `SUSPENDU` est refusée par `TenantGuard`, pas
seulement au login : les jetons vivent 12 h, et ne contrôler qu'à la connexion laisserait
l'accès ouvert tout ce temps après la suspension. Le realm plateforme (`/v1/saas`,
`/v1/audit`) échappe volontairement à ce garde — sinon on ne pourrait plus réactiver une
organisation une fois suspendue.

## Règles métier transverses

Elles vivent dans `packages/domain/src/index.ts` et nulle part ailleurs. Les dupliquer
dans un écran est un défaut : c'est arrivé pour la règle EU 561, corrigé depuis.

| Règle | Valeur | Où |
|---|---|---|
| Devise | Dirham, format `fr-FR`, isolat bidi pour l'affichage en arabe | `money()` |
| Commission plateforme | 15 % par défaut, configurable par organisation | `COMMISSION_RATE` |
| TVA | 20 % | `VAT_RATE` |
| Cascade tarifaire | ① prix fixe marchand → ② remise contractuelle → ③ grille par paliers. Priorité stricte, le premier niveau applicable l'emporte. | `quote()` |
| Preuve de livraison | `aucune` / `photo` / `signature` / `photo_signature`, **par commande** | `PROOF_LEVELS` |
| Retours | 3 tentatives maximum | `MAX_RETURN_ATTEMPTS` |
| Conduite EU 561/2006 | 9 h max par jour, pause après 4 h 30, alerte 30 min avant la limite | `eu561Status()` |
| Fraude COD | 6 signaux pondérés (35/30/28/22/18/15 pts), score plafonné à 100 | `FRAUD_SIGNALS`, `fraudScore()` |
| Rémunération livreur | 12 DH par livraison réussie | `DRIVER_DELIVERY_FEE` |
| Consentement Loi 09-08 | obligatoire hors événement transactionnel | `requiresConsent()` |

Deux règles ne sont pas des chiffres mais des principes, et le code les tient :

- **Une livraison ne se clôt pas sans sa preuve.** `missingProof()` refuse la validation
  tant que les artefacts exigés par le niveau de la commande manquent, et le bouton de
  l'app livreur **nomme** ce qui manque (« Photo requise », puis « Signature requise »).
- **Un score de fraude n'est jamais une sanction.** Les signaux s'accumulent dans un
  dossier par livreur ; l'ouverture, l'enquête, la confirmation et le blanchiment sont des
  décisions humaines, tracées au journal d'audit.

## Les interfaces

| Interface | Techno | Détail |
|---|---|---|
| Console d'exploitation | Next.js 14 (App Router) + Radix Themes | [10-console-exploitation.md](10-console-exploitation.md) |
| Portail marchand | mêmes routes, sous `/portail` | [20-portail-marchand.md](20-portail-marchand.md) |
| Console SaaS | mêmes routes, sous `/saas` | [10-console-exploitation.md](10-console-exploitation.md#console-saas) |
| App livreur | React Native / Expo | [30-app-livreur.md](30-app-livreur.md) |
| Suivi client | React Native / Expo + endpoints publics | [40-suivi-client.md](40-suivi-client.md) |
| API | NestJS + PostgreSQL (Drizzle) | [50-api.md](50-api.md) |
| Exploitation | Docker, Dokku, recette | [60-exploitation.md](60-exploitation.md) |

## Bilingue et thème

FR/AR avec RTL complet sur les consoles et l'app livreur. Le dictionnaire partagé vit dans
`packages/i18n` ; le libellé de statut n'est jamais retraduit, il vient de `STATUS_META`.
Le choix de langue est posé en cookie côté serveur puis la page est rechargée en dur : un
re-rendu client laisserait l'attribut `dir` inchangé.

Le thème clair/sombre de la console est **persisté** — il ne vivait que dans l'état du
composant, si bien que chaque navigation ramenait au thème clair.

L'échelle visuelle (indigo/slate, rayon `medium`, panneaux opaques) est définie une seule
fois dans `packages/design-tokens`, avec les valeurs hexadécimales exactes des échelles
Radix pour que React Native — qui n'a pas de `var(--indigo-9)` — rende la même couleur que
le web.
