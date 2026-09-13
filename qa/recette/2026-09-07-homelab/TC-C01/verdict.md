# TC-C01 — Renseigner l'identité légale

- **Attendu** : `/settings` → Raison sociale, ICE/RC, adresse → **Enregistrer** → bouton « Enregistré ✓ » ; valeurs persistantes après rechargement.
- **Obtenu** : conforme.
  - Formulaire rempli (Raison sociale `Rabat Express SARL`, ICE `002345678000012`, RC `RC456789`, adresse `45 Av. Mohammed V, 10000 Rabat`) — capture 01.
  - Après clic sur **Enregistrer** (carte Identité légale), le bouton passe à « Enregistré ✓ » — capture 02.
  - Après `page.reload()`, les 4 valeurs sont toujours affichées — capture 03 ; base `tenant_rabatexpress.company_settings` confirmée : `Rabat Express SARL | 002345678000012 | RC456789 | 45 Av. Mohammed V, 10000 Rabat`.
- **Captures** : `01-formulaire-rempli.png`, `02-enregistre.png`, `03-apres-rechargement.png`
- **Verdict** : OK
