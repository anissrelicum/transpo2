# TC-A04 — Slug réservé refusé

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A04)
- **Provisionner** avec le slug `api` (puis `www`, `admin`).
- Erreur explicite « Slug réservé à l'infrastructure », rien n'est créé.

## Obtenu
- Pour chacun des 3 slugs, l'API répond 400 et l'UI affiche une alerte native explicite
  (message capturé par le test) :
  - `api` → « Slug réservé à l'infrastructure : api »
  - `www` → « Slug réservé à l'infrastructure : www »
  - `admin` → « Slug réservé à l'infrastructure : admin »
- Le dialogue reste ouvert après le refus (saisie non perdue) — captures 01–03.
- Aucune création : la liste compte toujours 1 seule organisation (rabatexpress) — capture 04 ;
  `select count(*) from platform.tenants` = 1.

## Captures
- `01-slug-api-refuse.png`, `02-slug-www-refuse.png`, `03-slug-admin-refuse.png`
- `04-liste-inchangee-apres-refus.png`

## Anomalies
Aucune. (Observation UX mineure, non bloquante : l'erreur est présentée via une alerte native du
navigateur plutôt qu'un message inline dans le dialogue.)
