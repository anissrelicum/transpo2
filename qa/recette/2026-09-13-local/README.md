# Run 2026-09-13/14 — mode d'emploi

Environnement **local** (le homelab K8s était éteint) : API sur l'hôte, PostgreSQL en
conteneur, console Next.js, émulateur Android. Tout se remonte en cinq commandes.

## Monter l'environnement

```bash
docker compose up -d postgres
export DATABASE_URL=postgres://transpo:transpo_dev@localhost:5432/transpo
pnpm --filter @transpo/db migrate && pnpm --filter @transpo/db migrate-plans
API_PORT=3000 pnpm --filter @transpo/api start &                      # API
API_URL=http://localhost:3000 pnpm --filter @transpo/console-web dev & # console (port 3001)
node apps/driver-app/recette/amorcer.mjs                               # organisation, flotte, comptes
```

L'amorçage émet les mots de passe dans [COMPTES.md](COMPTES.md) : aucun cas n'en code un.

## Recette mobile (section G + TC-I05)

```bash
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_36.1 &
cd apps/driver-app && pnpm start &        # Metro
adb reverse tcp:8081 tcp:8081             # Expo Go joint Metro
RUN_ID=2026-09-13-local API_URL=http://localhost:3000 node recette/run.mjs        # les 18 cas
RUN_ID=2026-09-13-local API_URL=http://localhost:3000 node recette/run.mjs g07 i05 # au cas par cas
```

## Recette web (sections A à F, H à T)

```bash
apps/e2e-web/lancer-recette-locale.sh              # tout
apps/e2e-web/lancer-recette-locale.sh h01 l03      # quelques cas
```

⚠ **Jamais les deux de front.** Sur un poste unique, la recette mobile et la recette web se
disputent la machine ET la base : deux cas mobiles sont tombés le 14/09 pour cette seule
raison, et sont repassés au rejeu isolé.

## Contenu

```
TC-XXX/…              captures et vidéo du cas
COMPTES.md            identifiants émis à l'amorçage
RAPPORT.md            verdicts et constats produit — c'est la pièce qui porte le raisonnement
videos/               sorties brutes Playwright (non versionnées)
```
