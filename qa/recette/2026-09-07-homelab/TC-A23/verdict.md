# TC-A23 — Expiration de l'essai

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A23)
- Forcer `trial_ends_at = current_date - 1` sur l'essai d'atlasfret, puis **Lancer le cycle**.
- L'abonnement passe **Impayé**, le bandeau orange apparaît, et **l'accès du tenant reste ouvert**
  (connexion possible) — on relance avant de couper.

## Obtenu
- Forçage SQL puis cycle : « 1 essai(s) expiré(s) », « 1 statut(s) tenant réaligné(s) »
  (1ʳᵉ exécution ; la spec est idempotente et a revérifié l'état au run suivant).
- atlasfret : badge **Impayé**, détail « impayé depuis 2026-09-07 » ; bandeau orange
  **« 1 abonnement(s) impayé(s) — l'accès reste ouvert, la suspension est automatique à la fin
  du délai de grâce : atlasfret. »** — capture 01.
- Connexion tenant `/login?org=atlasfret` avec l'admin (`admin@atlasfret.ma`) : **réussie**,
  atterrissage `/dashboard` — capture 02. L'accès reste ouvert en Impayé, conforme.

## Captures
- `01-atlasfret-impaye-bandeau-orange.png`, `02-connexion-tenant-impaye-ouverte.png`

## Anomalies
Aucune.
