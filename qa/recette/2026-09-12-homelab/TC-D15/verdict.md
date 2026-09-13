# TC-D15 — Un véhicule non actif n'est pas rattachable

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté*

**Attendu.** Un véhicule en maintenance n'est pas proposé au rattachement, et l'API refuse si on force.

**Obtenu.** Conforme. `1111-A-11` passé en **Maintenance** disparaît des options du dialogue « Rattacher un véhicule » ; l'appel direct `PATCH /v1/drivers/<id>/vehicle` → **400 « Véhicule non actif : rattachement impossible. »**. Le véhicule est réactivé en fin de cas pour la suite du run.

**Preuve.** [`TC-D15.webm`](./TC-D15.webm)
