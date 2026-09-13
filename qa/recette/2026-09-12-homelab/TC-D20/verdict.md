# TC-D20 — Écriture flotte réservée à l'admin

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté*

**Attendu.** Le dispatcher consulte la flotte sans pouvoir l'écrire ; seule la disponibilité lui reste ouverte.

**Obtenu.** Conforme en UI **et** en API. Ni « Ajouter un véhicule » ni « Ajouter un chauffeur » ne s'affichent ; la bascule de disponibilité, elle, est bien active (cf. TC-D10). Les sept écritures appelées directement répondent **403** :
```
POST /v1/vehicles · DELETE /v1/vehicles/:id · POST /v1/vehicles/:id/renew
POST /v1/drivers  · PATCH /v1/drivers/:id   · PATCH /v1/drivers/:id/vehicle · DELETE /v1/drivers/:id
```
Aucun véhicule ni chauffeur créé après coup.

**Preuve.** [`TC-D20.webm`](./TC-D20.webm)
