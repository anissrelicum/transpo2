# TC-F03 — Assignation depuis le dispatch (score)

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026

**Attendu.** Chauffeurs classés par score /100 avec le détail **Zone /40 + Dispo /30 + Charge /30**, badge **Recommandé** sur le premier, exclusion des chauffeurs indisponibles ou non conformes ; **Choisir** fait passer la commande en **Assignée**.

**Obtenu.** Conforme. Le barème est rappelé en tête du dialogue et chaque composante est chiffrée sur sa barre. `Sara Bennis`, laissée **indisponible** par TC-D10, n'est pas proposée ; `Hamid Ouali` l'est, porte le badge **Recommandé**, et le choix bascule la commande en `ASSIGNEE` avec son nom.

L'exclusion vient bien de la règle métier et non d'un hasard d'affichage : le cas vérifie l'état de l'effectif en base avant d'ouvrir le dialogue.

**Preuve.** [`TC-F03.webm`](./TC-F03.webm)
