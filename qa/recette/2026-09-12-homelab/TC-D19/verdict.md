# TC-D19 — Modifier la fiche d'un chauffeur

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — clôt AN-14*

**Attendu.** Ville, type de véhicule déclaré, téléphone et n° de permis modifiables et persistés ; le type déclaré survit au détachement d'un véhicule.

**Obtenu.** Conforme.
- `Sara Bennis` : Casablanca / Camion / `+212655555555` / `ZZ999999` enregistrés et intacts après rechargement.
- Rattachement puis détachement de `Hamid Ouali` : la colonne Véhicule reste à **« Fourgon (non rattaché) »** — avant correctif, le détachement effaçait le type et la colonne retombait à « — », sans aucun moyen de le ressaisir.

**Preuve.** [`TC-D19.webm`](./TC-D19.webm)
