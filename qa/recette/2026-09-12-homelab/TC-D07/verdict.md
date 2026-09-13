# TC-D07 — Téléphone invalide

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Création d'un chauffeur avec le téléphone `abc` → refus « Téléphone invalide. ».

**Obtenu.** Conforme et défendu des deux côtés : l'UI signale « Numéro invalide. » et désactive **Ajouter** ; `POST /v1/drivers` en direct → **400 « Téléphone invalide. »**. Rien n'est créé.

**Preuve.** [`TC-D07.webm`](./TC-D07.webm)
