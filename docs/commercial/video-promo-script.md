# Portrail — Vidéo promotionnelle : script et découpage

*Version 1 — 18 octobre 2026. À valider avant tournage.*

**Objectif** : donner envie, pas tout montrer. Le prospect (patron d'une société de livraison, 5 à 50 livreurs)
doit se reconnaître dans les 5 premières secondes, voir son métier « tourner tout seul », et retenir
**trois idées** : *je vois toute ma flotte*, *les courses partent seules*, *chaque dirham est suivi*.

**Format** : 60 secondes, 16:9 (site, e-mail, LinkedIn) **et** une déclinaison 9:16 de 30 s (WhatsApp Statut,
Instagram, TikTok). Voix off française, sous-titres incrustés (beaucoup regardent sans le son). Version
arabe (darija ou arabe standard) en second temps.

**Matière** : **uniquement les vrais écrans** de Portrail, filmés sur l'environnement de démonstration
(société de test, 10 livreurs simulés qui roulent dans Casablanca, 20 commandes). Pas d'images de stock
de livreurs : l'application est la star. Logo et couleurs de la marque validés (marine #0B1537, ambre #F5A524).

---

## Le découpage (60 s)

| # | Temps | À l'écran | Voix off | Texte incrusté |
|---|---|---|---|---|
| 1 | 0–6 s | Un téléphone qui vibre de messages WhatsApp (« il est où mon colis ? », « le livreur ne répond pas », « tu me dois combien ? ») + un tableau Excel qui défile | « Vos livreurs sont dehors. Vos marchands attendent leur argent. Et vous, vous êtes au téléphone. » | **Ça vous parle ?** |
| 2 | 6–14 s | **PC flotte** en direct : les 10 livreurs bougent sur la carte de Casablanca, l'un passe en rouge « hors zone » | « Avec Portrail, toute votre flotte est là. En direct. Qui roule, qui est arrêté, qui sort de sa zone. » | **Toute votre flotte, en direct** |
| 3 | 14–22 s | Clic sur un livreur : sa fiche, ses commandes, son itinéraire tracé par les rues, ses indicateurs | « Un clic, et vous voyez ses commandes, son trajet, son retard éventuel. » | |
| 4 | 22–32 s | Une commande arrive (portail marchand) → **proposition sur le téléphone du livreur** avec compte à rebours → « Accepter » → la commande apparaît sur sa carte | « Les nouvelles courses partent toutes seules au livreur le plus proche. Il accepte en un geste. S'il ne répond pas, la course passe au suivant. Sans personne au dispatch. » | **Dispatch automatique** |
| 5 | 32–40 s | App livreur : la **journée sur une carte**, arrêts numérotés, retraits groupés, « Naviguer » ; une commande urgente « Avant 12:00 » remonte en tête | « Le livreur a sa journée sur une carte, dans le bon ordre. Les urgences passent devant. » | **Délais tenus** |
| 6 | 40–50 s | Remise : photo de preuve → encaissement **420 DH** → **Caisse** du livreur → côté bureau : reversement au marchand, facture générée | « Livré, prouvé, encaissé. Chaque dirham est suivi, du livreur jusqu'au marchand. Vos reversements et vos factures se préparent tout seuls. » | **Chaque dirham suivi** |
| 7 | 50–56 s | Montage rapide : français ↔ arabe, clair ↔ sombre, téléphone + ordinateur | « En français et en arabe. Sur ordinateur et sur téléphone. Prêt en un jour. » | **À partir de 299 DH / mois** *(si prix validés)* |
| 8 | 56–60 s | Logo Portrail sur fond marine, adresse du site, bouton « Essai gratuit » | « Portrail. Votre livraison, sur les rails. » | **portrail.app — Essai gratuit 30 jours** |

## La version courte 9:16 (30 s)

Scènes 1 (3 s) → 2 (6 s) → 4 (8 s) → 6 (8 s) → 8 (5 s). Le téléphone en plein cadre, la carte flotte
recadrée verticalement.

## Ce qu'on ne dit PAS dans la vidéo

- Pas de « IA » tant que l'assistant IA n'existe pas : on parle de **dispatch automatique**, de
  **tournées optimisées** — c'est vrai aujourd'hui. Le mot « IA » viendra avec le copilote (étude
  `docs/etudes/2026-10-18-ia-et-app-livreur.md`).
- Pas de « Maroc » comme promesse (le produit est international) ; Casablanca et les dirhams apparaissent
  naturellement à l'écran comme cas d'usage.
- Pas de fonctionnalités non branchées (SMS, WhatsApp, Shopify).
- Pas de chiffres de gain non mesurés (« −30 % de retours ») : on les ajoutera avec les premiers clients pilotes.

## Production

1. Amorcer la société de démonstration : 10 livreurs simulés (déjà en place), 20 commandes, un marchand.
2. Filmer la console (Playwright, 1920×1080) et l'app livreur (émulateur, capture d'écran vidéo).
3. Voix off : Deepgram (voix française déjà utilisée pour les démos) ; musique libre de droits déjà dans `qa/promo/medias/`.
4. Montage et rendu avec la chaîne existante (`qa/promo/rendu.mjs`, ffmpeg), sous-titres incrustés.
5. Hébergement de la vidéo + vignette pour l'envoi aux prospects.
