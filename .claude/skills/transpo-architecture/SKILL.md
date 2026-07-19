---
name: transpo-architecture
description: >
  Architecture cible et structure du mono-repo Transpo : apps React Native (Expo) + Next.js,
  backend NestJS, PostgreSQL multi-tenant en SCHEMA-PER-TENANT (workspace = schéma = tenant),
  packages partagés (design-tokens, i18n, types, api-client). À CONSULTER pour créer une app/
  un package, un module backend, un contexte métier, gérer la résolution de tenant, les migrations,
  ou l'accès aux données. Déclencheurs : "mono-repo", "package", "tenant", "schema postgres",
  "workspace", "migration", "backend", "module", "structure du projet", "où mettre".
---

# Transpo — Architecture (mono-repo, multi-tenant schema-per-tenant)

> Choix de stack recommandés ci-dessous — **à valider par l'équipe** avant le premier commit de code. Le domaine (`transpo-domain`) et les conventions (`transpo-design-system`, `transpo-i18n`, `transpo-api`) sont indépendants de ces choix.

## ⚠️ NestJS sous tsx/esbuild — injection explicite obligatoire
L'API tourne via `tsx` (esbuild), qui **n'émet pas les métadonnées de décorateur** (`emitDecoratorMetadata`). Conséquence : l'injection NestJS **par type** échoue silencieusement (`this.xxx` = undefined → 500 au runtime, invisible au typecheck).
- **Règle** : annoter **chaque** paramètre de constructeur injecté avec `@Inject(Token)` — services, guards, `Reflector`, tout. Jamais de `constructor(private x: Service)` nu.
- **Router** : NestJS renvoie **201 par défaut sur les POST** ; utiliser `@HttpCode(200)` sur les endpoints qui doivent répondre 200 (ex. login).
- Ces deux points sont systématiquement validés par les E2E Docker (un service mal injecté fait échouer le test).

## Stack
- **Mono-repo** : pnpm workspaces + Turborepo.
- **Backend** : NestJS (TypeScript, modulaire/DDD, guards & interceptors → idéal pour la résolution de tenant).
- **Base** : PostgreSQL, **isolation schema-per-tenant**.
- **Accès données** : Drizzle ORM (bon support du `search_path` dynamique) — alternative Prisma possible mais multi-schema plus contraint.
- **Web (consoles Admin/Marchand/SaaS)** : Next.js (App Router) + **Radix Themes** (voir `transpo-design-system`).
- **Mobile (App livreur + App client)** : Expo React Native (voir `transpo-design-system` pour l'UI — Radix étant web-only, tokens partagés + Tamagui).

## Structure du mono-repo
```
transpo/
├── apps/
│   ├── api/            # NestJS — backend (bounded contexts)
│   ├── console-web/    # Next.js — Console transport (admin/dispatcher)
│   ├── merchant-web/   # Next.js — Portail marchand (ou route du même app)
│   ├── saas-admin/     # Next.js — Console SaaS (super-admin)
│   ├── driver-app/     # Expo RN — App livreur
│   └── customer-app/   # Expo RN — App client (+ suivi public web léger)
├── packages/
│   ├── domain/         # enums (STATUS…), règles pures, types métier — 0 dépendance UI
│   ├── design-tokens/  # indigo/slate, radius, spacing (Radix scale) — web + RN
│   ├── ui-web/         # composants Radix (StatusBadge, KPI, money…) pour Next.js
│   ├── ui-native/      # composants Tamagui miroir pour RN
│   ├── i18n/           # dictionnaires FR/AR, STATUS_AR, dir/RTL helpers
│   ├── api-client/     # client typé (contrats de transpo-api)
│   └── db/             # schéma Drizzle, migrations, tenant manager
└── turbo.json / pnpm-workspace.yaml
```

## Exécution — TOUT passe par Docker (règle stricte)
Aucune dépendance n'est installée ni lancée sur la machine hôte : base, back, fronts, migrations, tests tournent **en conteneur**.
- **`docker-compose.yml`** (dev) orchestre au minimum : `postgres` (avec volume persistant), `api` (NestJS, hot-reload via volume monté), les apps web Next.js, un `mailhog`/stub pour les e-mails, et un service `db-migrate`. Les apps RN (Expo) se lancent via un conteneur outillé ou le tunnel Expo — documenter la commande.
- **Un `Dockerfile` par app** (`apps/*/Dockerfile`), multi-stage (build → runtime léger). Images de base épinglées (pas de `latest`).
- **Commandes canoniques** : `docker compose up` (dev), `docker compose run --rm db-migrate` (migrations), `docker compose run --rm api pnpm test` (tests), `docker compose run --rm e2e` (E2E). Ne jamais documenter un `npm run` à exécuter hors conteneur.
- **Postgres schema-per-tenant** : le conteneur `postgres` héberge `platform` + les schémas de tenants ; le seed de dev provisionne 1-2 tenants de démo.
- **Parité dev/CI/prod** : la CI réutilise les mêmes images/compose ; le `.env.example` documente toutes les variables. Secrets hors du repo.
- **Definition of Done** inclut : « démarre proprement via `docker compose up` depuis un clone neuf, sans installer quoi que ce soit sur l'hôte ». Voir `DEFINITION-OF-DONE.md`.

## Multi-tenant : workspace = schéma Postgres = tenant
- **Un schéma Postgres par tenant** (ex. `tenant_casaexpress`). Un schéma `public` (ou `platform`) pour les tables globales : `tenants`, `plans`, `platform_invoices`, comptes super-admin.
- **Provisioning d'un tenant** = créer le schéma + appliquer les migrations métier dessus + insérer la ligne dans `platform.tenants`. C'est l'action derrière « Provisionner un tenant » (Console SaaS).
- **Résolution du tenant par requête** : depuis le sous-domaine (`casaexpress.transpo.ma`) ou le claim `tenant` du JWT → un middleware/interceptor NestJS ouvre une connexion et exécute `SET search_path TO tenant_<x>, public` avant de traiter la requête. Toujours dériver le tenant du contexte serveur, **jamais d'un paramètre client non vérifié**.
- **Isolation stricte** : aucune requête ne doit croiser deux schémas de tenants. Les tables globales restent dans `platform`.
- **Migrations** : versionnées ; à appliquer sur `platform` + itérer sur tous les schémas de tenants. Prévoir une commande `db:migrate:tenants`.

## Contextes métier (modules NestJS)
`orders`, `dispatch` (+ zones, suggestion), `fleet` (véhicules, chauffeurs, EU 561), `tours` (tournées), `cash` (réconciliation, reversement, remboursement), `hub` (tri, manifeste), `returns`, `fraud`, `analytics`, `billing` (factures marchand + modes), `notifications` (canaux + consentement 09-08), `tenants` (SaaS : provisioning, plans, paywall), `auth` (login, 2FA, SSO/SAML). Chaque module aligné sur le domaine (`transpo-domain`).

## Règles d'architecture
- `packages/domain` est **pur** (types + règles), importable par le back ET les fronts → une seule source pour les enums/règles.
- Le calcul métier sensible (tarif, EU 561, score de fraude, réconciliation) vit côté back dans `domain`/module, jamais dupliqué dans l'UI.
- Offline-first livreur : file d'actions locale + resync idempotente (clé d'idempotence par action) — le back doit accepter les rejeux sans doublon.
