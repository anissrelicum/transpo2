# TC-B01 — Un tenant provisionné n'a pas de compte arbitraire

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** « Identifiants invalides » sur un email non amorcé

**Obtenu.** Message conforme. Note : depuis le correctif AN-01, le provisioning crée bien un admin avec mot de passe temporaire — le trou d'amorçage ne concerne plus que les comptes MERCHANT et DRIVER (AN-02)

**Preuve.** [`TC-B01.webm`](./TC-B01.webm)
