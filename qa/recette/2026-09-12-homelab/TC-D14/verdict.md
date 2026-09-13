# TC-D14 — Chauffeur homonyme

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté*

**Attendu.** Créer un second `Hamid Ouali` → refus.

**Obtenu.** `POST /v1/drivers` → **409 « Un chauffeur porte déjà ce nom. »**, effectif inchangé. La règle n'est pas cosmétique : les commandes référencent le chauffeur **par son nom**, un homonyme rendrait l'attribution ambiguë.

**Preuve.** [`TC-D14.webm`](./TC-D14.webm)
