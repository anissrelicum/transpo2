# TC-D18 — Renouvellement dans le passé

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — non-régression OBS-10*

**Attendu.** Une échéance ne se « renouvelle » pas dans le passé, ni côté chauffeur ni côté véhicule.

**Obtenu.** Conforme aux deux niveaux.
- UI : le champ porte `min` au jour même, un message explicite apparaît et **Enregistrer** reste désactivé.
- API : `POST /v1/drivers/<id>/renew` et `POST /v1/vehicles/<id>/renew` avec la date d'hier → **400 « La nouvelle échéance doit être postérieure à aujourd'hui. »**.
- Une date future reste acceptée : la règle borne sans gêner l'usage normal.

**Preuve.** [`TC-D18.webm`](./TC-D18.webm)
