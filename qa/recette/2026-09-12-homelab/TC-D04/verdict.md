# TC-D04 — Renouveler un document

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Renouveler l'assurance de `2222-B-22` avec une date future → l'alerte disparaît de la liste et du tableau de bord.

**Obtenu.** Conforme. Après renouvellement, `/vehicles` affiche 0 alerte d'échéance et le bloc Conformité du `/dashboard` repasse à « Aucune échéance en alerte. ».

**Preuve.** [`TC-D04.webm`](./TC-D04.webm)
