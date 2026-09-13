# TC-E02 — Effacer le tracé en cours

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Deux sommets cliqués puis **Effacer** : les sommets disparaissent sans supprimer la zone tant qu'on n'enregistre pas.

**Obtenu.** Conforme. Le bouton **Effacer** n'apparaît qu'une fois un sommet posé et disparaît avec le dernier ; la zone reste listée, et la base est inchangée (4 sommets avant comme après). Un rechargement ramène bien le tracé enregistré.

**Preuve.** [`TC-E02.webm`](./TC-E02.webm)
