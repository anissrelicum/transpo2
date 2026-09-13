# TC-B09 — Email invalide / doublon

- **Attendu** : inviter `pasunemail` → « Email invalide. » ; réinviter `dispatch@rabatexpress.ma` → « Cet email est déjà utilisé. ».
- **Obtenu** : conforme.
  - Email invalide : le formulaire bloque la soumission (bouton **Inviter** désactivé, capture 01) ; l'appel API direct renvoie `400 {"error":"Email invalide."}`.
  - Doublon : réinvitation de `dispatch@rabatexpress.ma` → alerte « Cet email est déjà utilisé. » (message capturé), le dialogue reste ouvert, aucun compte créé (toujours 3 utilisateurs).
- **Captures** : `01-email-invalide-bouton-desactive.png`, `02-doublon-alerte-dialogue-ouvert.png`
- **Verdict** : OK
