# TC-F07 — Actions de masse

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026

**Attendu.** Cocher 3 commandes → **Assigner** ; cocher 2 → **Faire avancer** ; la sélection se vide ensuite.

**Obtenu.** Conforme : 3 commandes assignées à `Hamid Ouali`, puis 2 avancées en `RETRAIT`, sélection vidée à chaque fois.

**Constat corrigé au passage.** **Assigner** affectait en silence au **premier chauffeur de la liste** : l'exploitant ne choisissait rien et ne découvrait qu'après coup qui avait hérité des courses. L'action ouvre maintenant la liste des livreurs et demande à qui affecter.

**Preuve.** [`TC-F07.webm`](./TC-F07.webm)
