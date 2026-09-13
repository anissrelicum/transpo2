# TC-B04 — Anti-bruteforce

- **Attendu** : 6 tentatives avec un mauvais mot de passe → les 5 premières « Identifiants invalides », la 6ᵉ → 429 « Trop de tentatives. Réessayez plus tard. »
- **Obtenu** : conforme. Email dédié jetable `brute-b04@rabatexpress.ma` (compteur keyé tenant+email, l'admin n'est pas touché) :
  - tentatives 1–5 → « Identifiants invalides. »
  - tentative 6 → « Trop de tentatives. Réessayez plus tard. » (429)
- **Captures** : `01-cinquieme-identifiants-invalides.png`, `02-sixieme-tentative-429.png`
- **Verdict** : OK
