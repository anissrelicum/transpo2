# TC-E03 — Affecter un livreur à la zone

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Passé après correctif AN-18*

**Attendu.** Ajouter `Hamid Ouali` : le livreur apparaît sur la zone ; quand tous sont affectés, « Tous les livreurs sont affectés. » s'affiche.

**Obtenu.** Conforme. L'affectation est immédiate (PATCH sans passer par **Enregistrer**), persiste au rechargement et se retrouve en base. Une fois `Sara Bennis` ajoutée, le message d'effectif complet s'affiche.

**Ce que le cas a révélé au premier passage.** Le message était **inatteignable** : le bouton **Ajouter** se désactivait précisément quand plus aucun livreur n'était disponible — c'est-à-dire au seul moment où le message avait un sens. L'exploitant se retrouvait devant un bouton gris sans explication. **→ AN-18, corrigée.**

**Preuve.** [`TC-E03.webm`](./TC-E03.webm)
