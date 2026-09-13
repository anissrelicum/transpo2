# TC-B05 — Paywall : organisation suspendue

- **Attendu** : suspendre rabatexpress (motif) → connexion bloquée « Espace suspendu — contactez la plateforme. », motif affiché sous le statut d'abonnement ; réactivation → connexion rétablie.
- **Obtenu** : conforme.
  - Suspension super-admin avec motif « Recette B05 — suspension de test » : badge **Suspendu** + motif affiché sous le statut (capture 02), bandeau rouge « organisation(s) sans accès » listant rabatexpress.
  - Connexion `admin@rabatexpress.ma` → « Espace suspendu — contactez la plateforme. » (capture 03).
  - **Réactiver** → badge **Actif**, échéance 2026-10-01, motif effacé (capture 04) ; connexion rétablie sur `/dashboard` (capture 05).
- **État laissé** : rabatexpress ACTIF (matrice TC-A28 restaurée).
- **Captures** : `01-dialogue-suspendre-motif.png` … `05-connexion-retablie.png` (02 et 04 reprises après scroll pour cadrer la ligne rabatexpress)
- **Verdict** : OK
