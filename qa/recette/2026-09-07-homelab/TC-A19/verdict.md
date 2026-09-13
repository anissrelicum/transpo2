# TC-A19 — Code de plan en doublon

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-bis, TC-A19)
- Créer un plan avec un code déjà pris.
- Erreur « Plan déjà existant : <code> », rien n'est créé.

## Obtenu
- Nouveau plan avec libellé « Essai » → code auto-rempli `essai` (déjà pris) — captures 01–02.
- L'API répond 409 et l'UI affiche l'alerte **« Plan déjà existant : essai »**
  (message capturé par le test) ; le dialogue reste ouvert.
- Rien créé : toujours 5 plans dans le catalogue, une seule ligne `essai` en base
  (`platform.plans`).

## Captures
- `01-code-doublon-saisi.png`, `02-doublon-refuse-dialogue-ouvert.png`

## Anomalies
Aucune.
