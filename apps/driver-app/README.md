# Transpo — Application Livreur (mobile)

Application **React Native (Expo)** pour les livreurs. Partage la logique métier
(`@transpo/domain`) et le client HTTP typé (`@transpo/api-client`) avec le reste
du mono-repo — cohérence garantie web ↔ mobile.

## Écrans
- **Connexion** (`app/index.tsx`) — login livreur (rôle `DRIVER`).
- **Mes missions** (`app/missions.tsx`) — commandes actives assignées, pull-to-refresh.
- **Mission** (`app/mission/[ref].tsx`) — timeline du cycle de vie, action
  « Étape suivante » (idempotente) et « Confirmer la livraison » + encaissement COD.

## Lancer l'app
Prérequis : l'API doit tourner (`docker compose up -d api`, écoute sur `:3000`).

```bash
pnpm --filter @transpo/driver-app start   # ou: cd apps/driver-app && npx expo start
```
Puis scanner le QR code avec **Expo Go** (iOS/Android), ou `i` / `a` pour un simulateur.

### URL de l'API
Sur un appareil physique, `localhost` pointe vers le téléphone. Renseigner l'IP de
la machine hôte :
```bash
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npx expo start
```
(ou modifier `app.json` → `expo.extra.apiUrl`).

## Comptes de démo
- Tenant `casaexpress` · `livreur@casaexpress.ma` / `transpo`

## Validation
- **Typecheck** intégré à la CI (`pnpm -r typecheck`) — l'app est vérifiée à chaque build.
- Les **flux métier** qu'elle appelle (missions, avancement idempotent, preuve+COD,
  RBAC, ownership) sont couverts par les tests E2E API (`apps/e2e/tests/C0_driver.test.mjs`,
  5 tests) exécutés sous Docker.
- L'E2E natif sur appareil/émulateur (Maestro) n'est pas exécuté dans cet
  environnement sans device — voir ROADMAP.
