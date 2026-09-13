# TC-B07 — Invitation d'un dispatcher

- **Attendu** : `/users` → Inviter → Reda Ziani / dispatch@rabatexpress.ma / Dispatcher → dialogue **Mot de passe temporaire** affiché une seule fois, bouton **Copier** fonctionnel.
- **Obtenu** : conforme.
  - Dialogue « Mot de passe temporaire » affiché après invitation, avec l'avertissement « Ce mot de passe ne sera plus affiché », le mot de passe `X3zv45hwK1Tc` et les boutons Copier/Fermer (capture 01).
  - Compte créé et listé : Reda Ziani, rôle Dispatcher, statut Actif (capture 02 + vérification SQL `tenant_rabatexpress.users`).
  - Après fermeture, le mot de passe n'apparaît plus nulle part dans la page (affichage unique vérifié).
  - Bouton **Copier** : présent (capture 01) mais **inopérant en contexte HTTP** (homelab) — vérifié en TC-B11 sur le même composant : `navigator.clipboard` indisponible hors HTTPS, clic → TypeError silencieux, aucune copie, pas de feedback ✓. Consigné **BUG-B1** (mineur ; OK en prod HTTPS). Voir TC-B11/verdict.md et capture `TC-B11/01b-bouton-copier-apres-clic.png`. **Retest 08/09 : CORRIGÉ** (repli execCommand + feedback ✓, voir TC-B11/verdict.md § Retest 08/09).
- **Note de run** : une première exécution interrompue avait laissé 2 mots de passe obsolètes dans COMPTES.md ; le mot de passe courant est la dernière ligne TC-B07 (`X3zv45hwK1Tc`).
- **Captures** : `01-dialogue-mot-de-passe-temporaire.png`, `02-dispatcher-liste.png`
- **Verdict** : OK
