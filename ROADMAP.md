# Transpo — Roadmap (tranches verticales)

Chaque tranche livre du fonctionnel réel et passe la **Definition of Done** (`DEFINITION-OF-DONE.md`) avant merge : tout via Docker, tests (dont **E2E**), i18n FR/AR + RTL, isolation tenant, doc à jour. Séquencé par dépendances — réordonnable ; une tranche trop grosse peut être scindée.

Légende : ✅ fait · 🚧 en cours · ⏳ à venir · *(skeleton)* = livré au niveau squelette, non validé au run.

## Phase 0 — Fondations
- [x] **T0 — Amorçage mono-repo** ✅ *validé Docker* — Docker, Postgres schema-per-tenant, `packages/domain`, API NestJS (`/health`, `GET /v1/orders` isolé, `TenantGuard`).
- [x] **T1 — Couche données réelle** ✅ *validé Docker* — `packages/db` Drizzle, migrations platform + boucle tenants, `provisionTenant`, seed ; API branchée. Vérifié en conteneur : isolation casaexpress(2)/atlas(1), 400 sur tenant inconnu/absent.
- [x] **T2 — Auth, RBAC & durcissement multi-tenant** ✅ *validé Docker (E2E 10/10)* — login tenant + super-admin (argon2id), JWT {sub,role,tenant}, JwtAuthGuard/RolesGuard/@Roles, TenantGuard durci (claim JWT, anti cross-tenant), audit `platform.audit_log`, provisioning tenant (SUPER_ADMIN). 2FA/SSO-SAML : écrans posés côté maquette, à câbler ultérieurement. — `transpo-auth-security`
- [x] **T3 — Packages partagés** ✅ *validé Docker (typecheck workspace + E2E 10/10)* — `@transpo/i18n` (FR/AR + RTL), `@transpo/design-tokens` (échelle Radix, source unique web+RN), `@transpo/api-client` (typé). `ui-web` (Radix) / `ui-native` (Tamagui) : créés avec la 1ʳᵉ console (T4). — `transpo-design-system`, `transpo-i18n`

## Phase 1 — Cœur opérationnel (Console transport)
- [x] **T4 — Console web (shell complet + écriture)** ✅ *validé Docker (Playwright 9/9)* — shell fidèle à la maquette (sidebar groupée + topbar recherche/thème/avatar, indigo/slate, clair/sombre), **tenant résolu par le host** (sous-domaine, plus de saisie). **21 écrans** branchés à l'API, **fonctionnels en écriture** via un proxy authentifié : Commandes (création/assigner/avancer/annuler/encaisser + détail timeline), Fraude (arbitrage), Retours (reprogrammer/rendre), Tournées (créer/avancer), Zones/Véhicules (créer), PC flotte (géofence), Notifications (envoi), + Dispatch, Analytics, Caisse, Reversement, Factures, Tarification, Avis, Modèles, Utilisateurs, Paramètres, Hub. Servie en **build de prod**. — PRD-01
- [~] **T5 — Dispatch & zones** 🚧 *backend validé Docker* — zones (CRUD) + suggestion de livreur (score /100) ; carte temps réel + PostGIS à venir avec l'UI. E2E API. — `transpo-maps-geo`, `transpo-realtime`
- [~] **T6 — Flotte** 🚧 *backend validé Docker* — véhicules (CRUD + conformité assurance/CT) ; chauffeurs (GET). EU 561 / objectifs à venir. E2E API.
- [~] **T7 — Tournées** 🚧 *backend validé Docker* — planificateur multi-arrêts (regroupe commandes + assigne livreur), réordonnancement, cycle PLANIFIEE→EN_COURS→CLOTUREE, `@Roles ADMIN/DISPATCHER`. **Vrai moteur de routing** (optimisation d'ordre) : à compléter. E2E API. — `transpo-maps-geo`

## Phase 2 — Terrain (App livreur, offline-first)
- [~] **T8 — Livreur socle** 🚧 *backend validé Docker + app RN* — login DRIVER (claim `driver`), missions (commandes actives scopées), statut séquentiel, **idempotence offline** (Idempotency-Key → pas de double effet au rejeu). **App mobile Expo/React Native** (`apps/driver-app`) : écrans login/missions/mission branchés à l'API, packages partagés, typecheck en CI. Reste : onboarding, scanner natif, offline-store persistant, E2E Maestro (device requis). — `transpo-offline-sync`
- [~] **T9 — Livreur preuve/COD/caisse** 🚧 *backend validé Docker + app RN* — preuve de livraison + encaissement COD → LIVREE (idempotent) depuis l'app mobile, ownership vérifié. Ma caisse/dépôt, shift EU 561 : à compléter. E2E API.
- [~] **T10 — Livreur annexes** 🚧 *backend validé Docker* — signalement d'incidents (livreur) + traitement (ops), chat support bidirectionnel livreur↔ops, historique & gains (livraisons × forfait). Tournée mobile + sync complète : à compléter. E2E API.

## Phase 3 — Argent & flux inverses
- [~] **T11 — Cash & COD** 🚧 *backend validé Docker* — encaissement COD, réconciliation par livreur (théorique), reversement marchand (net=brut−commission). Dépôt/écart/remboursement : à compléter. E2E API.
- [~] **T12 — Retours & hub** 🚧 *backend validé Docker* — échec livraison → retour A_TRAITER, reprogrammation (plafond MAX_RETURN_ATTEMPTS=3), renvoi marchand → RENDU. Tri hub/manifeste : à compléter. E2E API.
- [~] **T13 — Facturation & tarification** 🚧 *backend validé Docker* — devis (cascade à 3 niveaux + TVA), factures marchand dérivées (commission/TVA). Litiges/modes prépayé-postpayé : à compléter. E2E API.

## Phase 4 — Marchand & Client
- [~] **T14 — Portail marchand** 🚧 *backend validé Docker* — vues scopées au marchand (claim JWT `merchant`, résolu serveur) : dashboard (KPIs), commandes, portefeuille (net = COD − commission), facture dérivée. `@Roles MERCHANT`. API/webhooks signés + mode facturation : à compléter. E2E API. — PRD-02
- [~] **T15 — Client final** 🚧 *backend validé Docker* — suivi public sans compte (timeline par code, tenant dans l'URL) + notation post-livraison (1..5, verrouillée). App client (live tracking, créneau, chat) : à compléter. E2E API. — `transpo-realtime` (+ push)

## Phase 5 — Pilotage & SaaS
- [~] **T16 — PC flotte temps réel** 🚧 *backend validé Docker* — ingestion de positions livreur, snapshot live (dernière position/livreur), **géofencing** (haversine) + alertes sortie de zone. Realtime en polling REST ; WebSocket + carte plein écran : à câbler avec l'UI. E2E API. — `transpo-realtime`, `transpo-maps-geo`
- [~] **T17 — Analytics/SLA & Fraude COD** 🚧 *backend validé Docker* — synthèse (successRate, byStatus) ; fraude : scoring (fraudScore), liste, leaderboard livreurs à risque, revue humaine (enquête/blanchir/confirmer) audité, `@Roles ADMIN`. Tableaux par zone/marchand : à compléter. E2E API.
- [~] **T18 — Console SaaS** 🚧 *backend validé Docker* — tenants (provisioning réel schema-per-tenant), catalogue de plans, changement de plan, facturation plateforme (montant + usage/quota), **paywall** (statut SUSPENDU bloque le login). UI console + abonnements Stripe : à compléter. E2E API. — PRD-05
- [~] **T19 — Notifications** 🚧 *backend validé Docker* — modèles bilingues FR/AR, canaux SMS/WhatsApp/push/email, **consentement 09-08** (transactionnel exempté, marketing bloqué sans opt-in), centre de notifs admin filtrable. Passerelles réelles (envoi effectif) : à câbler. E2E API.

## Phase 6 — Durcissement & mise en prod
- [~] **T20 — Sécurité/conformité/observabilité** 🚧 *backend validé Docker* — journal d'audit lisible (SUPER_ADMIN), droits des personnes RGPD/09-08 (export + effacement/anonymisation tracés), anti-bruteforce login (429). Monitoring/perf + page confidentialité : à compléter. E2E API.
- [~] **T21 — CI/CD & déploiement** 🚧 *pipeline validée Docker (répétition locale : typecheck + E2E API 83/83 + Playwright 2/2)* — GitHub Actions : build stack, typecheck workspace, suite E2E API complète, Playwright, teardown ; garde de concurrence. Registry/déploiement multi-env + Maestro (mobile) : à compléter. — `transpo-testing`, `transpo-git-workflow`

---

**Chemin critique** : T1 → T2 → T3 (rien de sérieux sans données réelles, auth et design-system). Statut : T0 faite (squelette), 21 tranches restantes.
