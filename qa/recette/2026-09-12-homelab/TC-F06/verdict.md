# TC-F06 — Transition invalide refusée

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026  ·  *Passé après correctif AN-21*

**Attendu.** Seul le pas suivant du cycle nominal est autorisé.

**Obtenu.** Conforme, et le trou principal est fermé.
- Une commande **Nouvelle** avance d'un pas (**200**) : la règle borne sans bloquer l'usage normal.
- Une commande **En route (livraison)** → **400 « La livraison se clôture par la preuve, depuis l'app livreur. »**
- Aucune commande n'est passée `LIVREE` sans preuve.

**Ce que le cas a révélé au premier passage.** La console **désactivait** l'action à ce stade, mais l'API l'acceptait : `POST /v1/orders/<ref>/advance` faisait passer `LIVRAISON → LIVREE` **sans photo ni signature**. Un dispatcher pouvait donc déclarer livrée une course sans rien à opposer à une contestation, et marquer un COD encaissé sans preuve. L'app livreur, elle, refusait déjà (`Progression impossible (livraison via preuve)`) : la règle existait, la porte de service était restée ouverte. **→ AN-21, corrigée.**

**Preuve.** [`TC-F06.webm`](./TC-F06.webm)
