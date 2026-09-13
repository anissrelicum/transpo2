# TC-E04 — Retirer un livreur / supprimer une zone

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026

**Attendu.** Retrait d'un livreur et suppression d'une zone jetable, effectifs après rechargement.

**Obtenu.** Conforme. La croix du badge retire `Sara Bennis` (confirmé en base), et la zone jetable disparaît après confirmation.

**Constat de cohérence.** La suppression passait par un `confirm()` **natif du navigateur**, alors que tout le reste de la console (retrait d'un véhicule, d'un chauffeur, d'un utilisateur) confirme par un dialogue applicatif. Une boîte native n'est ni traduisible, ni thématisable, ni lisible en arabe RTL — trois choses que le produit exige partout ailleurs. Remplacée par un `AlertDialog` annonçant ce qui sera perdu.

**Preuve.** [`TC-E04.webm`](./TC-E04.webm)
