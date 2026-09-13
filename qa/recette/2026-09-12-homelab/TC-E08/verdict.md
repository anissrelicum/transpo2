# TC-E08 — Écriture des zones : dispatcher oui, comptable non

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté*

**Attendu.** Conforme à la matrice RBAC §B : le dispatcher écrit les zones, le comptable les consulte.

**Obtenu.** Conforme des deux côtés.
- **Dispatcher** : boutons **Nouvelle zone** et **Enregistrer** présents, `PATCH /v1/dispatch/zones/<id>` → **200**.
- **Comptable** : aucun bouton d'écriture, et les trois écritures appelées directement répondent **403** (`POST`, `PATCH`, `DELETE`).

**Preuve.** [`TC-E08.webm`](./TC-E08.webm)
