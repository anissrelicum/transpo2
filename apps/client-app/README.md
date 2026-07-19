# Transpo — Application Client (mobile)

Application **React Native (Expo)** pour le client final : **suivi public d'un colis
par code** (sans compte) et **notation** après livraison. Partage `@transpo/domain`
et `@transpo/api-client` avec le mono-repo.

## Écrans
- **Accueil** (`app/index.tsx`) — saisie du code de suivi.
- **Suivi** (`app/track/[code].tsx`) — timeline du colis + notation 1–5 étoiles si livré.

Endpoints publics (aucune authentification) : `GET /v1/public/track/:slug/:code`,
`POST /v1/public/track/:slug/:code/rate`. Le tenant par défaut est `casaexpress`
(`app.json` → `extra.defaultTenant`).

## Lancer en local
```bash
docker compose up -d api                       # API sur :3000
pnpm --filter @transpo/client-app start        # puis Expo Go / simulateur
# Sur appareil physique : EXPO_PUBLIC_API_URL=http://<ip-machine>:3000
```
Code de démo : `TRACK123` (commande livrée seedée).

## Build EAS (cloud Expo)
Projet lié : `extra.eas.projectId` = `3effe70b-cb60-4c3b-aa0f-4213ad621d04`.
```bash
npm i -g eas-cli
export EXPO_TOKEN=<votre_token>       # ne pas committer
cd apps/client-app
eas build --platform android --profile preview     # APK de test
```
> Le build EAS s'exécute sur les serveurs Expo (nécessite réseau + crédits du compte).

## Validation
- **Typecheck** intégré à la CI (`pnpm -r typecheck`).
- Les endpoints de suivi/notation sont couverts par les E2E API
  (`apps/e2e/tests/70_public_track.test.mjs`, 5 tests) sous Docker.
