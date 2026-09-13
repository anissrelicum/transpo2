# TC-F08 — Filtres et recherche

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026

**Attendu.** Chaque filtre réduit réellement la liste, les filtres se combinent, **Réinitialiser** restaure.

**Obtenu.** Conforme. 9 commandes au départ, 3 après **Statut = Nouvelle** ; la combinaison avec **Ville = Salé** ne laisse rien — et le produit l'**annonce** (« Aucune commande ne correspond à ces filtres. ») au lieu d'afficher un tableau vide. **Réinitialiser** ramène les 9, et la recherche sur une référence exacte isole une ligne.

**Preuve.** [`TC-F08.webm`](./TC-F08.webm)
