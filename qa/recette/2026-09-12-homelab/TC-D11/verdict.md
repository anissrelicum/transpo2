# TC-D11 — Retirer un chauffeur

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026  ·  *Règle métier modifiée puis vérifiée*

**Attendu (règle révisée).** Sans course en cours, retrait direct. **Avec** des courses en cours, le retrait reste possible **à condition de désigner un repreneur** : les courses **en cours** passent à son nom, les courses **clôturées** restent au nom du partant.

**Obtenu.** Conforme sur les trois volets.
- `Karim Jetable`, sans course : retiré directement (`DELETE` → 200), effectif revenu à son niveau.
- `Younes Partant`, **2 courses en cours + 1 livrée** : le dialogue annonce « 2 commande(s) sont en cours sur ce chauffeur », le bouton **Transférer et retirer** reste **désactivé** tant qu'aucun repreneur n'est choisi. Après désignation de `Hamid Ouali` : les **2 courses en cours** passent à son nom, et la course **livrée reste au nom de Younes Partant**.
- Sans repreneur, l'API refuse : **400 « Impossible : 1 commande(s) en cours sur ce chauffeur. Transférez-les à un autre chauffeur. »**

**Pourquoi l'historique ne suit pas le transfert.** Réécrire l'attribution d'une course déjà livrée fausserait à la fois la performance du repreneur et la valeur de la preuve : le journal doit dire qui a livré, pas qui a hérité du planning.

**Bug d'infrastructure trouvé au passage.** Le premier essai échouait sans message : le proxy BFF encodait la totalité du dernier segment d'URL, transformant `?transferTo=…` en `%3FtransferTo=…`. **Toute** chaîne de requête passant par le proxy disparaissait donc en silence. Corrigé — le proxy transmet désormais `req.nextUrl.search`.

**Preuve.** [`TC-D11.webm`](./TC-D11.webm)
