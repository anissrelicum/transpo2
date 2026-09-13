# TC-A01 — Connexion super-admin

**Verdict : OK** — 07/09/2026

## Attendu (plan §2, TC-A01)
- `/login?realm=saas` affiche le badge **Plateforme**.
- Connexion `ops@transpo.ma` / `transpo` → redirection vers `/saas`.
- Liste d'organisations **vide** (base remise à zéro).

## Obtenu
- Page de login affichée avec le badge `plateforme` (`data-testid="detected-org"`) — capture 01.
- Connexion réussie, redirection vers `/saas`, heading « Organisations » visible.
- Liste vide : « Aucune organisation. », compteurs « 0 tenants · 0 actifs · 0 en essai » — capture 02.

## Captures
- `01-login-realm-saas-badge-plateforme.png` — page login, badge Plateforme.
- `02-saas-liste-organisations-vide.png` — /saas, liste vide.

## Anomalies
Aucune pour ce cas. (Observation : le champ email est pré-rempli `admin@casaexpress.ma` malgré le badge plateforme — traité en TC-A02.)
