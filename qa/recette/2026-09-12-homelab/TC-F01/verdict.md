# TC-F01 — Créer la première commande (assistant)

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026  ·  *Passé après correctifs AN-22 et AN-23*

**Attendu.** Assistant en trois étapes → référence `CMD-…`, code de suivi 8 caractères, statut **Nouvelle**, et la commande créée atteignable depuis l'écran d'arrivée.

**Obtenu.** Conforme. `CMD-20260913-… | 8 caractères | NOUVELLE | Rabat | Casablanca | 450 | photo | Boutique Test`, et les coordonnées des deux points sont conservées (`Atelier Rabat`, `Yasmine Cherkaoui`, `45 bd Anfa`).

**Ce que le cas a révélé au premier passage.** Les **deux premières étapes de l'assistant partaient à la poubelle** : contact, téléphone, adresse et notes des points de retrait et de livraison — tous marqués « requis » — n'étaient liés à aucun état, jamais transmis, et sans colonne pour les accueillir. Une société de livraison créait donc des courses **sans adresse de livraison**. Même sort pour la description du colis et le type de véhicule. **→ AN-22, corrigée** (migration `0025`, champs pilotés, API, fiche commande).

**Second constat.** L'assistant renvoyait vers la **liste** des commandes : à l'exploitant de deviner laquelle était la sienne. Il atterrit désormais sur la fiche de la commande créée.

**Preuve.** [`TC-F01.webm`](./TC-F01.webm)
