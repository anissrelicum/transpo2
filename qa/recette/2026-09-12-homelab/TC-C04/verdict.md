# TC-C04 — Écriture réservée à l'admin

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Le dispatcher consulte `/settings` mais ne peut rien enregistrer (403 côté API).

**Obtenu.** Conforme et défendu des deux côtés. Bandeau « Lecture seule — la modification des paramètres est réservée à l'administrateur. », champs désactivés, aucun bouton d'enregistrement ; `POST /v1/settings/company` avec la session dispatcher → **403 « Rôle insuffisant pour cette action. »**, valeurs inchangées après rechargement.

**Preuve.** [`TC-C04.webm`](./TC-C04.webm)
