# TC-B11 — Réinitialisation de mot de passe

- **Attendu** : en admin, `/users` → menu du dispatcher → **Réinitialiser le mot de passe** → nouveau mot de passe temporaire affiché ; l'ancien ne fonctionne plus, le nouveau fonctionne.
- **Obtenu** : conforme sur le cœur du cas.
  - Nouveau mot de passe temporaire affiché pour Reda Ziani (dialogue « ne sera plus affiché »), différent de l'ancien, consigné dans COMPTES.md (dernière ligne TC-B11).
  - Ancien mot de passe → « Identifiants invalides. » (capture 02).
  - Nouveau mot de passe → connexion OK, `/dashboard`, topbar « Reda Ziani / Dispatcher » (capture 03).
- **Anomalie BUG-B1 (mineure, hors critère du cas)** : le bouton **Copier** du dialogue est inopérant en contexte HTTP (homelab) — `navigator.clipboard` indisponible hors contexte sécurisé ; le clic lève `TypeError: Cannot read properties of undefined (reading 'writeText')` (`UsersView.tsx:232`, appel sans `?.` ni repli, contrairement à `OrderDetailClient.tsx:80`), l'icône ne bascule pas en ✓ et rien n'est copié (capture 01b). Non bloquant en prod HTTPS, mais échec silencieux sans feedback.
- **Captures** : `01-nouveau-mot-de-passe-temporaire.png`, `01b-bouton-copier-apres-clic.png`, `02-ancien-mdp-refuse.png`, `03-nouveau-mdp-accepte.png`
- **Verdict** : OK

## Retest 08/09 — BUG-B1 (correctif déployé)

- **Attendu** : en HTTP, clic **Copier** → repli `execCommand('copy')` (copie effective) **ou** alerte explicite ; jamais d'échec silencieux.
- **Obtenu** : conforme.
  - `navigator.clipboard.writeText` toujours indisponible en HTTP (confirmé) ; le clic déclenche le repli : `execCommand('copy')` appelé, retour `true`, valeur copiée = mot de passe affiché (`8s9xU2jf0R7g`, tracé par espion sur `document.execCommand`).
  - Feedback UI ✓ visible après clic (capture `retest-02`), aucune erreur console/page (`pageErrors=[]`).
  - Composant : `UsersView.tsx` → `copyText()` (`lib/clipboard.ts`, repli textarea + execCommand, alerte « Copie impossible… » si échec).
  - Nouveau mdp dispatcher consigné dans COMPTES.md (ligne « TC-B11 retest »).
- **Captures** : `retest-01-dialogue-mdp-temporaire.png`, `retest-02-apres-clic-copier.png`
- **Verdict retest** : **BUG-B1 CORRIGÉ**
