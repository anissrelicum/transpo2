# Vidéos de démo Transpo

Démo produit narrée en français (voix Deepgram `aura-2-agathe-fr`), tournée sur l'environnement
publié (homelab : console `app.wedowonders.com`, site `transpo.wedowonders.com`) avec un
transporteur fictif, **Atlas Express** (Casablanca). Le fil : « une course, quatre mains, un seul
dossier ».

| Chapitre | Contenu | Rôle à l'écran |
|---|---|---|
| 00-decouvrir | Site vitrine, estimation, demande de démo | prospect |
| 01-plateforme | Console SaaS : demande reçue, provisionnement d'Atlas Express, facturation, audit | équipe Transpo |
| 02-installer | Paramètres, utilisateurs et rôles, chauffeurs, véhicules, zones, tarification | admin (Karim Berrada) |
| 03-marchand | Portail marchand : nouvelle commande, suivi, portefeuille | marchand (Maison Argane) |
| 04-dispatch | Commandes, preuve, affectation assistée, tournée, PC flotte, retours | dispatcher (Salma Idrissi) |
| 05-livreur | App Android : missions, progression, signature, encaissement COD, caisse du jour | livreur (Youssef Amrani) |
| 06-compta | Réconciliation cash, écart motivé, reversements, factures, vue marchand | comptable (Fatima Zahra Bennani) |
| 07-piloter | Tableau de bord, analytics/SLA, fraude COD, avis, notifications, arabe RTL, thème sombre | admin |

## Rejouer

Pré-requis : `DEEPGRAM_API_KEY` dans l'environnement, Chromium Playwright (`apps/e2e-web`),
`ffmpeg`, et pour le chapitre 5 l'émulateur Android avec l'APK release
(`com.anissrelicum.transpodriver`, construit avec `-PreactNativeArchitectures=x86_64`).

```bash
export DEEPGRAM_API_KEY=…
node qa/demo/chapitres/00-decouvrir.mjs
SLUG=atlasexpress node qa/demo/chapitres/01-plateforme.mjs      # provisionne : slug NEUF à chaque fois
TENANT=atlasexpress ADMIN_EMAIL=karim.berrada@atlasexpress.ma \
  ADMIN_PASSWORD="$(jq -r .password qa/demo/sortie/admin.json)" node qa/demo/amorcer-demo.mjs
for c in 02-installer 03-marchand 04-dispatch 05-livreur 06-compta 07-piloter; do
  node qa/demo/chapitres/$c.mjs || break
done
```

- **Un seul jour UTC** entre l'amorçage et les chapitres 5–6 : la caisse du livreur est datée.
- **Un chapitre à la fois**, machine au repos : l'émulateur décroche sous charge.
- Les chapitres 01, 06 (reversements, factures) et l'amorçage ne se rejouent pas sur le même
  tenant : provisionner un nouveau slug.
- `DEMO_COMPTES=<fichier>` fait répéter un chapitre sur un autre tenant déjà amorcé.

Sorties (non versionnées) dans `qa/demo/sortie/` : un `.mp4` + `.srt` par chapitre, et
`transpo-demo-complete.mp4` / `.srt`.

## Moteur

- `moteur.mjs` — web : capture par screencast CDP horodaté (pas la vidéo Playwright, qui
  dérivait de plusieurs secondes sous charge), narration phrase par phrase via `t.dire()`,
  temps de chargement coupés au montage, curseur et clics rendus visibles.
- `mobile.mjs` — Android : un clip `screenrecord` par phrase, incrusté dans un cadre 1440×900 ;
  les gestes plus longs que la phrase sont accélérés (×6 au plus).
