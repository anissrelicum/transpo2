# TC-E06 — Nom vide et livreur inexistant

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — clôt AN-19 et AN-20*

**Attendu.** Une zone ne peut pas devenir anonyme, ni porter un livreur absent de l'effectif.

**Obtenu.** Les deux refus sont en place.
- Nom vidé puis enregistré → **400 « Nom de zone requis. »** ; la zone garde son nom.
- `PATCH … { drivers: ['Fantôme Inexistant'] }` → **400 « Livreur inconnu : Fantôme Inexistant. »** ; la base ne contient que `Hamid Ouali`.

**Ce que le cas a révélé au premier passage.** Les deux écritures étaient **acceptées en 200**. Une zone sans nom devenait introuvable dans la console ; et comme le dispatch affecte les courses **par nom de chauffeur**, un livreur fantôme aurait été porté par la zone sans que personne ne puisse jamais le joindre.

**Preuve.** [`TC-E06.webm`](./TC-E06.webm)
