# TC-B12 — Changement de rôle

- **Attendu** : menu du comptable → **Changer de rôle** → Dispatcher → Enregistrer ; rôle mis à jour ; reconnexion → l'accès correspond au nouveau rôle ; remettre **Comptable**.
- **Obtenu** : conforme.
  - Comptable → Dispatcher : badge « Dispatcher » sur la ligne de Salma Bennis (capture 01, vérifié aussi en base : `role=DISPATCHER`).
  - Reconnexion `compta@rabatexpress.ma` → topbar « Salma Bennis / Dispatcher », accès en écriture aux commandes (« Nouvelle commande » présent — capture 02), conforme au rôle Dispatcher.
  - Retour au rôle Comptable via le même dialogue → badge « Comptable » rétabli (capture 03, base : `role=COMPTABLE`).
- **Note de run** : le spec `b12.spec.ts` n'est pas idempotent (il suppose compta au départ) — exécutions partielles interrompues ; la chaîne complète a été rejouée via `b12-suite.spec.ts` + `b12-fin.spec.ts` depuis l'état réel, toutes les étapes de l'attendu sont couvertes par les captures.
- **Captures** : `01-role-dispatcher-dans-la-liste.png`, `02-acces-dispatcher-apres-reconnexion.png`, `03-role-comptable-retabli.png`
- **Verdict** : OK
