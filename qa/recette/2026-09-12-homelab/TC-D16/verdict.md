# TC-D16 — Véhicule déjà rattaché à un autre chauffeur

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté*

**Attendu.** Le partage n'est pas interdit, mais il ne doit pas se découvrir après coup.

**Obtenu.** Le sélecteur affiche `1111-A-11 — Fourgon (Rabat) · déjà sur Hamid Ouali`, et le choix déclenche un avertissement **avant** validation : « Ce véhicule est déjà rattaché à Hamid Ouali. Les deux chauffeurs le porteront sur leur fiche tant que l'un des deux n'est pas détaché. » Annuler ne modifie rien.

*Note de cadrage.* Le domaine Transpo ne tranche pas la cardinalité chauffeur ↔ véhicule : la recette n'a donc pas imposé de règle, elle a exigé que le produit **dise** ce qu'il fait.

**Preuve.** [`TC-D16.webm`](./TC-D16.webm)
