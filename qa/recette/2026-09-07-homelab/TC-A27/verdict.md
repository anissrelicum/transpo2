# TC-A27 — Résiliation

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A27)
- Menu → **Résilier**, motif obligatoire, confirmer.
- L'abonnement disparaît des abonnements courants, le tenant est **sans accès**, et une nouvelle
  souscription redevient possible via **Souscrire / changer de plan**.

## Obtenu
- Dialogue de résiliation : le bouton **Résilier est désactivé tant que le motif est vide** —
  capture 01 ; activé après saisie du motif « Fin de la recette A-ter ».
- Après confirmation : la ligne atlasfret affiche **« Aucun abonnement »** (tarif « — sans
  contrat »), bandeau rouge « 1 organisation(s) sans accès » — capture 02. En base : plus aucun
  abonnement courant (`ended_at IS NULL` → 0), le dernier abonnement est clos en **RESILIE**.
- Connexion `/login?org=atlasfret` : **refusée** (« Espace suspendu — contactez la plateforme. »)
  — capture 03.
- Le menu « … » propose toujours **Souscrire / changer de plan**, dialogue ouvrable et **Valider
  actif** : une nouvelle souscription redevient possible — capture 04 (vérifiée sans être
  exécutée : atlasfret doit rester résilié pour TC-A28).

## Captures
- `01-motif-obligatoire-bouton-desactive.png`, `02-abonnement-clos-aucun-abonnement.png`
- `03-connexion-refusee-resilie.png`, `04-resouscription-possible.png`

## Anomalies
Aucune.
