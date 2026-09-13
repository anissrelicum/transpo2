# TC-D01 — Ajouter un véhicule conforme

- **Attendu** : `/vehicles` → **Ajouter un véhicule** → `1111-A-11`, Fourgon, Rabat, assurance `2029-01-01`, CT `2029-01-01` → ligne créée, état ACTIF, aucune alerte de conformité.
- **Obtenu** : conforme.
  - Liste vide au départ (« Aucun véhicule. », capture 01).
  - Formulaire rempli (immatriculation valide, Fourgon, Rabat, Actif, échéances 01/01/2029) — capture 02.
  - Après **Ajouter** : ligne `1111-A-11 / Fourgon · Rabat`, badge **Actif**, échéances vertes `01/2029`, sous-titre « 1 véhicules · 1 actifs · 0 alerte(s) d'échéance », aucun bandeau d'alerte — capture 03.
- **Captures** : `01-liste-vide.png`, `02-formulaire-vehicule.png`, `03-vehicule-cree-actif.png`
- **Verdict** : OK
