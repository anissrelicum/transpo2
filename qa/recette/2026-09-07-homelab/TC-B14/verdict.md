# TC-B14 — Protection du dernier admin

- **Attendu** : tenter de **Désactiver** l'unique compte ADMIN, puis de lui **Changer de rôle** → refus explicite (il doit rester au moins un administrateur actif).
- **Obtenu** : conforme.
  - Désactivation de Nadia Alaoui (seul administrateur) → refusée : alerte « Impossible : dernier administrateur du tenant. » ; la ligne reste « Actif » (capture 01).
  - Changement de rôle vers Comptable → refusé : même alerte « Impossible : dernier administrateur du tenant. » ; le rôle reste « Administrateur » (capture 02).
- **Note** : après un refus, le menu « … » reste ouvert au-dessus du tableau (comportement Radix, `onSelect preventDefault`) — simple particularité UI, sans impact.
- **Captures** : `01-desactivation-refusee-toujours-actif.png`, `02-changement-role-refuse-toujours-admin.png`
- **Verdict** : OK
