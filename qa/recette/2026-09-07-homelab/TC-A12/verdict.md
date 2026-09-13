# TC-A12 — Cloisonnement du realm plateforme

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A12)
- Connecté en super-admin, tenter d'ouvrir `/dashboard` puis `/orders`.
- Accès refusé / redirection vers le login — un super-admin n'entre pas dans un tenant.

## Obtenu
- Session super-admin valide sur `/saas` — capture 01.
- `GET /dashboard` → **redirection vers `/login`** (carte de connexion, realm organisation) —
  capture 02.
- `GET /orders` → **redirection vers `/login`** également — capture 03.
- Retour sur `/saas` : la session super-admin est toujours valide (heading « Organisations »).

## Captures
- `01-session-super-admin-sur-saas.png`
- `02-dashboard-redirige-vers-login.png`
- `03-orders-redirige-vers-login.png`

## Anomalies
Aucune.
