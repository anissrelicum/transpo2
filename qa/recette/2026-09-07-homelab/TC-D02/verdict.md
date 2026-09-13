# TC-D02 — Ajouter un véhicule non conforme

- **Attendu** : ajouter `2222-B-22`, Moto, Rabat, **assurance échue** → signal d'alerte assurance ; remontée dans les alertes du `/dashboard`.
- **Obtenu** : conforme.
  - Formulaire : Moto, Rabat, assurance 01/01/2026 (passée), CT 01/01/2029 — capture 01.
  - Ligne créée avec assurance « Expirée (251 j) » en rouge, badge d'état Actif ; bandeau rouge « 1 véhicule(s) avec assurance ou contrôle technique expiré — non affectables… », sous-titre « 2 véhicules · 2 actifs · 1 alerte(s) » — capture 02.
  - `/dashboard` bloc **Conformité flotte** : « Moto 2222-B-22 — assurance expirée depuis 251 j » en rouge — capture 03.
- **Captures** : `01-formulaire-assurance-echue.png`, `02-vehicule-non-conforme-liste.png`, `03-alerte-dashboard.png`
- **Verdict** : OK
