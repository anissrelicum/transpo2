# TC-A02 — Bascule de realm sur la page de login

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A02)
- Depuis `/login?realm=saas`, cliquer le lien de bascule en bas de carte.
- Le badge passe de **Plateforme** à l'organisation détectée et l'email pré-rempli change.
- Re-cliquer revient à la plateforme.

## Obtenu
- État initial : badge `plateforme` (ambre), email pré-rempli `ops@transpo.ma` — capture 01.
- Clic sur « ← Connexion à une organisation » : badge indigo `transpo` (organisation détectée
  depuis le host), sous-titre « Console transport », email devient `admin@casaexpress.ma` — capture 02.
- Clic sur « Connexion console SaaS (plateforme) → » : retour badge `plateforme`, email `ops@transpo.ma` — capture 03.

## Captures
- `01-realm-plateforme-avant-bascule.png`
- `02-realm-organisation-apres-bascule.png`
- `03-retour-realm-plateforme.png`

## Anomalies / observations
- Aucune anomalie fonctionnelle.
- Observation (artefact d'environnement, pas un bug) : sur le homelab, l'organisation « détectée »
  est `transpo` car la console est servie sur `transpo.wedowonders.com` — le 1er label du host est
  pris pour slug. En prod (`<slug>.transpo.wedo.technology`) ce serait le vrai slug tenant. Le
  wildcard n'étant pas routé sur le homelab, la connexion tenant se fait via `?org=<slug>`.
