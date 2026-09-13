# TC-B15 — RBAC console (matrice)

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Toute action interdite absente ou désactivée dans l'UI ET refusée en 403 par l'API

**Obtenu.** Matrice parcourue pour ADMIN, DISPATCHER et COMPTABLE : enforcement 403 intégral côté API, lectures conformes, actions interdites absentes de l'UI

**Preuve.** [`TC-B15-2.webm`](./TC-B15-2.webm) · [`TC-B15.webm`](./TC-B15.webm)
