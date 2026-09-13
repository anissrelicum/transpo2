# Run 2026-09-12 — mode d'emploi

## Rejouer un cas
```bash
cd apps/e2e-web
pnpm exec playwright test --config playwright.recette-video.config.ts a03
node scripts/sort-videos.mjs        # range les .webm dans ../../qa/recette/<run>/TC-XXX/
```
`RUN_ID=2026-09-07-homelab` rebascule sur le run précédent (captures PNG).

## Contenu
```
TC-XXX/TC-XXX.webm   preuve vidéo du cas (bandeau d'étape incrusté)
TC-XXX/verdict.md    attendu / obtenu / anomalie
COMPTES.md           identifiants temporaires capturés au fil du run
RAPPORT.md           un cas = une ligne
resultats.json       sortie brute Playwright
```

## Mobile (section G) — Android uniquement
```bash
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_36.1 &
EXPO_PUBLIC_API_URL=http://transpo-api.wedowonders.com \
  pnpm --filter driver-app start --android
adb shell screenrecord /sdcard/TC-Gxx.mp4     # preuve vidéo
```
⚠ 16 Go de RAM : ne jamais faire tourner l'émulateur et Playwright en même temps.
