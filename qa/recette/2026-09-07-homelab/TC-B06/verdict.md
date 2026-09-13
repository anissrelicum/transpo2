# TC-B06 — Déconnexion

- **Attendu** : menu avatar → Se déconnecter → retour `/login`, et accès direct à `/orders` renvoyé au login (cookies purgés).
- **Obtenu** : conforme. Déconnexion depuis le menu avatar (Nadia Alaoui) → page `/login` ; `goto /orders` → redirection `/login`.
- **Captures** : `01-connecte-dashboard.png`, `02-retour-login.png`, `03-orders-renvoie-au-login.png`
- **Verdict** : OK
