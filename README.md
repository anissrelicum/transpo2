# Transpo — plateforme de livraison last-mile (Maroc)

Mono-repo : consoles web (Next.js), apps mobiles (React Native/Expo), backend NestJS, PostgreSQL **multi-tenant en schema-per-tenant** (workspace = schéma = tenant). Design **Radix** (cohérence web↔mobile, fidèle à la maquette).

Spécification produit : `PRD-00-Vue-Ensemble.md` → `PRD-06`. Conventions de dev : `.claude/skills/transpo-*`. Critères de clôture : `DEFINITION-OF-DONE.md`.

## Prérequis
**Docker uniquement.** Rien à installer sur l'hôte (Node/pnpm/Postgres tournent en conteneur — cf. skill `transpo-architecture`).

## Démarrage (une commande)
```bash
cp .env.example .env
docker compose up --build
```
- API : http://localhost:3000
- Postgres : localhost:5432 (le service `migrate` applique les migrations puis seede `platform`, `tenant_casaexpress`, `tenant_atlas` avant le démarrage de l'API)

### Vérifier
```bash
# Santé
curl localhost:3000/health

# Commandes du tenant CasaExpress (2 lignes)
curl -H "x-tenant-slug: casaexpress" localhost:3000/v1/orders

# Isolation : le tenant Atlas voit d'autres données (1 ligne), jamais celles de CasaExpress
curl -H "x-tenant-slug: atlas" localhost:3000/v1/orders

# Tenant inconnu -> 400
curl -H "x-tenant-slug: inconnu" localhost:3000/v1/orders
```

## Structure
```
apps/
  api/            # NestJS — backend (middleware de tenant + module orders) ✅ amorcé
  console-web/    # Next.js — Console transport                              ⏳ à venir
  merchant-web/   # Next.js — Portail marchand                              ⏳
  saas-admin/     # Next.js — Console SaaS                                  ⏳
  driver-app/     # Expo RN — App livreur                                   ⏳
  customer-app/   # Expo RN — App client                                    ⏳
packages/
  domain/         # enums/règles pures (STATUS, proof_level, money…)         ✅
  design-tokens/  # échelle visuelle Radix partagée web+mobile              ⏳
  i18n/           # dictionnaires FR/AR + RTL                                ⏳
  api-client/     # client typé                                             ⏳
  db/             # Drizzle + migrations schema-per-tenant + provisioning     ✅

docs/adr/         # décisions d'architecture                                 ✅
```

## État de cet amorçage
Livré au **niveau squelette** (voir `DEFINITION-OF-DONE.md` → niveaux) : structure, Docker, Postgres schema-per-tenant seedé, package `domain` réel, API NestJS minimale (tenant middleware + `GET /v1/orders` isolé par schéma). **Non encore vérifié par `docker compose up` sur cette machine** — à valider au premier run.

**Prochaines tranches** : Drizzle + migrations multi-schémas, auth/RBAC (`transpo-auth-security`), packages `design-tokens`/`i18n`/`api-client`, consoles Next.js (Radix), apps Expo (Tamagui), tests E2E (Playwright/Maestro), pipeline CI complet.
