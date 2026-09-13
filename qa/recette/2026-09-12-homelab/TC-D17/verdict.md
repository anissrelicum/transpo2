# TC-D17 — Retrait d'un véhicule rattaché

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — non-régression AN-15*

**Attendu.** Refus explicite nommant le chauffeur ; véhicule conservé, fiche intacte.

**Obtenu.** `DELETE /v1/vehicles/<id>` → **400 « Impossible : véhicule rattaché à Hamid Ouali. Détachez-le d'abord depuis la fiche chauffeur. »**. Le véhicule reste au parc, la fiche de `Hamid Ouali` porte toujours la plaque. Le garde-fou est désormais symétrique de celui du retrait de chauffeur.

**Preuve.** [`TC-D17.webm`](./TC-D17.webm)
