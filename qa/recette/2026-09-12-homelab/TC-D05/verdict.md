# TC-D05 — Retirer un véhicule

**Verdict : OK (avec constat)**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Suppression effective d'un véhicule jetable ; le retrait d'un véhicule **rattaché à un chauffeur** doit être **refusé ou détacher proprement** — comportement à consigner.

**Obtenu.**
- Véhicule jetable `9999-Z-99` créé puis retiré : confirmation « Le véhicule sera retiré du parc. Cette action est définitive. », ligne disparue après rechargement. Conforme.
- Véhicule `1111-A-11`, **rattaché à Hamid Ouali** : `DELETE /v1/vehicles/<id>` → **200**, véhicule supprimé du parc **sans le moindre avertissement**. La fiche chauffeur retombe silencieusement sur « Fourgon (non rattaché) » : ni refus, ni détachement propre — **→ AN-15**.
- Jeu de données §0.4 remis en état en fin de cas : `1111-A-11` recréé et rerattaché à Hamid Ouali.

**Preuve.** [`TC-D05.webm`](./TC-D05.webm)
