# TC-F11 — Fiche commande

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 13/09/2026  ·  *Passé après correctifs AN-24 et AN-25*

**Attendu.** Onglets **Détails**, **Preuve**, **Historique**, **Facturation** fonctionnels ; historique **horodaté** cohérent avec les transitions faites ; code copié (icône ✓).

**Obtenu.** Conforme. Cinq faits pour une commande créée puis affectée et avancée trois fois :
```
Statut → Nouvelle · Commande créée        13/09/2026 · 07:55 · admin@rabatexpress.ma
Statut → Assignée · Affectée à Hamid Ouali 13/09/2026 · 07:55 · admin@rabatexpress.ma
Statut → En route (retrait)                13/09/2026 · 07:55 · admin@rabatexpress.ma
Statut → Récupérée                         13/09/2026 · 07:55 · admin@rabatexpress.ma
Statut → En route (livraison)              13/09/2026 · 07:55 · admin@rabatexpress.ma
```

**Ce que le cas a révélé au premier passage.**
- L'onglet **Historique** n'était pas un historique : il **déduisait** le parcours du statut courant en déroulant le chemin nominal. Aucune date, aucun acteur — et un parcours **inventé** pour toute commande sortie du nominal : une commande annulée affichait les étapes par lesquelles elle n'était jamais passée. Un litige COD se tranche sur des faits horodatés, pas sur une reconstitution. **→ AN-25, corrigée** (table `order_events`, écrite par l'exploitation **et** par le terrain).
- Le bouton **copier** appelait `navigator.clipboard?.writeText(...)` : hors contexte sécurisé l'appel ne faisait rien, **mais la coche verte s'affichait quand même**. Le cas capte l'évènement `copy` du document pour vérifier qu'une copie a réellement eu lieu. **→ AN-24, corrigée** (repli `copyText`, retour rouge si la copie échoue).

**Preuve.** [`TC-F11.webm`](./TC-F11.webm)
