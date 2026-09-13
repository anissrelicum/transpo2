# TC-B02 — Amorçage de l'admin (contournement documenté)

- **Attendu** : commande `account` de §0.3 pour `admin@rabatexpress.ma`, puis connexion avec `Test1234` → `/dashboard`.
- **Obtenu** : conforme.
  - CLI : `kubectl exec -n transpo deploy/transpo-api -- sh -c 'cd /repo && pnpm --filter @transpo/db account rabatexpress admin@rabatexpress.ma "Nadia Alaoui" ADMIN Test1234'` → « Compte OK — admin@rabatexpress.ma (ADMIN) sur le tenant rabatexpress. » (upsert : remplace le mot de passe temporaire du provisioning).
  - UI : connexion `/login?org=rabatexpress` → `/dashboard`, barre supérieure « Nadia Alaoui / Administrateur ».
- **Effet de bord consigné** : `COMPTES.md` mis à jour — le mot de passe admin rabatexpress est désormais `Test1234` (jeu de données §0.4).
- **Captures** : `01-dashboard-apres-amorcage.png`
- **Verdict** : OK
