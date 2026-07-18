# Transpo — Roadmap (tranches verticales)

Chaque tranche livre du fonctionnel réel et passe la **Definition of Done** (`DEFINITION-OF-DONE.md`) avant merge : tout via Docker, tests (dont **E2E**), i18n FR/AR + RTL, isolation tenant, doc à jour. Séquencé par dépendances — réordonnable ; une tranche trop grosse peut être scindée.

Légende : ✅ fait · 🚧 en cours · ⏳ à venir · *(skeleton)* = livré au niveau squelette, non validé au run.

## Phase 0 — Fondations
- [x] **T0 — Amorçage mono-repo** *(skeleton)* — Docker, Postgres schema-per-tenant, `packages/domain`, API NestJS minimale (`/health`, `GET /v1/orders` isolé). — `transpo-architecture`
- [ ] **T1 — Couche données réelle** — Drizzle + migrations multi-schémas (platform + boucle tenants), runner `db:migrate:tenants`, remplace le seed SQL brut. — `transpo-architecture`
- [ ] **T2 — Auth, RBAC & durcissement multi-tenant** — login/2FA/SSO-SAML, JWT, rôles (admin/dispatcher/comptable/marchand/super-admin), guards, **journal d'audit**, provisioning tenant. — `transpo-auth-security`
- [ ] **T3 — Design-system & packages partagés** — `design-tokens` (échelle Radix), `ui-web` (Radix), `ui-native` (Tamagui), `i18n` (FR/AR + RTL), `api-client` typé. — `transpo-design-system`, `transpo-i18n`

## Phase 1 — Cœur opérationnel (Console transport)
- [ ] **T4 — Commandes** — liste (filtres/pagination), assistant de création 3 étapes, détail (timeline + onglets) ; API `orders` complète + 1ʳᵉ console Next.js. — PRD-01
- [ ] **T5 — Dispatch & zones** — carte temps réel, suggestion de livreur (scoring), éditeur de zones (**PostGIS**). — `transpo-maps-geo`, `transpo-realtime`
- [ ] **T6 — Flotte** — véhicules (échéances assurance/CT), chauffeurs (permis, **EU 561**), objectifs & primes.
- [ ] **T7 — Tournées** — planificateur multi-arrêts + **vrai moteur de routing**. — `transpo-maps-geo`

## Phase 2 — Terrain (App livreur, offline-first)
- [ ] **T8 — Livreur socle** — onboarding, login+permissions, missions, détail, statut séquentiel — **offline + idempotence**. — `transpo-offline-sync`
- [ ] **T9 — Livreur preuve/COD/caisse** — preuve paramétrable, encaissement COD, Ma caisse + dépôt, scanner (natif), shift EU 561.
- [ ] **T10 — Livreur annexes** — tournée mobile, support chat, historique & gains, incident, notifications, sync complète.

## Phase 3 — Argent & flux inverses
- [ ] **T11 — Cash & COD** — réconciliation (théorique/déclaré/déposé), reversement marchand, remboursement (transaction inverse), audit.
- [ ] **T12 — Retours & hub** — reverse logistics (tentatives, souffrance), tri en hub + manifeste de transfert.
- [ ] **T13 — Facturation & tarification** — grille (cascade à 3 niveaux), factures marchand + litiges, modes prépayé/post-payé, commission/TVA.

## Phase 4 — Marchand & Client
- [ ] **T14 — Portail marchand** — dashboard, commandes, portefeuille, factures, API/webhooks signés, mode de facturation. — PRD-02
- [ ] **T15 — Client final** — suivi public sans compte + app client (live tracking, créneau, chat, notation). — `transpo-realtime` (+ push)

## Phase 5 — Pilotage & SaaS
- [ ] **T16 — PC flotte temps réel** — tracking live, géofencing, alertes sortie de zone, plein écran. — `transpo-realtime`, `transpo-maps-geo`
- [ ] **T17 — Analytics/SLA & Fraude COD** — tableaux par zone/livreur/marchand ; détection de fraude (scoring, enquêtes, revue humaine).
- [ ] **T18 — Console SaaS** — tenants (provisioning réel), plans/abonnements, facturation plateforme, paywall. — PRD-05
- [ ] **T19 — Notifications** — modèles, canaux SMS/WhatsApp/push, **consentement 09-08**, centre de notifs admin.

## Phase 6 — Durcissement & mise en prod
- [ ] **T20 — Sécurité/conformité/observabilité** — audit complet, logs/monitoring, RGPD/09-08 + page confidentialité, perf.
- [ ] **T21 — CI/CD & déploiement** — images, migrations au déploiement, environnements, **suite E2E complète** (Playwright + Maestro). — `transpo-testing`, `transpo-git-workflow`

---

**Chemin critique** : T1 → T2 → T3 (rien de sérieux sans données réelles, auth et design-system). Statut : T0 faite (squelette), 21 tranches restantes.
