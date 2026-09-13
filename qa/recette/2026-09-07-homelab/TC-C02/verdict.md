# TC-C02 — Commission & TVA

- **Attendu** : commission plateforme (ex. 15 %) et TVA (20 %) → **Enregistrer** → persistance ; taux repris en facturation marchand (TC-N03).
- **Obtenu** : conforme.
  - Défauts affichés : commission 15 %, TVA 20 %.
  - Commission passée à 18 % → « Enregistré ✓ » (capture 01) ; après rechargement, 18 % / 20 % toujours affichés (capture 02) et base `pricing_config` : `0.18 | 0.2`.
  - Restauration aux valeurs de référence 15 % / 20 % → « Enregistré ✓ », persisté après rechargement (capture 03), base : `0.15 | 0.2`.
- **Note de run** : valeurs finales laissées à 15 % / 20 % (référence recette, attendues par TC-M/TC-N).
- **Captures** : `01-commission-18-enregistre.png`, `02-apres-rechargement.png`, `03-restaure-15-20.png`
- **Verdict** : OK
