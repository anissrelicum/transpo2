# TC-F12 — Annulation

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026

**Attendu.** Statut **Annulée** ; l'action devient indisponible sur les commandes Livrée et Annulée.

**Obtenu.** Conforme. Après annulation, les trois actions de cycle de vie (**Annuler**, **Faire progresser**, **Assigner un livreur**) sont désactivées dans le menu, et une seconde annulation appelée en direct est refusée **400 « Annulation impossible. »**.

**Preuve.** [`TC-F12.webm`](./TC-F12.webm)
