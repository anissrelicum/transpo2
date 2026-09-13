# TC-D13 — Immatriculation au format invalide

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté*

**Attendu.** Plaque `ABCD` refusée dans l'UI et par l'API (format marocain NNNN-L-NN).

**Obtenu.** Conforme des deux côtés : le formulaire affiche « Format attendu : NNNN-L-NN » et **désactive Ajouter** ; `POST /v1/vehicles` en direct → **400 « Immatriculation invalide (format marocain NNNN-L-NN). »**. Parc inchangé.

**Preuve.** [`TC-D13.webm`](./TC-D13.webm)
