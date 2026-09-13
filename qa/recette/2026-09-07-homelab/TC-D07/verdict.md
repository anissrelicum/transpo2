# TC-D07 — Téléphone invalide

- **Attendu** : créer un chauffeur avec le téléphone `abc` → refus « Téléphone invalide. ».
- **Obtenu** : conforme.
  - UI : champ Téléphone en rouge avec « Numéro invalide. », bouton **Ajouter** désactivé — la soumission est impossible (capture 01).
  - API directe `POST /v1/drivers {phone: "abc"}` → **400** `{"error":"Téléphone invalide."}` (message exact de l'attendu).
  - Aucun chauffeur créé : toujours 2 chauffeurs après rechargement (capture 02).
- **Captures** : `01-telephone-invalide-ui.png`, `02-rien-de-cree.png`
- **Verdict** : OK
