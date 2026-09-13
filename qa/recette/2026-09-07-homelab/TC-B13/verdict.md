# TC-B13 — Désactivation / réactivation

- **Attendu** : **Désactiver** le dispatcher (confirmation) → connexion refusée → **Réactiver** → connexion rétablie.
- **Obtenu** : conforme.
  - Confirmation « Désactiver Reda Ziani ? » avec avertissement explicite (capture 01) ; après validation, badge « Désactivé » et compteurs 2 actifs / 1 inactif (capture 02, base : `active=f`).
  - Connexion du compte désactivé → refusée (« Identifiants invalides. », capture 03 — message générique, pas de distinction désactivé/mauvais mot de passe).
  - **Réactiver** → badge « Actif », 3 actifs / 0 inactif (capture 04, base : `active=t`) ; connexion dispatcher rétablie → `/dashboard`, topbar « Reda Ziani / Dispatcher » (capture 05).
- **Note de run** : `b13.spec.ts` non idempotent ; chaîne complétée par `b13-suite.spec.ts` depuis l'état réel.
- **Captures** : `01-confirmation-desactivation.png`, `02-dispatcher-desactive.png`, `03-connexion-refusee-inactif.png`, `04-dispatcher-reactive.png`, `05-connexion-retablie.png`
- **Verdict** : OK
