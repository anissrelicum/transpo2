# TC-D21 — Aucune action de la flotte ne fige la console

**Verdict : OK**  ·  Environnement : homelab K8s  ·  Date : 12/09/2026  ·  *Cas ajouté — non-régression AN-13*

**Attendu.** Après chaque enregistrement lancé depuis un menu « … », la page reste cliquable et la donnée est à jour.

**Obtenu.** Conforme sur cinq actions enchaînées **sans aucun rechargement** — rattacher un véhicule, renouveler une échéance, modifier une fiche, mettre en maintenance, réactiver :
```
pointerEvents=auto  ·  scrollLocked=false  ·  ariaHiddenRacine=false   (les 5 fois)
```
L'interactivité est prouvée pour de vrai en fin de cas : ouverture du menu d'une autre ligne, puis du menu avatar.

**Ce que le cas garde en mémoire.** Le défaut ne se voyait pas : la donnée s'affichait correctement, et seule une tentative d'action ultérieure révélait la console morte. C'est l'état du document qu'on mesure ici, pas l'affichage.

**Preuve.** [`TC-D21.webm`](./TC-D21.webm)
