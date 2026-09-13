# TC-A24 — Suspension après le délai de grâce

**Verdict : OK** — 07/09/2026

## Attendu (plan §2 A-ter, TC-A24)
- Forcer `past_due_since = current_date - 8`, puis **Lancer le cycle** : abonnement **Suspendu**,
  `tenants.status` suit, connexion au tenant refusée.
- Sept jours pleins doivent s'être écoulés : à `- 6`, rien ne se passe.

## Obtenu
- **À -6 jours** : cycle neutre (« 0 suspension(s) »), atlasfret reste **Impayé**, connexion
  tenant toujours possible — captures 01–02.
- **À -8 jours** : cycle → « 1 suspension(s) », « 1 statut(s) tenant réaligné(s) » ;
  `subscriptions.status` = SUSPENDU et `tenants.status` = SUSPENDU (vérifié en base) ;
  badge **Suspendu** + motif « Essai expiré sans souscription — suspendu après délai de grâce » ;
  bandeau rouge **« 1 organisation(s) sans accès — le paywall bloque la connexion de tous leurs
  utilisateurs, administrateurs compris : atlasfret. »** — capture 03.
- Connexion `/login?org=atlasfret` : **refusée**, message
  **« Espace suspendu — contactez la plateforme. »** — capture 04.

## Captures
- `01-moins-6-jours-toujours-impaye.png`, `02-connexion-ok-a-moins-6.png`
- `03-moins-8-jours-suspendu.png`, `04-connexion-refusee-suspendu.png`

## Anomalies
Aucune.
