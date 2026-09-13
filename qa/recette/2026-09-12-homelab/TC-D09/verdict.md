# TC-D09 — Régulariser un chauffeur

**Verdict : OK (avec constat)**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Renouveler la visite médicale de `Sara Bennis` avec une date future → elle redevient **affectable**.

**Obtenu.** Conforme sur le fond : `POST .../renew` → **200**, et après rechargement Sara n'a plus ni « Expiré » ni badge **Bloqué**, le bandeau « exclus des suggestions de dispatch » disparaît et l'effectif repasse à « 2 chauffeurs · 2 disponibles · 0 non affectable(s) ». Le dialogue de renouvellement laisse lui aussi l'interface gelée (`pointerEvents=none`, `ariaHiddenRacine=true`) — **AN-13**, troisième dialogue touché.

**Preuve.** [`TC-D09.webm`](./TC-D09.webm)
