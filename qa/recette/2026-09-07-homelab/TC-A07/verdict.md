# TC-A07 — Recherche et filtre

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A07)
- Taper `tanger` dans la recherche ; filtrer sur chaque statut.
- Filtrage réel de la liste ; vider le champ restaure les 2 lignes.

## Obtenu
- Recherche `tanger` → **1 seule ligne** (Tanger Logistique) ; rabatexpress masqué — capture 01.
- Champ vidé → les **2 lignes** restaurées — capture 02.
- Filtre statut **Essai** → 2 lignes (les deux tenants sont en essai) — capture 03.
- Filtres **Actif**, **Impayé**, **Suspendu**, **Résilié** → 0 ligne, message dédié
  « Aucune organisation ne correspond au filtre. » — captures 04–07.
- Retour à **Tous statuts** → 2 lignes — capture 08.

## Captures
- `01-recherche-tanger-une-ligne.png`, `02-champ-vide-deux-lignes.png`
- `03-filtre-statut-essai.png`, `04-filtre-statut-actif.png`, `05-filtre-statut-impaye.png`,
  `06-filtre-statut-suspendu.png`, `07-filtre-statut-resilié.png`
- `08-tous-statuts-deux-lignes.png`

## Anomalies
Aucune. (Note : le plan mentionne un bouton « Réinitialiser » ; l'UI actuelle n'en a pas —
la remise à zéro se fait en vidant le champ, ce qui restaure bien les 2 lignes.)
