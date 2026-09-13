# TC-C04 — Écriture réservée à l'admin

- **Attendu** : connecté en dispatcher, `/settings` en consultation possible, **Enregistrer** absent/refusé (403 côté API).
- **Obtenu** : conforme.
  - Topbar « Reda Ziani / Dispatcher » ; bandeau « Lecture seule — la modification des paramètres est réservée à l'administrateur. » ; valeurs consultables (Rabat Express SARL, 15 %/20 %) mais tous les champs désactivés et **aucun bouton Enregistrer** — capture 01.
  - Appel API direct `POST /v1/settings/company` avec la session dispatcher → **403** `{"error":"Rôle insuffisant pour cette action."}`.
  - Rechargement : valeurs inchangées — capture 02.
- **Captures** : `01-lecture-seule-dispatcher.png`, `02-valeurs-inchangees.png`
- **Verdict** : OK
