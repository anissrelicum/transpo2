# TC-D04 — Renouveler un document

- **Attendu** : menu du véhicule 2 → renouveler l'assurance (date future) → **Enregistrer** → l'alerte disparaît de la liste et du tableau de bord.
- **Obtenu** : conforme.
  - Dialogue « Renouveler l'assurance — 2222-B-22, nouvelle date d'échéance » → 01/06/2029 → Enregistrer (capture 01).
  - Liste : assurance repassée verte « 06/2029 », sous-titre « 0 alerte(s) d'échéance », bandeau rouge disparu (capture 02).
  - `/dashboard` : bloc Conformité flotte « Aucune échéance en alerte. » (capture 03).
- **Captures** : `01-dialogue-renouvellement.png`, `02-alerte-disparue-liste.png`, `03-dashboard-sans-alerte.png`
- **Verdict** : OK
