# TC-C03 — Régional

- **Attendu** : devise, fuseau horaire, langue par défaut → **Enregistrer** → persistance.
- **Obtenu** : conforme.
  - Défauts : MAD / Africa-Casablanca / Français (capture 01) — devise et fuseau mono-option, non modifiables par construction.
  - Langue par défaut basculée à العربية → « Enregistré ✓ » (capture 02) ; après rechargement, العربية toujours sélectionnée (capture 03), base : `MAD | Africa/Casablanca | ar`.
  - Restauration Français → « Enregistré ✓ », persistée (capture 04), base : `fr`.
- **Note de run** : la langue d'affichage de la console dépend du cookie `lang` (pas de ce réglage) — l'UI est restée en français pendant le test. 1ᵉʳ essai interrompu par une erreur de sélecteur dans la spec (`.nth(1)` sur un bouton « Enregistré ✓ » unique) ; spec corrigée, état remis à `fr`, relance complète OK.
- **Captures** : `01-regional-defauts.png`, `02-langue-ar-enregistree.png`, `03-ar-apres-rechargement.png`, `04-fr-restaure.png`
- **Verdict** : OK
