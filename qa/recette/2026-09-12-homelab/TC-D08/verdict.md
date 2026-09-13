# TC-D08 — Rattacher un véhicule

**Verdict : OK (avec constat)**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Menu de `Hamid Ouali` → **Rattacher un véhicule** → `1111-A-11` → **Enregistrer** : la plaque apparaît sur la fiche chauffeur.

**Obtenu.** `PATCH /v1/drivers/<id>/vehicle` → **200**, la plaque apparaît bien et le type se synchronise sur **Fourgon**. Mais la mesure prise 3 s après l'enregistrement donne :
```
pointerEvents=none  scrollLocked=true  ariaHiddenRacine=true  plaqueAffichee=true
```
La console est **entièrement gelée** — l'administrateur voit son rattachement mais ne peut plus rien cliquer avant un F5. Même cause que sur `/users` : **AN-13** touche aussi `/drivers` (`DriversView.tsx:231`).

**Preuve.** [`TC-D08.webm`](./TC-D08.webm)
