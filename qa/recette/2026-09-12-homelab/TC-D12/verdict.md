# TC-D12 — Immatriculation en doublon

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — clôt AN-16*

**Attendu.** Ajouter un véhicule dont la plaque est déjà au parc → refus, rien créé.

**Obtenu.** `POST /v1/vehicles` → **409 « Un véhicule porte déjà cette immatriculation. »** ; après rechargement, une seule ligne `1111-A-11` et un parc de taille inchangée. Le contrôle existait côté chauffeur (nom unique) mais manquait côté véhicule.

**Preuve.** [`TC-D12.webm`](./TC-D12.webm)
