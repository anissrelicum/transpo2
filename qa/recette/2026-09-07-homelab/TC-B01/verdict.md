# TC-B01 — Un tenant provisionné n'a aucun compte

- **Attendu** : `/login?org=rabatexpress` avec un identifiant non amorcé → « Identifiants invalides ». AN-01 consignée.
- **Obtenu** : conforme. Testé avec `personne@rabatexpress.ma` (email inexistant, rabatexpress ayant déjà un admin depuis le provisioning — correctif AN-01) : « Identifiants invalides. » affiché en bandeau rouge, badge org `rabatexpress` correct.
- **AN-01 (rappel §3)** : aucune interface ne crée le premier compte d'un tenant ; l'admin est créé au provisioning avec mot de passe temporaire (correctif déjà en place), l'amorçage CLI reste le contournement documenté (§0.3).
- **Captures** : `01-identifiants-invalides.png`
- **Verdict** : OK
