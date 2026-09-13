# TC-B16 — Comptage anti-bruteforce durable et par source

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté après correctif — clôt OBS-02*

**Attendu.** Le blocage survit à un redémarrage de l'API, et un balayage d'adresses depuis une même source finit par être freiné.

**Obtenu.** Conforme.
- 5 échecs sur une adresse → 6ᵉ tentative en **429** ; compteur lu **en base** (`platform.login_attempts`, count = 5), plus en mémoire du processus.
- `kubectl rollout restart deployment/transpo-api` → après redémarrage, la tentative suivante est **toujours refusée** « Trop de tentatives. ». L'ancien compteur mémoire repartait de zéro à cet instant précis.
- *Password spraying* : des adresses toutes différentes depuis la même machine sont freinées à la 9ᵉ tentative — le compteur par source (`ip:`) existe et joue son rôle.

**À savoir pour la recette.** Le seuil par source est global à la machine et couvre 15 minutes : tous les cas à connexion refusée (B03, B04, B13…) consomment le même budget. Le cas purge les clés `ip:` en fin d'exécution, sinon la suite du run ne pourrait plus se connecter — c'est le produit qui a raison, c'est la recette qui doit s'y adapter.

**Preuve.** [`TC-B16.webm`](./TC-B16.webm)
