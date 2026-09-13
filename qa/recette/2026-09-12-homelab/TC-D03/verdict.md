# TC-D03 — Changer d'état

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** `1111-A-11` : Actif → Maintenance → Hors service → Actif, chaque état reflété dans la liste.

**Obtenu.** Conforme. Les trois bascules prennent effet immédiatement (badge et compteurs de la page), et l'état final **Actif** survit au rechargement.

**Preuve.** [`TC-D03.webm`](./TC-D03.webm)
